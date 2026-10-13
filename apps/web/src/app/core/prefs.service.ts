import { Injectable, signal } from '@angular/core';

const KEY = 'zenigma.prefs';

interface Prefs {
  hardMode: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  haptics: boolean;
  largeNumbers: boolean;
}

/** Small per-device settings (not synced). Kept in localStorage so they apply before anything else loads. */
@Injectable({ providedIn: 'root' })
export class PrefsService {
  readonly hardMode = signal(false);
  readonly highContrast = signal(false);
  readonly reduceMotion = signal(false);
  readonly haptics = signal(true);
  readonly largeNumbers = signal(false);

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
      this.hardMode.set(saved.hardMode === true);
      this.highContrast.set(saved.highContrast === true);
      this.reduceMotion.set(saved.reduceMotion === true);
      this.haptics.set(saved.haptics !== false);
      this.largeNumbers.set(saved.largeNumbers === true);
    } catch {
      /* storage unavailable: defaults */
    }
  }

  apply(): void {
    if (typeof document === 'undefined') return;
    if (this.highContrast()) document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
    if (this.reduceMotion()) document.documentElement.setAttribute('data-motion', 'reduced');
    else document.documentElement.removeAttribute('data-motion');
    if (this.largeNumbers()) document.documentElement.setAttribute('data-large', 'true');
    else document.documentElement.removeAttribute('data-large');
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

  setReduceMotion(value: boolean): void {
    this.reduceMotion.set(value);
    this.save();
    this.apply();
  }

  setLargeNumbers(value: boolean): void {
    this.largeNumbers.set(value);
    this.save();
    this.apply();
  }

  setHaptics(value: boolean): void {
    this.haptics.set(value);
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ hardMode: this.hardMode(), highContrast: this.highContrast(), reduceMotion: this.reduceMotion(), haptics: this.haptics(), largeNumbers: this.largeNumbers() }));
    } catch {
      /* storage unavailable: setting lasts for this session */
    }
  }
}
