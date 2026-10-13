import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, pick, randInt, useClock } from './mind-util';

interface Puzzle {
  numbers: number[];
  target: number;
}

type Op = '+' | '−' | '×';

/** Combine two numbers at a time until one is left. Make the target. */
@Component({
  selector: 'app-target-number',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './target-number.html',
  styleUrls: ['./mind.scss', './target-number.scss'],
})
export class TargetNumber implements OnInit {
  readonly done = output<MindResult>();
  protected readonly ops: Op[] = ['+', '−', '×'];
  protected readonly score = signal(0);
  protected readonly bad = signal(false);
  protected readonly clock = useClock(90000, () => this.done.emit({ score: this.score(), detail: `${this.score()} targets in 90 seconds` }));
  protected readonly puzzle = signal<Puzzle>(this.make());
  protected readonly current = signal<number[]>([]);
  protected readonly first = signal(-1);
  protected readonly op = signal<Op | null>(null);
  protected readonly seconds = () => Math.ceil(this.clock.left() / 1000);

  ngOnInit(): void {
    this.reset();
    this.clock.start();
  }

  protected reset(): void {
    this.current.set([...this.puzzle().numbers]);
    this.first.set(-1);
    this.op.set(null);
  }

  protected skip(): void {
    this.clock.dock(5000);
    this.puzzle.set(this.make());
    this.reset();
  }

  /** Tap a number, an operation, then a second number. The pair is replaced by the result. */
  protected choose(i: number): void {
    const f = this.first();
    if (f < 0) {
      this.first.set(i);
      return;
    }
    if (f === i) {
      this.first.set(-1);
      return;
    }
    const op = this.op();
    if (!op) return;
    const a = this.current()[f];
    const b = this.current()[i];
    const result = op === '+' ? a + b : op === '−' ? a - b : a * b;
    const rest = this.current().filter((_, k) => k !== f && k !== i);
    this.current.set([...rest, result]);
    this.first.set(-1);
    this.op.set(null);
    if (this.current().length === 1) {
      if (this.current()[0] === this.puzzle().target) {
        this.score.update((s) => s + 1);
        this.puzzle.set(this.make());
      } else {
        this.bad.set(true);
        setTimeout(() => this.bad.set(false), 300);
      }
      this.reset();
    }
  }

  private make(): Puzzle {
    for (;;) {
      const numbers = Array.from({ length: 4 }, () => randInt(1, 9));
      // Work a few random steps forward so the target is always reachable.
      let pool = [...numbers];
      while (pool.length > 1) {
        const i = randInt(0, pool.length - 1);
        let j = randInt(0, pool.length - 1);
        while (j === i) j = randInt(0, pool.length - 1);
        const a = pool[i];
        const b = pool[j];
        const v = pick<Op>(['+', '−', '×']) === '+' ? a + b : Math.random() < 0.5 ? a * b : Math.abs(a - b);
        pool = [...pool.filter((_, k) => k !== i && k !== j), v];
      }
      const target = pool[0];
      if (target >= 5 && target <= 99 && !numbers.includes(target)) return { numbers, target };
    }
  }
}
