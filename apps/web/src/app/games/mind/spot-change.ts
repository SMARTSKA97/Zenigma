import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, pick, randInt, useTimers } from './mind-util';

const COLOURS = ['#d93f3f', '#2f6fe0', '#2e9e5b', '#d8a800', '#8a4fd6', '#e07a00'];

/** A grid of colours flashes, goes blank, and comes back with one tile changed. Tap it. */
@Component({
  selector: 'app-spot-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  templateUrl: './spot-change.html',
})
export class SpotChange implements OnInit {
  readonly done = output<MindResult>();
  private readonly timers = useTimers();
  protected readonly round = signal(1);
  protected readonly lives = signal(3);
  protected readonly phase = signal<'first' | 'blank' | 'second' | 'over'>('first');
  protected readonly n = signal(3);
  protected readonly before = signal<string[]>([]);
  protected readonly after = signal<string[]>([]);
  protected readonly changed = signal(0);
  protected readonly chosen = signal(-1);
  protected readonly cells = () => this.before();

  ngOnInit(): void {
    this.start();
  }

  protected shown(i: number): string {
    const p = this.phase();
    if (p === 'blank') return 'var(--surface-2)';
    return (p === 'first' ? this.before() : this.after())[i];
  }

  private start(): void {
    const r = this.round();
    const n = r <= 3 ? 3 : r <= 8 ? 4 : 5;
    this.n.set(n);
    const colours = Array.from({ length: n * n }, () => pick(COLOURS));
    const at = randInt(0, n * n - 1);
    const next = [...colours];
    next[at] = pick(COLOURS.filter((c) => c !== colours[at]));
    this.before.set(colours);
    this.after.set(next);
    this.changed.set(at);
    this.chosen.set(-1);
    this.phase.set('first');
    this.timers.after(1800 + n * 200, () => this.phase.set('blank'));
    this.timers.after(2500 + n * 200, () => this.phase.set('second'));
  }

  protected tap(i: number): void {
    if (this.phase() !== 'second') return;
    this.chosen.set(i);
    this.phase.set('over');
    if (i === this.changed()) {
      this.timers.after(600, () => {
        this.round.update((r) => r + 1);
        this.start();
      });
      return;
    }
    this.lives.update((l) => l - 1);
    if (this.lives() <= 0) {
      const score = this.round() - 1;
      this.timers.after(1100, () => this.done.emit({ score, detail: `You spotted ${score} ${score === 1 ? 'change' : 'changes'}` }));
    } else {
      this.timers.after(1100, () => this.start());
    }
  }
}
