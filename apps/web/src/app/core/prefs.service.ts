import { Injectable, signal } from '@angular/core';

const KEY = 'zenigma.prefs';

export type HapticStrength = 'off' | 'light' | 'strong';
const strengths: HapticStrength[] = ['off', 'light', 'strong'];
const strength = (v: unknown, fallback: HapticStrength): HapticStrength => (strengths.includes(v as HapticStrength) ? (v as HapticStrength) : fallback);

interface Prefs {
  hardMode: boolean;
  highContrast: boolean;
  reduceMotion: boolean;
  haptics: boolean;
  largeNumbers: boolean;
  strikes: boolean;
  blind: boolean;
  hideTimer: boolean;
  hideStreaks: boolean;
  crashReports: boolean;
  accent: string;
  tapHaptics: HapticStrength;
  alertHaptics: HapticStrength;
}

/** Small per-device settings (not synced). Kept in localStorage so they apply before anything else loads. */
@Injectable({ providedIn: 'root' })
export class PrefsService {
  readonly hardMode = signal(false);
  readonly highContrast = signal(false);
  readonly reduceMotion = signal(false);
  readonly haptics = signal(true);
  readonly largeNumbers = signal(false);
  /** Strict practice: three wrong moves reset the board. */
  readonly strikes = signal(false);
  /** Blind Sudoku: no row, column or matching-number highlighting. */
  readonly blind = signal(false);
  /** Quiet mode: the clock keeps counting but is not shown, so there is nothing to race. */
  readonly hideTimer = signal(false);
  /** Quiet mode, part two: streak counts and "your streak ends tonight" warnings are not shown. */
  readonly hideStreaks = signal(false);
  /** Send a tiny anonymous crash report to our own API when the app breaks. On unless turned off. */
  readonly crashReports = signal(true);
  /** The colour theme (see ACCENTS in the settings page). 'default' is the original blue. */
  readonly accent = signal('default');
  /** How strong the little taps are (a cell chosen, a number placed). */
  readonly tapHaptics = signal<HapticStrength>('light');
  /** How strong the patterns for a mistake, a refused move and a win are. */
  readonly alertHaptics = signal<HapticStrength>('strong');

  constructor() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>;
      this.hardMode.set(saved.hardMode === true);
      this.highContrast.set(saved.highContrast === true);
      this.reduceMotion.set(saved.reduceMotion === true);
      this.haptics.set(saved.haptics !== false);
      this.largeNumbers.set(saved.largeNumbers === true);
      this.strikes.set(saved.strikes === true);
      this.blind.set(saved.blind === true);
      this.hideTimer.set(saved.hideTimer === true);
      this.hideStreaks.set(saved.hideStreaks === true);
      this.crashReports.set(saved.crashReports !== false);
      this.accent.set(typeof saved.accent === 'string' ? saved.accent : 'default');
      this.tapHaptics.set(strength(saved.tapHaptics, 'light'));
      this.alertHaptics.set(strength(saved.alertHaptics, 'strong'));
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
    if (this.accent() !== 'default') document.documentElement.setAttribute('data-accent', this.accent());
    else document.documentElement.removeAttribute('data-accent');
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

  setBlind(value: boolean): void {
    this.blind.set(value);
    this.save();
  }

  setHideTimer(value: boolean): void {
    this.hideTimer.set(value);
    this.save();
  }

  setHideStreaks(value: boolean): void {
    this.hideStreaks.set(value);
    this.save();
  }

  setCrashReports(value: boolean): void {
    this.crashReports.set(value);
    this.save();
  }

  setStrikes(value: boolean): void {
    this.strikes.set(value);
    this.save();
  }

  setLargeNumbers(value: boolean): void {
    this.largeNumbers.set(value);
    this.save();
    this.apply();
  }

  setAccent(value: string): void {
    this.accent.set(value);
    this.save();
    this.apply();
  }

  setTapHaptics(value: HapticStrength): void {
    this.tapHaptics.set(value);
    this.save();
  }

  setAlertHaptics(value: HapticStrength): void {
    this.alertHaptics.set(value);
    this.save();
  }

  setHaptics(value: boolean): void {
    this.haptics.set(value);
    this.save();
  }

  private save(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ hardMode: this.hardMode(), highContrast: this.highContrast(), reduceMotion: this.reduceMotion(), haptics: this.haptics(), largeNumbers: this.largeNumbers(), strikes: this.strikes(), blind: this.blind(), hideTimer: this.hideTimer(), hideStreaks: this.hideStreaks(), crashReports: this.crashReports(), accent: this.accent(), tapHaptics: this.tapHaptics(), alertHaptics: this.alertHaptics() }));
    } catch {
      /* storage unavailable: setting lasts for this session */
    }
  }
}
