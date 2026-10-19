import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal } from '@angular/core';
import { cellClasses, parseCell } from './cell';
import { Demo, demoFor } from './demo-data';

/** How long a frame stays up: long enough to read what it says. */
const frameMs = (say: string, when?: string): number => Math.max(3200, (say.length + (when?.length ?? 0)) * 55);

/**
 * A short animated demo of a game on a small dummy board, like a video that runs inside the app (so it works offline and costs
 * no download). It plays by itself, a finger moves to the cells being used, and what to do in tricky situations is called out.
 * Pause, step back and forward, or replay. With reduced motion on, it starts paused and moves nothing by itself.
 */
@Component({
  selector: 'app-demo-player',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './demo-player.html',
  styleUrl: './demo-player.scss',
})
export class DemoPlayer {
  readonly game = input.required<string>();
  /** The accent colour of the game (an OKLCH hue). */
  readonly hue = input(160);

  private readonly destroy = inject(DestroyRef);
  private timer?: ReturnType<typeof setTimeout>;
  private readonly calm = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  protected readonly demo = computed<Demo | null>(() => demoFor(this.game()));
  protected readonly index = signal(0);
  protected readonly playing = signal(!this.calm);
  protected readonly frame = computed(() => this.demo()?.frames[this.index()] ?? null);
  protected readonly count = computed(() => this.demo()?.frames.length ?? 0);
  protected readonly cols = computed(() => Math.max(1, ...(this.frame()?.rows.map((r) => r.length) ?? [1])));
  /** The cells in reading order: a short row is padded so the columns line up, and a lone cell stretches across the board. */
  protected readonly cells = computed(() => {
    const cols = this.cols();
    return (this.frame()?.rows ?? []).flatMap((row) =>
      row.length === 1 && cols > 1
        ? [{ cell: row[0], span: true, blank: false }]
        : [...row.map((cell) => ({ cell, span: false, blank: false })), ...Array.from({ length: cols - row.length }, () => ({ cell: '', span: false, blank: true }))],
    );
  });
  /** The "If … → do …" callout, split into the situation and the action. */
  protected readonly advice = computed(() => {
    const w = this.frame()?.when;
    if (!w) return null;
    const [situation, action] = w.split('→').map((x) => x.trim());
    return action ? { situation, action } : { situation: '', action: situation };
  });
  /** Where the finger is, in percent of the board (its centre is on a cell). */
  protected readonly finger = computed(() => {
    const f = this.frame();
    if (!f?.point) return null;
    const rows = f.rows.length;
    const cols = this.cols();
    const at = (p: [number, number]) => ({ x: ((p[1] + 0.5) / cols) * 100, y: ((p[0] + 0.5) / rows) * 100 });
    return { from: at(f.point), to: f.to ? at(f.to) : at(f.point), drag: !!f.to };
  });
  /** A moment after the frame appears the finger moves to where it is going (so the move is seen). */
  protected readonly moved = signal(false);

  constructor() {
    effect(() => {
      this.index();
      this.playing();
      this.moved.set(false);
      clearTimeout(this.timer);
      const f = this.frame();
      if (!f) return;
      setTimeout(() => this.moved.set(true), 650);
      if (this.playing()) {
        this.timer = setTimeout(() => (this.index() + 1 < this.count() ? this.index.update((i) => i + 1) : this.playing.set(false)), frameMs(f.say, f.when));
      }
    });
    this.destroy.onDestroy(() => clearTimeout(this.timer));
  }

  protected text(cell: string): string {
    return parseCell(cell).text;
  }

  protected classes(cell: string): string {
    return cellClasses(cell);
  }

  protected toggle(): void {
    if (!this.playing() && this.index() + 1 >= this.count()) this.index.set(0);
    this.playing.update((p) => !p);
  }

  protected go(i: number): void {
    this.index.set(Math.max(0, Math.min(this.count() - 1, i)));
  }

  protected replay(): void {
    this.index.set(0);
    this.playing.set(true);
  }
}
