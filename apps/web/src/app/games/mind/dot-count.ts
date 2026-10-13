import { ChangeDetectionStrategy, Component, OnInit, output, signal } from '@angular/core';
import { MindResult, randInt, shuffled, useClock, useTimers } from './mind-util';

interface Dot {
  x: number;
  y: number;
}

/** Dots flash for a second. How many were there? The flashes get busier as you go. */
@Component({
  selector: 'app-dot-count',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './mind.scss',
  templateUrl: './dot-count.html',
})
export class DotCount implements OnInit {
  readonly done = output<MindResult>();
  private readonly timers = useTimers();
  protected readonly score = signal(0);
  protected readonly bad = signal(false);
  protected readonly phase = signal<'show' | 'ask'>('show');
  protected readonly dots = signal<Dot[]>([]);
  protected readonly options = signal<number[]>([]);
  private answer = 0;
  protected readonly clock = useClock(45000, () => this.done.emit({ score: this.score(), detail: `${this.score()} counted in 45 seconds` }));
  protected readonly seconds = () => Math.ceil(this.clock.left() / 1000);

  ngOnInit(): void {
    this.clock.start();
    this.flash();
  }

  private flash(): void {
    const count = Math.min(16, 4 + Math.floor(this.score() / 2) + randInt(0, 2));
    this.answer = count;
    const dots: Dot[] = [];
    while (dots.length < count) {
      const d = { x: randInt(6, 94), y: randInt(6, 94) };
      if (dots.every((o) => Math.hypot(o.x - d.x, o.y - d.y) > 11)) dots.push(d);
      if (dots.length < count && Math.random() < 0.002) dots.length = 0; // started to run out of room: try again
    }
    this.dots.set(dots);
    const set = new Set<number>([count]);
    while (set.size < 4) set.add(Math.max(2, count + randInt(-3, 3)));
    this.options.set(shuffled([...set]));
    this.phase.set('show');
    this.timers.after(900, () => this.phase.set('ask'));
  }

  protected pick(n: number): void {
    if (this.phase() !== 'ask') return;
    if (n === this.answer) this.score.update((s) => s + 1);
    else {
      this.clock.dock(3000);
      this.bad.set(true);
      this.timers.after(300, () => this.bad.set(false));
    }
    this.flash();
  }
}
