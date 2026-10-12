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
    this.run(() => Haptics.vibrate({ duration: 14 }), 14);
  }

  /** A light tap: a mark or a number placed. */
  tap(): void {
    this.run(() => Haptics.impact({ style: ImpactStyle.Light }), 14);
  }

  /** A firmer tap: a queen placed, a word submitted. */
  place(): void {
    this.run(() => Haptics.impact({ style: ImpactStyle.Medium }), 24);
  }

  /** Something is wrong, shown after the player pauses. */
  warning(): void {
    this.run(() => Haptics.notification({ type: NotificationType.Warning }), [18, 40, 18]);
  }

  /** A refused move or word. */
  error(): void {
    this.run(() => Haptics.notification({ type: NotificationType.Error }), [30, 50, 30, 50, 30]);
  }

  /** The puzzle is solved. */
  success(): void {
    this.run(() => Haptics.notification({ type: NotificationType.Success }), [20, 60, 20, 60, 60]);
  }

  private run(native: () => Promise<void>, web: number | number[]): void {
    if (!this.on) return;
    try {
      if (this.native) void native().catch(() => undefined);
      else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(web);
    } catch {
      /* no vibration motor, or blocked: play on silently */
    }
  }
}
