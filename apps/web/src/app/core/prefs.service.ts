import { Injectable, signal } from '@angular/core';

const KEY = 'zenigma.prefs';

interface Prefs {
  hardMode: boolean;
  highContrast: boolean;
}

/** Small per-device settings (not synced). Kept in localStorage so they apply before anything else loads. */
@Injectable({ providedIn: 'root' })
export class PrefsService {
  readonly hardMode = signal(false);
  readonly highContrast = signal(false);

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
      this.hardMode.set(saved.hardMode === true);
      this.highContrast.set(saved.highContrast === true);
    } catch {
      /* storage unavailable: defaults */
    }
  }

  apply(): void {
    if (typeof document === 'undefined') return;
    if (this.highContrast()) document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
  }

  setHardMode(value: boolean): void {
    this.hardMode.set(value);
    this.save();
  }

  setHighContrast(value: boolean): void {
    this.highContrast.set(value);
    this.save();
    this.apply();
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ hardMode: this.hardMode(), highContrast: this.highContrast() }));
    } catch {
      /* storage unavailable: setting lasts for this session */
    }
  }
}
