import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, shuffled, useTimers } from './mind-util';

/** Remember which tiles lit up, then tap them from memory. The grid and the number of tiles grow. */
@Component({
  selector: 'app-grid-recall',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  templateUrl: './grid-recall.html',
})
export class GridRecall implements OnInit {
  readonly done = output<MindResult>();
  private readonly timers = useTimers();
  protected readonly level = signal(1);
  protected readonly lives = signal(3);
  protected readonly phase = signal<'show' | 'input' | 'over'>('show');
  protected readonly target = signal<Set<number>>(new Set());
  protected readonly found = signal<Set<number>>(new Set());
  protected readonly wrong = signal(-1);
  protected readonly size = signal(3);
  protected readonly cells = () => Array.from({ length: this.size() * this.size() }, (_, i) => i);

  ngOnInit(): void {
    this.start();
  }

  private start(): void {
    const level = this.level();
    const size = level <= 2 ? 3 : level <= 6 ? 4 : 5;
    this.size.set(size);
    const count = Math.min(Math.floor(size * size * 0.55), level + 2);
    this.target.set(new Set(shuffled(Array.from({ length: size * size }, (_, i) => i)).slice(0, count)));
    this.found.set(new Set());
    this.phase.set('show');
    this.timers.after(1500 + count * 120, () => this.phase.set('input'));
  }

  protected tap(c: number): void {
    if (this.phase() !== 'input' || this.found().has(c)) return;
    if (this.target().has(c)) {
      this.found.update((f) => new Set(f).add(c));
      if (this.found().size === this.target().size) {
        this.phase.set('show');
        this.timers.after(600, () => {
          this.level.update((l) => l + 1);
          this.start();
        });
      }
      return;
    }
    this.wrong.set(c);
    this.lives.update((l) => l - 1);
    this.timers.after(350, () => this.wrong.set(-1));
    if (this.lives() <= 0) {
      this.phase.set('over');
      const score = this.level() - 1;
      this.timers.after(500, () => this.done.emit({ score, detail: `You cleared ${score} ${score === 1 ? 'level' : 'levels'}` }));
    } else {
      // The same pattern again after a slip.
      this.phase.set('show');
      this.found.set(new Set());
      this.timers.after(900, () => this.phase.set('input'));
    }
  }
}
