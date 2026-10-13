import { ChangeDetectionStrategy, Component } from '@angular/core';

const COLOURS = ['#f0a21a', '#4f63e6', '#e8556d', '#2f9e5f', '#8c5cf0', '#18a7c9'];

/** A short burst of confetti over the whole screen. Pure CSS, ignores touches, and respects reduced motion. */
@Component({
  selector: 'app-confetti',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './confetti.html',
  styleUrl: './confetti.scss',
})
export class Confetti {
  /** Fixed pseudo-random pieces so the burst looks the same every time and needs no randomness at runtime. */
  protected readonly pieces = Array.from({ length: 44 }, (_, i) => {
    const a = (i * 137.508) % 360;
    const rad = (a * Math.PI) / 180;
    return {
      x: (Math.cos(rad) * (28 + (i % 5) * 9)).toFixed(1),
      w: (Math.sin(rad) * 22 + 38 + (i % 4) * 6).toFixed(1),
      r: Math.round(((i * 53) % 720) - 360),
      d: `${((i % 9) * 0.03).toFixed(2)}s`,
      s: 7 + (i % 4) * 3,
      c: COLOURS[i % COLOURS.length],
    };
  });
}
