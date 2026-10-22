import { computed, inject, Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

const OFFLINE_KEY = 'zenigma.offlineMode';
const ATTEMPTS = 14;
const PAUSE_MS = 4000;
const TIMEOUT_MS = 12000;

export type ServerState = 'idle' | 'warming' | 'ready' | 'down';

/**
 * Whether the app talks to the server.
 *
 * Offline mode on: nothing is sent or fetched. Practice, mind games and every level still work; daily challenges and
 * leaderboards wait. Offline mode off: the app wakes the server (a free host sleeps when idle and needs up to a minute),
 * shows a small notice while it does, and syncs as soon as it answers. Playing is never blocked in the meantime.
 */
@Injectable({ providedIn: 'root' })
export class ConnectionService {
  readonly offlineMode = signal(this.read());
  readonly server = signal<ServerState>('idle');
  /** Seconds spent waiting for the server in this wake-up, for the notice. */
  readonly waited = signal(0);
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  /** Screens that must not touch the server (practice play) each hold the connection; it is back the moment the last one lets go. */
  private readonly holds = signal(0);
  readonly paused = computed(() => this.holds() > 0);

  /** True when daily challenges, leaderboards and sync can work right now. */
  readonly serverReady = computed(() => !this.offlineMode() && !this.paused() && this.online() && this.server() === 'ready');
  /** The notice to show: warming up, or could not reach it. Never while offline mode is on. */
  readonly notice = computed<'warming' | 'down' | null>(() => {
    if (this.offlineMode() || this.paused() || !this.online()) return null;
    const s = this.server();
    return s === 'warming' || s === 'down' ? s : null;
  });

  private waking?: Promise<boolean>;
  private failedAt = 0;
  private onReady: (() => void)[] = [];
  private listeners: (() => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      // Coming back online does not wake the server by itself: the first call that needs it does.
      window.addEventListener('online', () => this.online.set(true));
      window.addEventListener('offline', () => this.online.set(false));
    }
  }

  /**
   * Practice needs no server, so while a practice screen is open nothing is sent or fetched: fewer wake-ups, fewer requests, a snappier game.
   * Whatever was queued (results, coins, hints) goes out when the player leaves. Returns the function that lets go.
   */
  hold(): () => void {
    this.holds.update((n) => n + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.holds.update((n) => Math.max(0, n - 1));
    };
  }

  setOffline(value: boolean): void {
    this.offlineMode.set(value);
    try {
      localStorage.setItem(OFFLINE_KEY, value ? '1' : '0');
    } catch {
      /* the choice just does not persist */
    }
    if (value) this.server.set('idle');
    else void this.wake();
  }

  /** Runs a function every time the server comes up, whatever woke it (a leaderboard, the daily, a sign-in). */
  onWake(fn: () => void): void {
    this.listeners.push(fn);
  }

  /** Runs a function once the server answers (now, if it already has). */
  whenReady(fn: () => void): void {
    if (this.server() === 'ready') fn();
    else this.onReady.push(fn);
  }

  /** Pings the server until it answers. One wake-up runs at a time. Resolves true once it is up. */
  wake(): Promise<boolean> {
    if (this.offlineMode() || this.paused() || !this.online()) return Promise.resolve(false);
    if (this.server() === 'ready') return Promise.resolve(true);
    // After a failed wake-up, wait a minute before trying again, so a busy screen cannot hammer a server that is down.
    if (this.server() === 'down' && Date.now() - this.failedAt < 60_000) return Promise.resolve(false);
    this.waking ??= this.run().finally(() => (this.waking = undefined));
    return this.waking;
  }

  /** Forget that the server answered (a request failed), so the next call wakes it again. */
  markStale(): void {
    if (this.server() === 'ready') this.server.set('idle');
  }

  private async run(): Promise<boolean> {
    this.server.set('warming');
    this.waited.set(0);
    const started = Date.now();
    const tick = setInterval(() => this.waited.set(Math.round((Date.now() - started) / 1000)), 1000);
    try {
      for (let i = 0; i < ATTEMPTS; i++) {
        // A wake-up that was already running when a practice screen opened stops there, instead of pinging on while the player plays.
        if (this.offlineMode() || this.paused() || !this.online()) {
          this.server.set('idle');
          return false;
        }
        if (await this.ping()) {
          this.server.set('ready');
          const waiting = this.onReady;
          this.onReady = [];
          waiting.forEach((fn) => fn());
          this.listeners.forEach((fn) => fn());
          return true;
        }
        await new Promise((r) => setTimeout(r, PAUSE_MS));
      }
      this.server.set('down');
      this.failedAt = Date.now();
      return false;
    } finally {
      clearInterval(tick);
    }
  }

  private async ping(): Promise<boolean> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(`${environment.apiBaseUrl}/health`, { signal: controller.signal, cache: 'no-store' });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  private read(): boolean {
    try {
      return localStorage.getItem(OFFLINE_KEY) === '1';
    } catch {
      return false;
    }
  }
}
