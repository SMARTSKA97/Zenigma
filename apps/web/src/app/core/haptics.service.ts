import { inject, Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { PrefsService } from './prefs.service';

/**
 * Vibrations for play. Phone motors are weak and the system's own "impact" and "notification" effects are barely felt on many Androids,
 * so everything here is a plain timed vibration (a longer one for a bigger event), with a heavy impact on top where it helps.
 * Taps and alerts each have their own strength in settings. Native in the app; the browser's vibrate API on the web (where supported).
 * A pattern is `[on, off, on, ...]` in milliseconds.
 */
@Injectable({ providedIn: 'root' })
export class HapticsService {
  private readonly prefs = inject(PrefsService);
  private readonly native = Capacitor.isNativePlatform();
  private timers: ReturnType<typeof setTimeout>[] = [];
  /** When the last vibration was asked for, so a burst of taps (a swipe through comets, a fast tapper) is not sent to the phone one by one. */
  private lastAt = 0;

  private get on(): boolean {
    return this.prefs.haptics();
  }

  /** A short tick: selecting a cell, stepping a path, a key press. */
  tick(): void {
    this.tapBuzz(22, 40);
  }

  /** A tap: a mark or a number placed. */
  tap(): void {
    this.tapBuzz(30, 50);
  }

  /** A firmer thump: a queen placed, a word submitted. */
  place(): void {
    this.tapBuzz(45, 75, true);
  }

  /** Something is wrong, shown after the player pauses. */
  warning(): void {
    this.alert([60, 70, 60], [40]);
  }

  /** A refused move or word. */
  error(): void {
    this.alert([90, 60, 90, 60, 160], [60]);
  }

  /** A huge jolt for a game-ending blow (a skull sliced): a long, hard vibration. Skipped only when vibration is off. */
  boom(): void {
    if (!this.on || this.prefs.alertHaptics() === 'off') return;
    this.buzz([500, 60, 220, 60, 520]);
    this.heavy();
  }

  /** The puzzle is solved: a rising flourish. */
  success(): void {
    this.alert([50, 60, 70, 60, 90, 60, 260], [50]);
  }

  /** A tap's strength is its own setting: `light` is the base, `strong` is the base scaled up (and a heavy impact when asked for). */
  private tapBuzz(light: number, strong: number, impact = false): void {
    if (!this.on) return;
    const level = this.prefs.tapHaptics();
    if (level === 'off') return;
    this.buzz([level === 'strong' ? strong : light]);
    if (impact && level === 'strong') this.heavy();
  }

  /** `gentle` is what an alert becomes when the person chose light alerts: one short buzz instead of a pattern. */
  private alert(pattern: number[], gentle: number[]): void {
    if (!this.on) return;
    const level = this.prefs.alertHaptics();
    if (level === 'off') return;
    this.buzz(level === 'light' ? gentle : pattern);
  }

  private heavy(): void {
    if (this.native) void Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => undefined);
  }

  private buzz(pattern: number[]): void {
    const now = Date.now();
    // Short taps closer than 60 ms apart are dropped: the motor cannot show them apart, and every one is a call across to the phone.
    if (pattern.length === 1 && now - this.lastAt < 60) return;
    this.lastAt = now;
    try {
      if (this.native) {
        this.timers.forEach(clearTimeout);
        this.timers = [];
        let at = 0;
        pattern.forEach((ms, i) => {
          if (i % 2 === 0) this.timers.push(setTimeout(() => void Haptics.vibrate({ duration: ms }).catch(() => undefined), at));
          at += ms;
        });
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
    } catch {
      /* no vibration motor, or blocked: play on silently */
    }
  }
}
