import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { ConnectionService } from './connection.service';
import { DeviceService } from './device.service';
import { LocalStore } from './local-store';
import { PullResponse, PushResponse, StoredEvent } from './types';

const CURSOR_KEY = 'syncCursor';
const PUSH_BATCH = 100;
const PULL_BATCH = 200;
/** Played-offline results wait on the device until this many pile up (then they wake the server), or something else wakes it. */
const WAKE_AT_PENDING = 20;
/** At app start, a signed-in player's waiting results are sent after this long without a sync, even if few. */
const STALE_MS = 24 * 60 * 60 * 1000;
const LAST_KEY = 'zenigma.lastSync';

/**
 * Offline-first sync. Writes go to the local store first (`record`), then the outbox is pushed and new server
 * events are pulled. It runs after local changes, when the connection returns, after sign-in and on start.
 * It never polls: an idle app makes no requests, so the sleeping API and database stay asleep. Results played offline do
 * not wake a sleeping server one by one: they wait in the outbox and go out together when the server is awake anyway
 * (leaderboards, daily, sign-in), when enough pile up, or at app start if they have waited a day.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(LocalStore);
  private readonly auth = inject(AuthService);
  private readonly device = inject(DeviceService);
  private readonly connection = inject(ConnectionService);

  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly syncing = signal(false);
  readonly pendingCount = signal(0);
  readonly events = signal<StoredEvent[]>([]);
  readonly lastError = signal<string | null>(null);
  readonly lastSyncedAt = signal<string | null>(null);

  private running?: Promise<void>;
  private rerun = false;

  async init(): Promise<void> {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.online.set(true);
        void this.sync(); // waits for the server to answer first
      });
      window.addEventListener('offline', () => this.online.set(false));
    }
    // Whatever wakes the server (leaderboard, daily, sign-in) also carries the waiting results with it.
    this.connection.onWake(() => void this.sync());
    await this.refreshLocal();
  }

  /** Whether the app should wake the server on its own at start: a signed-in player whose results have waited too long. */
  async dueAtStart(): Promise<boolean> {
    if (!this.auth.signedIn() || this.connection.offlineMode()) return false;
    const pending = await this.store.pendingCount();
    if (pending === 0) return false;
    if (pending >= WAKE_AT_PENDING) return true;
    try {
      const last = Number(localStorage.getItem(LAST_KEY) ?? 0);
      return Date.now() - last > STALE_MS;
    } catch {
      return true;
    }
  }

  /** After a local change: sync now if the server is already awake or enough results are waiting; otherwise leave them queued. */
  private syncSoon(): void {
    if (this.connection.serverReady() || this.pendingCount() >= WAKE_AT_PENDING) void this.sync();
  }

  /** Saves an event on this device and queues it for the server. Works with no connection and no account. */
  async record(kind: string, payload: unknown): Promise<StoredEvent> {
    const event: StoredEvent = {
      id: crypto.randomUUID(),
      deviceId: await this.device.deviceId(),
      kind,
      payload,
      clientCreatedAt: new Date().toISOString(),
      pending: 1,
    };
    await this.store.putEvents([event]);
    await this.refreshLocal();
    this.syncSoon();
    return event;
  }

  /** Pushes the outbox and pulls anything new. Calls made while a sync is running are folded into one re-run. */
  sync(): Promise<void> {
    if (this.running) {
      this.rerun = true;
      return this.running;
    }
    this.running = this.run();
    return this.running;
  }

  private async run(): Promise<void> {
    try {
      do {
        this.rerun = false;
        await this.syncOnce();
      } while (this.rerun);
    } finally {
      // Cleared in the same tick as the loop check, so a sync() call can never slip in between and be lost.
      this.running = undefined;
    }
  }

  private async syncOnce(): Promise<void> {
    // Guests keep playing: their events wait in the outbox until an account exists.
    if (!this.auth.signedIn()) return;
    // Offline mode keeps everything on this device; otherwise wait for the server to wake (the app stays usable meanwhile).
    if (this.connection.offlineMode()) return;
    if (!(await this.connection.wake())) return;

    this.syncing.set(true);
    try {
      await this.pushAll();
      await this.pullAll();
      this.lastError.set(null);
      this.lastSyncedAt.set(new Date().toISOString());
      try {
        localStorage.setItem(LAST_KEY, String(Date.now()));
      } catch {
        /* the next start just syncs a little sooner */
      }
    } catch (error) {
      this.lastError.set(this.describe(error));
    } finally {
      this.syncing.set(false);
      await this.refreshLocal();
    }
  }

  private async pushAll(): Promise<void> {
    const deviceId = await this.device.deviceId();
    for (;;) {
      const batch = await this.store.pendingEvents(PUSH_BATCH);
      if (batch.length === 0) return;

      const response = await firstValueFrom(
        this.http.post<PushResponse>(`${environment.apiBaseUrl}/sync/push`, {
          deviceId,
          platform: this.device.platform,
          events: batch.map(({ id, kind, payload, clientCreatedAt }) => ({ id, kind, payload, clientCreatedAt })),
        }),
      );

      // Duplicates were already on the server; rejected events can never succeed, so neither may block the outbox.
      const settled = [...response.accepted, ...response.duplicates, ...response.rejected.map((r) => r.id)];
      await this.store.markSynced(settled);
      if (response.rejected.length > 0) {
        this.lastError.set(`${response.rejected.length} item(s) were rejected: ${response.rejected[0].reason}`);
      }
      if (settled.length === 0) return;
    }
  }

  private async pullAll(): Promise<void> {
    let cursor = (await this.store.getMeta<number>(CURSOR_KEY)) ?? 0;
    for (;;) {
      const response = await firstValueFrom(
        this.http.get<PullResponse>(`${environment.apiBaseUrl}/sync/pull`, {
          params: { after: cursor, limit: PULL_BATCH },
        }),
      );
      await this.store.putEvents(
        response.events.map((e) => ({
          id: e.id,
          deviceId: e.deviceId,
          kind: e.kind,
          payload: e.payload,
          clientCreatedAt: e.clientCreatedAt,
          seq: e.seq,
          pending: 0 as const,
        })),
      );
      cursor = response.nextCursor;
      await this.store.setMeta(CURSOR_KEY, cursor);
      if (!response.hasMore) return;
    }
  }

  async refreshLocal(): Promise<void> {
    this.events.set(await this.store.allEvents());
    this.pendingCount.set(await this.store.pendingCount());
  }

  private describe(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      return error.status === 0 ? 'Offline or server unreachable' : `Server error ${error.status}`;
    }
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
