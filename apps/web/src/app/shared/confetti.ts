import { ChangeDetectionStrategy, Component } from '@angular/core';

const COLOURS = ['#f0a21a', '#4f63e6', '#e8556d', '#2f9e5f', '#8c5cf0', '#18a7c9'];

/** A short burst of confetti over the whole screen. Pure CSS, ignores touches, and respects reduced motion. */
@Component({
  selector: 'app-confetti',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (p of pieces; track $index) {
      <i [style.--x]="p.x" [style.--r]="p.r" [style.--d]="p.d" [style.--s]="p.s" [style.--w]="p.w" [style.background]="p.c"></i>
    }
  `,
  styles: `
    :host {
      position: fixed;
      inset: 0;
      z-index: 120;
      overflow: hidden;
      pointer-events: none;
    }
    i {
      position: absolute;
      top: 38%;
      left: 50%;
      width: calc(var(--s) * 1px);
      height: calc(var(--s) * 0.5px);
      border-radius: 2px;
      opacity: 0;
      animation: burst 1.7s cubic-bezier(0.15, 0.7, 0.3, 1) forwards;
      animation-delay: var(--d);
    }
    @keyframes burst {
      0% {
        opacity: 1;
        transform: translate(0, 0) rotate(0);
      }
      70% {
        opacity: 1;
      }
      100% {
        opacity: 0;
        transform: translate(calc(var(--x) * 1vw), calc(var(--w) * 1vh)) rotate(calc(var(--r) * 1deg));
      }
    }
  `,
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
