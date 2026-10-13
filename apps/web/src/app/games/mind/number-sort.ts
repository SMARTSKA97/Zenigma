import { ChangeDetectionStrategy, Component, OnDestroy, output, signal } from '@angular/core';
import { MindResult, randInt, shuffled, useTimers } from './mind-util';

const ROUNDS = 5;

/** Nine numbers on the board. Tap them from the smallest to the largest, as fast as you can. Five boards. */
@Component({
  selector: 'app-number-sort',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  templateUrl: './number-sort.html',
})
export class NumberSort implements OnDestroy {
  readonly done = output<MindResult>();
  private readonly timers = useTimers();
  protected readonly round = signal(1);
  protected readonly numbers = signal<number[]>(this.make());
  protected readonly tapped = signal<number[]>([]);
  protected readonly wrong = signal(-1);
  private started = Date.now();
  private penalty = 0;

  ngOnDestroy(): void {
    this.timers.clear();
  }

  private make(): number[] {
    const set = new Set<number>();
    while (set.size < 9) set.add(randInt(1, 99));
    return shuffled([...set]);
  }

  protected next(): number {
    const sorted = [...this.numbers()].sort((a, b) => a - b);
    return sorted[this.tapped().length];
  }

  protected tap(n: number): void {
    if (this.tapped().includes(n)) return;
    if (n !== this.next()) {
      this.penalty += 2000; // a wrong tap costs two seconds
      this.wrong.set(n);
      this.timers.after(300, () => this.wrong.set(-1));
      return;
    }
    this.tapped.update((t) => [...t, n]);
    if (this.tapped().length < 9) return;
    if (this.round() === ROUNDS) {
      const seconds = (Date.now() - this.started + this.penalty) / 1000;
      const score = Math.max(0, Math.round(150 - 4 * seconds));
      this.done.emit({ score, detail: `${seconds.toFixed(1)} seconds for ${ROUNDS} boards` });
      return;
    }
    this.timers.after(250, () => {
      this.round.update((r) => r + 1);
      this.numbers.set(this.make());
      this.tapped.set([]);
    });
  }
}
