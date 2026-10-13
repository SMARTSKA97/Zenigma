import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { HapticsService } from '../core/haptics.service';
import { HintsService } from '../core/hints.service';
import { Sheet } from './sheet';

/** Slices of the wheel, clockwise from the top. Odds (in the service) are 60% one, 30% two, 10% three. */
const SLICES = [1, 2, 1, 3, 1, 2, 1, 2];

/** The daily spin: one go a day, always at least one hint. */
@Component({
  selector: 'app-hint-wheel',
  imports: [Sheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-sheet label="Daily spin" (closed)="closed.emit()">
      <div class="wrap">
        <h2>Daily spin</h2>
        <p class="muted">One spin a day. Hints guide you towards the next step, they never give the answer away.</p>
        <div class="stage">
          <div class="pointer" aria-hidden="true"></div>
          <svg class="wheel" viewBox="-100 -100 200 200" [style.transform]="'rotate(' + angle() + 'deg)'" aria-hidden="true">
            @for (s of slices; track $index) {
              <path [attr.d]="slicePath($index)" [attr.fill]="colour($index)" />
              <text [attr.transform]="'rotate(' + ($index * 45 + 22.5) + ') translate(0 -66)'" text-anchor="middle" dominant-baseline="central">{{ s }}</text>
            }
            <circle r="14" class="hub" />
          </svg>
        </div>
        @if (prize(); as p) {
          <p class="won" role="status">+{{ p }} hint{{ p > 1 ? 's' : '' }} <span aria-hidden="true">💡</span></p>
          <button type="button" (click)="closed.emit()">Great</button>
        } @else if (hints.canSpin()) {
          <button type="button" [disabled]="spinning()" (click)="spin()">{{ spinning() ? 'Spinning…' : 'Spin' }}</button>
        } @else {
          <p class="muted">Come back tomorrow for another spin. You can also earn a hint by clearing every tenth level.</p>
          <button type="button" class="secondary" (click)="closed.emit()">Close</button>
        }
      </div>
    </app-sheet>
  `,
  styles: `
    .wrap {
      display: grid;
      gap: 0.9rem;
      justify-items: center;
      text-align: center;
    }
    h2 {
      margin: 0;
    }
    .muted {
      margin: 0;
    }
    .stage {
      position: relative;
      width: min(15rem, 70vw);
      aspect-ratio: 1;
    }
    .pointer {
      position: absolute;
      top: -6px;
      left: 50%;
      z-index: 2;
      width: 0;
      height: 0;
      transform: translateX(-50%);
      border-inline: 10px solid transparent;
      border-top: 18px solid var(--text);
    }
    .wheel {
      width: 100%;
      height: 100%;
      filter: drop-shadow(0 4px 10px rgb(0 0 0 / 0.2));
      transition: transform 3.6s cubic-bezier(0.12, 0.7, 0.1, 1);
    }
    .wheel text {
      font: 800 17px var(--font-display, inherit);
      fill: #fff;
    }
    .hub {
      fill: var(--surface);
      stroke: var(--border);
      stroke-width: 2;
    }
    .won {
      margin: 0;
      font-size: 1.6rem;
      font-weight: 800;
      animation: pop 0.5s var(--spring, ease) backwards;
    }
    @keyframes pop {
      from {
        transform: scale(0.4);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .wheel {
        transition: none;
      }
    }
  `,
})
export class HintWheel {
  protected readonly hints = inject(HintsService);
  private readonly haptics = inject(HapticsService);
  readonly closed = output<void>();

  protected readonly slices = SLICES;
  protected readonly angle = signal(0);
  protected readonly spinning = signal(false);
  protected readonly prize = signal<number | null>(null);

  protected colour(i: number): string {
    return ['#2f9e8f', '#e0952b', '#3b82c4', '#c4533b', '#7a5bc4', '#4c9a3f', '#c4417a', '#d1a21a'][i];
  }

  protected slicePath(i: number): string {
    const a0 = ((i * 45 - 90) * Math.PI) / 180;
    const a1 = (((i + 1) * 45 - 90) * Math.PI) / 180;
    const [x0, y0, x1, y1] = [Math.cos(a0) * 96, Math.sin(a0) * 96, Math.cos(a1) * 96, Math.sin(a1) * 96];
    return `M0 0 L${x0.toFixed(2)} ${y0.toFixed(2)} A96 96 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
  }

  protected spin(): void {
    const won = this.hints.spin();
    if (!won) return;
    this.spinning.set(true);
    // Land the pointer in a slice that shows the prize.
    const options = SLICES.map((v, i) => (v === won.hints ? i : -1)).filter((i) => i >= 0);
    const slice = options[Math.floor(Math.random() * options.length)];
    const target = 360 * 5 + (360 - (slice * 45 + 22.5));
    this.angle.set(target);
    const ticker = setInterval(() => this.haptics.tick(), 220);
    setTimeout(() => {
      clearInterval(ticker);
      this.spinning.set(false);
      this.prize.set(won.hints);
      this.haptics.success();
    }, 3700);
  }
}
