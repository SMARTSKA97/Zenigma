import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, randInt, useClock } from './mind-util';

/** One tile has a slightly different shade. As you find them the grid grows and the shades get closer. */
@Component({
  selector: 'app-odd-one-out',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  templateUrl: './odd-one-out.html',
})
export class OddOneOut implements OnInit {
  readonly done = output<MindResult>();
  protected readonly score = signal(0);
  protected readonly clock = useClock(45000, () => this.done.emit({ score: this.score(), detail: `${this.score()} found in 45 seconds` }));
  protected readonly round = signal(this.make());
  protected readonly cells = () => Array.from({ length: this.round().n ** 2 }, (_, i) => i);
  protected readonly seconds = () => Math.ceil(this.clock.left() / 1000);

  ngOnInit(): void {
    this.clock.start();
  }

  protected tap(c: number): void {
    if (c === this.round().odd) this.score.update((s) => s + 1);
    else this.clock.dock(3000);
    this.round.set(this.make());
  }

  private make() {
    const s = this.score();
    const n = Math.min(7, 2 + Math.floor(s / 3));
    const hue = randInt(0, 359);
    const diff = Math.max(3, 16 - s * 0.7);
    return { n, odd: randInt(0, n * n - 1), colour: `hsl(${hue} 60% 55%)`, oddColour: `hsl(${hue} 60% ${Math.random() < 0.5 ? 55 + diff : 55 - diff}%)` };
  }
}
