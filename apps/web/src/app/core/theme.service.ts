import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';

export type ThemeMode = 'system' | 'light' | 'dark';
const KEY = 'zenigma.theme';

/** Light, dark or follow the device. A per-viewer convenience, so it lives in localStorage and may be absent. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.read());

  set(mode: ThemeMode): void {
    this.mode.set(mode);
    try {
      localStorage.setItem(KEY, mode);
    } catch {
      /* storage blocked: the choice just does not persist */
    }
    this.apply();
  }

  apply(): void {
    const root = document.documentElement;
    // The Android app follows Material 3; `?ui=android` previews it in a desktop browser.
    const android = Capacitor.getPlatform() === 'android' || new URLSearchParams(location.search).get('ui') === 'android';
    if (android) root.setAttribute('data-platform', 'android');
    if (this.mode() === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', this.mode());
  }

  private read(): ThemeMode {
    try {
      const value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : 'system';
    } catch {
      return 'system';
    }
  }
}
