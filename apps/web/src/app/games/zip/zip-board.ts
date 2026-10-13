import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';

import { cutTo, step, ZipPath, ZipPuzzle } from './engine';

@Component({
  selector: 'app-zip-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './zip-board.html',
  styleUrl: './zip-board.scss',
})
export class ZipBoard {
  private readonly haptics = inject(HapticsService);
  readonly puzzle = input.required<ZipPuzzle>();
  readonly board = input.required<ZipPath>();
  readonly bad = input<Set<number>>(new Set());
  readonly locked = input(false);
  readonly solved = input(false);
  readonly boardChange = output<ZipPath>();

  /** The path while a finger or mouse is drawing, handed over as one move when it lifts. */
  private readonly draft = signal<ZipPath | null>(null);
  private drawing = false;
  private pointer = -1;

  private readonly path = computed(() => this.draft() ?? this.board());

  /** For screen readers: the size, where each number is, and how far the path has got. */
  protected readonly description = computed(() => {
    const p = this.puzzle();
    const where = p.numbers
      .map((number, i) => (number ? { number, i } : null))
      .filter((x): x is { number: number; i: number } => x !== null)
      .sort((a, b) => a.number - b.number)
      .map((x) => `${x.number} at row ${Math.floor(x.i / p.size) + 1}, column ${(x.i % p.size) + 1}`);
    return `Zip board, ${p.size} by ${p.size}. Draw one path through every cell, reaching the numbers in order. Numbers: ${where.join('; ')}. Path covers ${this.path().length} of ${p.size * p.size} cells.`;
  });

  protected readonly cells = computed(() => {
    const puzzle = this.puzzle();
    const path = this.path();
    const on = new Set(path);
    const end = path[path.length - 1];
    return puzzle.numbers.map((number, i) => ({ i, number, on: on.has(i), head: i === end }));
  });

  protected readonly points = computed(() => {
    const n = this.puzzle().size;
    return this.path()
      .map((c) => `${(c % n) + 0.5},${Math.floor(c / n) + 0.5}`)
      .join(' ');
  });

  protected readonly head = computed(() => {
    const n = this.puzzle().size;
    const end = this.path()[this.path().length - 1];
    return end === undefined ? null : { x: (end % n) + 0.5, y: Math.floor(end / n) + 0.5 };
  });

  private cellAt(event: PointerEvent): number {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-i]');
    const value = el?.getAttribute('data-i');
    return value === null || value === undefined ? -1 : Number(value);
  }

  protected down(event: PointerEvent): void {
    if (this.locked() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    this.finish();
    const cell = this.cellAt(event);
    if (cell < 0) return;
    const path = this.board();
    // Pressing the path cuts it back to that cell; pressing next to its end steps forward.
    const next = cutTo(path, cell) ?? step(this.puzzle(), path, cell);
    this.drawing = true;
    this.pointer = event.pointerId;
    this.draft.set(next ?? path);
    if (next) this.haptics.tap();
    try {
      (event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
    } catch {
      /* dragging works without capture */
    }
  }

  protected move(event: PointerEvent): void {
    if (!this.drawing || event.pointerId !== this.pointer) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) return this.up(event);
    const cell = this.cellAt(event);
    const path = this.draft();
    if (cell < 0 || !path || cell === path[path.length - 1]) return;
    const next = step(this.puzzle(), path, cell);
    if (next) {
      this.draft.set(next);
      this.haptics.tick();
    }
  }

  protected up(event: PointerEvent): void {
    if (!this.drawing || event.pointerId !== this.pointer) return;
    this.finish();
  }

  /** Ends any drawing in progress, handing it over as a single move (so Undo takes it back in one step). */
  private finish(): void {
    const done = this.drawing ? this.draft() : null;
    this.drawing = false;
    this.draft.set(null);
    const before = this.board();
    if (done && (done.length !== before.length || done.some((c, i) => c !== before[i]))) this.boardChange.emit(done);
  }

  /** Arrow keys move the end of the path. */
  protected key(event: KeyboardEvent): void {
    if (this.locked()) return;
    const n = this.puzzle().size;
    const delta: Record<string, number> = { ArrowUp: -n, ArrowDown: n, ArrowLeft: -1, ArrowRight: 1 };
    const d = delta[event.key];
    if (d === undefined) return;
    const path = this.board();
    const end = path[path.length - 1];
    if ((event.key === 'ArrowLeft' && end % n === 0) || (event.key === 'ArrowRight' && end % n === n - 1)) return;
    const next = step(this.puzzle(), path, end + d);
    if (next) this.boardChange.emit(next);
    event.preventDefault();
  }
}

