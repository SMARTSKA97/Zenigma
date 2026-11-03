import { ApplicationRef, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

/** How often at most it looks for a new build when the app comes to the foreground. */
const EVERY = 2 * 60 * 1000;
/** A new version found in the first seconds after opening is applied at once, before the player has started anything. */
const FRESH_START = 25_000;

/**
 * Updates for the installed web app, with no server of ours involved: the service worker re-reads the static build files
 * from the website host, downloads the new version quietly, and this offers a "Reload" when it is ready.
 * It looks when the app opens and whenever it comes back to the foreground (at most every two minutes), and applies a new version by
 * itself at a safe moment: right away if the app has only just opened, otherwise on the next screen change or when the app returns from
 * the background. So nobody has to hard-refresh to see a new build. Nothing is polled in the background.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly sw = inject(SwUpdate);
  private readonly app = inject(ApplicationRef);
  private readonly router = inject(Router);
  private readonly opened = Date.now();
  private hiddenAt = 0;
  /** A new version is downloaded and waiting for a reload. */
  readonly ready = signal(false);
  readonly checking = signal(false);
  readonly upToDate = signal(false);
  private last = 0;

  constructor() {
    if (!this.sw.isEnabled) return;
    // If the worker breaks (a file it needs was refused, so its cache no longer matches the site), start over with a clean copy: the same as a
    // hard refresh, done once, by itself.
    this.sw.unrecoverable.subscribe(() => void this.hardRefresh(true));
    this.sw.versionUpdates.pipe(filter((e) => e.type === 'VERSION_INSTALLATION_FAILED')).subscribe(() => void this.hardRefresh(true));
    this.sw.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => {
      this.ready.set(true);
      // Just opened and nothing started yet: switch over now.
      if (Date.now() - this.opened < FRESH_START) void this.apply();
    });
    void this.app.whenStable().then(() => setTimeout(() => void this.check(false), 1500));
    // The next screen change is a safe moment to switch: the new screen simply loads from the new build.
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      if (this.ready()) void this.apply();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.hiddenAt = Date.now();
        return;
      }
      // Back from the background for a while: switch to a waiting version, and look for a newer one.
      if (this.ready() && Date.now() - this.hiddenAt > 20_000) void this.apply();
      else void this.check(false);
    });
  }

  get supported(): boolean {
    return this.sw.isEnabled;
  }

  /** Looks for a new build. `force` (the Settings button) ignores the hourly limit and reports "up to date". */
  async check(force: boolean): Promise<void> {
    if (!this.sw.isEnabled || this.checking() || this.ready()) return;
    if (!force && Date.now() - this.last < EVERY) return;
    this.last = Date.now();
    this.checking.set(true);
    this.upToDate.set(false);
    try {
      const found = await this.sw.checkForUpdate();
      if (force && !found) this.upToDate.set(true);
    } catch {
      /* offline: try again next time */
    } finally {
      this.checking.set(false);
    }
  }

  /** Forget everything the service worker cached and load the site fresh (what Ctrl+Shift+R does). `auto` allows it once per session. */
  async hardRefresh(auto = false): Promise<void> {
    try {
      if (auto) {
        if (sessionStorage.getItem('zenigma.hardRefresh')) return;
        sessionStorage.setItem('zenigma.hardRefresh', '1');
      }
    } catch {
      /* no storage: allow it */
    }
    try {
      for (const reg of await navigator.serviceWorker.getRegistrations()) await reg.unregister();
      for (const key of await caches.keys()) await caches.delete(key);
    } catch {
      /* the reload below still asks the network */
    }
    location.reload();
  }

  async apply(): Promise<void> {
    try {
      await this.sw.activateUpdate();
    } catch {
      /* the reload below picks the new version up anyway */
    }
    location.reload();
  }
}
