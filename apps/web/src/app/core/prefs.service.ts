import { Capacitor } from '@capacitor/core';
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
  skin: string;
  sounds: boolean;
  tapHaptics: HapticStrength;
  alertHaptics: HapticStrength;
  /** Bumped when the default vibration got stronger, so old 'light' settings move up once. */
  hapticsRev?: number;
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
  /** A full theme ('none' for the normal light/dark). Earned or bought in the store. */
  readonly skin = signal('none');
  /** Small sounds for coins and wins (made on the device, no files). */
  readonly sounds = signal(true);
  /** How strong the little taps are (a cell chosen, a number placed). */
  readonly tapHaptics = signal<HapticStrength>('strong');
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
      this.skin.set(typeof saved.skin === 'string' ? saved.skin : 'none');
      this.sounds.set(saved.sounds !== false);
      const tap = strength(saved.tapHaptics, 'strong');
      this.tapHaptics.set(saved.hapticsRev === undefined && tap === 'light' ? 'strong' : tap);
      this.alertHaptics.set(strength(saved.alertHaptics, 'strong'));
    } catch {
      /* storage unavailable: defaults */
    }
  }

  apply(): void {
    if (typeof document === 'undefined') return;
    if (this.highContrast()) document.documentElement.setAttribute('data-contrast', 'high');
    else document.documentElement.removeAttribute('data-contrast');
    // The phone's own "remove animations" setting often switches animations off by accident (power saving, or a developer option), and
    // then Word Guess tiles and every other animation seem to be missing. In the Android app only the switch in Settings decides.
    const native = Capacitor.isNativePlatform();
    if (this.reduceMotion()) document.documentElement.setAttribute('data-motion', 'reduced');
    else if (native) document.documentElement.setAttribute('data-motion', 'full');
    else document.documentElement.removeAttribute('data-motion');
    if (this.largeNumbers()) document.documentElement.setAttribute('data-large', 'true');
    else document.documentElement.removeAttribute('data-large');
    if (this.accent() !== 'default') document.documentElement.setAttribute('data-accent', this.accent());
    else document.documentElement.removeAttribute('data-accent');
    if (this.skin() !== 'none') document.documentElement.setAttribute('data-skin', this.skin());
    else document.documentElement.removeAttribute('data-skin');
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

  /** True when animations should be skipped: the Settings switch, or (on the web only) the device's reduced-motion setting. */
  motionReduced(): boolean {
    if (this.reduceMotion()) return true;
    if (Capacitor.isNativePlatform()) return false;
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  setSkin(value: string): void {
    this.skin.set(value);
    this.save();
    this.apply();
  }

  setSounds(value: boolean): void {
    this.sounds.set(value);
    this.save();
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
      localStorage.setItem(KEY, JSON.stringify({ hardMode: this.hardMode(), highContrast: this.highContrast(), reduceMotion: this.reduceMotion(), haptics: this.haptics(), largeNumbers: this.largeNumbers(), strikes: this.strikes(), blind: this.blind(), hideTimer: this.hideTimer(), hideStreaks: this.hideStreaks(), crashReports: this.crashReports(), accent: this.accent(), skin: this.skin(), sounds: this.sounds(), tapHaptics: this.tapHaptics(), alertHaptics: this.alertHaptics(), hapticsRev: 2 }));
    } catch {
      /* storage unavailable: setting lasts for this session */
    }
  }
}
