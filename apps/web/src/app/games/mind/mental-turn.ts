import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, pick, randInt, shuffled, useClock } from './mind-util';

const N = 4;
type Cells = number[];

const rotate = (cells: Cells): Cells => cells.map((i) => (i % N) * N + (N - 1 - Math.floor(i / N))).sort((a, b) => a - b);
const mirror = (cells: Cells): Cells => cells.map((i) => Math.floor(i / N) * N + (N - 1 - (i % N))).sort((a, b) => a - b);
const same = (a: Cells, b: Cells): boolean => a.length === b.length && a.every((v, i) => v === b[i]);
const turns = (cells: Cells): Cells[] => {
  const out = [cells];
  for (let k = 1; k < 4; k++) out.push(rotate(out[k - 1]));
  return out;
};

interface Round {
  shown: Cells;
  options: { cells: Cells; right: boolean }[];
}

/** A shape is shown. Which of the three is the same shape just turned around (not flipped over)? */
@Component({
  selector: 'app-mental-turn',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  templateUrl: './mental-turn.html',
})
export class MentalTurn implements OnInit {
  readonly done = output<MindResult>();
  protected readonly grid = Array.from({ length: N * N }, (_, i) => i);
  protected readonly score = signal(0);
  protected readonly bad = signal(false);
  protected readonly clock = useClock(60000, () => this.done.emit({ score: this.score(), detail: `${this.score()} turned right in 60 seconds` }));
  protected readonly round = signal<Round>(this.make());
  protected readonly seconds = () => Math.ceil(this.clock.left() / 1000);

  ngOnInit(): void {
    this.clock.start();
  }

  protected has(cells: Cells, i: number): boolean {
    return cells.includes(i);
  }

  protected answer(right: boolean): void {
    if (right) this.score.update((s) => s + 1);
    else {
      this.clock.dock(3000);
      this.bad.set(true);
      setTimeout(() => this.bad.set(false), 300);
    }
    this.round.set(this.make());
  }

  private make(): Round {
    const size = Math.min(8, 5 + Math.floor(this.score() / 4));
    for (;;) {
      const shown = shuffled(this.grid).slice(0, size).sort((a, b) => a - b);
      const all = turns(shown);
      // A shape that looks the same turned, or flipped, makes no puzzle.
      if (all.slice(1).some((t) => same(t, shown)) || all.some((t) => same(t, mirror(shown)))) continue;
      const right = pick(all.slice(1));
      const wrongA = mirror(pick(all));
      const wrongB = mirror(pick(all.filter((t) => !same(t, shown))));
      const options = shuffled([
        { cells: right, right: true },
        { cells: wrongA, right: false },
        { cells: same(wrongA, wrongB) ? mirror(turns(shown)[randInt(1, 3)]) : wrongB, right: false },
      ]);
      return { shown, options };
    }
  }
}
