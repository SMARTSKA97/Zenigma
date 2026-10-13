import { Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

interface ScreenGuardPlugin {
  enter(options: { secure: boolean }): Promise<void>;
  leave(): Promise<void>;
}
const ScreenGuard = registerPlugin<ScreenGuardPlugin>('ScreenGuard');

/**
 * While a puzzle is open: the screen stays on, and on Android the daily puzzles also block screenshots and recording.
 * Browsers cannot block screenshots, so the web version only keeps the screen awake (where the browser allows it).
 */
@Injectable({ providedIn: 'root' })
export class ScreenGuardService {
  private readonly native = Capacitor.isNativePlatform();
  private lock: { release(): Promise<void> } | null = null;
  private wanted = false;
  private readonly onVisible = () => {
    if (this.wanted && document.visibilityState === 'visible') void this.acquire();
  };

  enter(secure: boolean): void {
    if (this.native) {
      void ScreenGuard.enter({ secure }).catch(() => undefined);
      return;
    }
    this.wanted = true;
    document.addEventListener('visibilitychange', this.onVisible);
    void this.acquire();
  }

  leave(): void {
    if (this.native) {
      void ScreenGuard.leave().catch(() => undefined);
      return;
    }
    this.wanted = false;
    document.removeEventListener('visibilitychange', this.onVisible);
    void this.lock?.release().catch(() => undefined);
    this.lock = null;
  }

  private async acquire(): Promise<void> {
    try {
      const wakeLock = (navigator as unknown as { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
      if (!wakeLock || this.lock) return;
      this.lock = await wakeLock.request('screen');
      // The browser drops the lock when the page is hidden; ask again when it comes back.
      (this.lock as unknown as EventTarget).addEventListener('release', () => (this.lock = null));
    } catch {
      /* not allowed here (battery saver, no secure context): the screen just follows the system timeout */
    }
  }
}
