import { ApplicationRef, inject, Injectable, signal } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { filter } from 'rxjs';

const HOUR = 60 * 60 * 1000;

/**
 * Updates for the installed web app, with no server of ours involved: the service worker re-reads the static build files
 * from the website host, downloads the new version quietly, and this offers a "Reload" when it is ready.
 * It looks when the app opens and when it comes back to the foreground (at most hourly). Nothing is polled in the background.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private readonly sw = inject(SwUpdate);
  private readonly app = inject(ApplicationRef);
  /** A new version is downloaded and waiting for a reload. */
  readonly ready = signal(false);
  readonly checking = signal(false);
  readonly upToDate = signal(false);
  private last = 0;

  constructor() {
    if (!this.sw.isEnabled) return;
    this.sw.versionUpdates.pipe(filter((e) => e.type === 'VERSION_READY')).subscribe(() => this.ready.set(true));
    void this.app.whenStable().then(() => setTimeout(() => void this.check(false), 3000));
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.check(false);
    });
  }

  get supported(): boolean {
    return this.sw.isEnabled;
  }

  /** Looks for a new build. `force` (the Settings button) ignores the hourly limit and reports "up to date". */
  async check(force: boolean): Promise<void> {
    if (!this.sw.isEnabled || this.checking() || this.ready()) return;
    if (!force && Date.now() - this.last < HOUR) return;
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

  async apply(): Promise<void> {
    try {
      await this.sw.activateUpdate();
    } catch {
      /* the reload below picks the new version up anyway */
    }
    location.reload();
  }
}
