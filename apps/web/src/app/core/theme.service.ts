import { Injectable, signal } from '@angular/core';
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core';

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
    // The Android app looks the same as the web app; the attribute only marks the platform.
    const android = Capacitor.getPlatform() === 'android' || new URLSearchParams(location.search).get('ui') === 'android';
    if (android) root.setAttribute('data-platform', 'android');
    if (this.mode() === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', this.mode());
    this.barIcons();
  }

  /** On Android the status and gesture bars show light icons on a dark app and dark icons on a light one, whatever the phone's own setting is. */
  private watching = false;

  private barIcons(): void {
    if (!Capacitor.isNativePlatform()) return;
    if (!this.watching) {
      this.watching = true;
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.barIcons());
      // A full theme (data-skin) decides light or dark by itself.
      new MutationObserver(() => this.barIcons()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-skin'] });
    }
    const skin = document.documentElement.getAttribute('data-skin');
    const dark = skin ? ['midnight', 'terminal', 'evergreen', 'dusk'].includes(skin) : this.mode() === 'dark' || (this.mode() === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined);
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
