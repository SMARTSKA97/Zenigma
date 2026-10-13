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
  templateUrl: './hint-wheel.html',
  styleUrl: './hint-wheel.scss',
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
