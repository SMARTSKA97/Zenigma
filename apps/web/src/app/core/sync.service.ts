import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';
import { DeviceService } from './device.service';
import { LocalStore } from './local-store';
import { PullResponse, PushResponse, StoredEvent } from './types';

const CURSOR_KEY = 'syncCursor';
const PUSH_BATCH = 100;
const PULL_BATCH = 200;

/**
 * Offline-first sync. Writes go to the local store first (`record`), then the outbox is pushed and new server
 * events are pulled. It runs after local changes, when the connection returns, after sign-in and on start.
 * It never polls: an idle app makes no requests, so the sleeping API and database stay asleep.
 */
@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(LocalStore);
  private readonly auth = inject(AuthService);
  private readonly device = inject(DeviceService);

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
        void this.sync();
      });
      window.addEventListener('offline', () => this.online.set(false));
    }
    await this.refreshLocal();
    void this.sync();
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
    void this.sync();
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

    this.syncing.set(true);
    try {
      await this.pushAll();
      await this.pullAll();
      this.lastError.set(null);
      this.lastSyncedAt.set(new Date().toISOString());
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
