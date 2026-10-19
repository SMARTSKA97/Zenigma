import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { PrefsService } from './prefs.service';

/**
 * Small vibrations for play: a light tick for taps and steps, a firmer one when something is placed,
 * and distinct patterns for a warning, an error and a win. Native in the app; the browser's vibrate API on the web
 * (where supported). Does nothing when the person turned vibration off, or when reduced motion is on.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly prefs = inject(PrefsService);
  private readonly native = Capacitor.isNativePlatform();

  private get on(): boolean {
    return this.prefs.haptics();
  }

  /** A very light tick: selecting a cell, stepping a path, a key press. */
  tick(): void {
    // (Android only vibrates for selectionChanged after a selection has started, so a short plain vibration is used.)
    const strong = this.prefs.tapHaptics() === 'strong';
    this.run('tap', () => Haptics.vibrate({ duration: strong ? 26 : 14 }), strong ? 26 : 14);
  }

  /** A light tap: a mark or a number placed. */
  tap(): void {
    const strong = this.prefs.tapHaptics() === 'strong';
    this.run('tap', () => Haptics.impact({ style: strong ? ImpactStyle.Medium : ImpactStyle.Light }), strong ? 26 : 14);
  }

  /** A firmer tap: a queen placed, a word submitted. */
  place(): void {
    const strong = this.prefs.tapHaptics() === 'strong';
    this.run('tap', () => Haptics.impact({ style: strong ? ImpactStyle.Heavy : ImpactStyle.Medium }), strong ? 40 : 24);
  }

  /** Something is wrong, shown after the player pauses. */
  warning(): void {
    this.run('alert', () => Haptics.notification({ type: NotificationType.Warning }), [18, 40, 18], () => Haptics.impact({ style: ImpactStyle.Light }));
  }

  /** A refused move or word. */
  error(): void {
    this.run('alert', () => Haptics.notification({ type: NotificationType.Error }), [30, 50, 30, 50, 30], () => Haptics.impact({ style: ImpactStyle.Light }));
  }

  /** A huge jolt for a game-ending blow (a skull sliced): a long, hard vibration. Skipped only when vibration is off. */
  boom(): void {
    if (!this.on || this.prefs.alertHaptics() === 'off') return;
    try {
      if (this.native) {
        void Haptics.vibrate({ duration: 450 }).catch(() => undefined);
        void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([320, 50, 160, 50, 420]);
    } catch {
      /* no vibration motor, or blocked: play on silently */
    }
  }

  /** The puzzle is solved. */
  success(): void {
    this.run('alert', () => Haptics.notification({ type: NotificationType.Success }), [20, 60, 20, 60, 60], () => Haptics.impact({ style: ImpactStyle.Medium }));
  }

  /** `light` is the gentler version used when the person chose light alerts (one short tap instead of a pattern). */
  private run(kind: 'tap' | 'alert', native: () => Promise<void>, web: number | number[], light?: () => Promise<void>): void {
    if (!this.on) return;
    const strength = kind === 'tap' ? this.prefs.tapHaptics() : this.prefs.alertHaptics();
    if (strength === 'off') return;
    const gentle = kind === 'alert' && strength === 'light';
    try {
      if (this.native) void (gentle && light ? light() : native()).catch(() => undefined);
      else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(gentle ? 16 : web);
    } catch {
      /* no vibration motor, or blocked: play on silently */
    }
  }
}
