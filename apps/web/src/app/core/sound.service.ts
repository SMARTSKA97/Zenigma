import { inject, Injectable } from '@angular/core';
import { PrefsService } from './prefs.service';

/**
 * Tiny sounds made with the Web Audio API, so there is nothing to download. Off with the "Sounds" setting, and silent with reduced motion.
 * A browser only lets sound start after a tap, so the context is created on first use (always inside a tap or a finished game).
 */
@Injectable({ providedIn: 'root' })
export class SoundService {
  private readonly prefs = inject(PrefsService);
  private ctx?: AudioContext;

  private get audio(): AudioContext | null {
    if (!this.prefs.sounds() || this.prefs.reduceMotion() || typeof AudioContext === 'undefined') return null;
    try {
      this.ctx ??= new AudioContext();
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private note(freq: number, start: number, length: number, type: OscillatorType = 'triangle', volume = 0.16): void {
    const ctx = this.audio;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const t = ctx.currentTime + start;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + length + 0.02);
  }

  /** The classic two-note coin: a short low note, then a long high one. */
  coin(): void {
    this.note(988, 0, 0.09, 'square', 0.08);
    this.note(1319, 0.08, 0.34, 'square', 0.08);
  }

  /** Several coins arriving: a quick rising run. */
  coins(count = 4): void {
    for (let i = 0; i < Math.min(count, 6); i++) this.note(880 + i * 110, i * 0.07, 0.12, 'square', 0.06);
    this.note(1760, Math.min(count, 6) * 0.07, 0.3, 'triangle', 0.1);
  }

  /** A short rising arpeggio for a win or a streak. */
  win(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.note(f, i * 0.09, 0.22, 'triangle', 0.14));
  }

  /** Soft tick for the wheel passing a slice. */
  tick(): void {
    this.note(1400, 0, 0.03, 'square', 0.04);
  }
}
