import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { between, covers, overlap, PatchesClue, PatchesPuzzle, place, Rect, rectAt, removeAt } from './engine';

@Component({
  selector: 'app-patches-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './patches-board.html',
  styleUrl: './patches-board.scss',
})
export class PatchesBoard {
  private readonly haptics = inject(HapticsService);
  readonly puzzle = input.required<PatchesPuzzle>();
  readonly board = input.required<Rect[]>();
  readonly bad = input<Set<number>>(new Set());
  readonly locked = input(false);
  readonly solved = input(false);
  readonly boardChange = output<Rect[]>();

  /** The rectangle being dragged, shown until the finger lifts. */
  private readonly draft = signal<Rect | null>(null);
  private from = -1;
  private last = -1;
  private pointer = -1;
  private moved = false;
  /** True while the pointer is over a spot the rectangle cannot grow into (it would run into another one). */
  protected readonly blocked = signal(false);

  /** For screen readers: the size, each clue (its cell, area and shape) and how many rectangles are drawn. */
  protected readonly description = computed(() => {
    const p = this.puzzle();
    const shape = ['', ', wide', ', tall', ', square'];
    const clues = p.clues.map((c) => `row ${Math.floor(c[0] / p.size) + 1}, column ${(c[0] % p.size) + 1}: area ${c[1]}${shape[c[2]] ?? ''}`);
    return `Patches board, ${p.size} by ${p.size}. Drag across cells to draw a rectangle; each holds one clue and has that area. Tap a rectangle to remove it. Clues: ${clues.join('; ')}. ${this.board().length} of ${p.clues.length} rectangles drawn.`;
  });

  protected readonly cells = computed(() => {
    const p = this.puzzle();
    const rects = this.board();
    const byCell = new Map<number, PatchesClue>(p.clues.map((c) => [c[0], c]));
    return Array.from({ length: p.size * p.size }, (_, i) => ({ i, clue: byCell.get(i) ?? null, covered: rects.some((r) => covers(r, p.size, i)) }));
  });

  protected readonly shown = computed(() => {
    const p = this.puzzle();
    const n = p.size;
    const bad = this.bad();
    const list = this.board().map((r) => ({ r, draft: false }));
    const d = this.draft();
    if (d) list.push({ r: d, draft: true });
    return list.map(({ r, draft }) => {
      // The colour follows the clue inside, so it stays put while other rectangles change.
      const clue = p.clues.findIndex(([cell]) => covers(r, n, cell));
      const first = r[0] * n + r[1];
      return {
        key: `${r.join(',')}${draft ? 'd' : ''}`,
        draft,
        bad: !draft && bad.has(first),
        hue: (200 + (clue < 0 ? 5 : clue) * 53) % 360,
        top: (r[0] / n) * 100,
        left: (r[1] / n) * 100,
        width: ((r[3] - r[1] + 1) / n) * 100,
        height: ((r[2] - r[0] + 1) / n) * 100,
      };
    });
  });

  private cellAt(event: PointerEvent): number {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-i]');
    const value = el?.getAttribute('data-i');
    return value === null || value === undefined ? -1 : Number(value);
  }

  protected down(event: PointerEvent): void {
    if (this.locked() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const cell = this.cellAt(event);
    if (cell < 0) return;
    this.from = this.last = cell;
    this.pointer = event.pointerId;
    this.moved = false;
    this.blocked.set(false);
    try {
      (event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
    } catch {
      /* dragging works without capture */
    }
  }

  protected move(event: PointerEvent): void {
    if (this.from < 0 || event.pointerId !== this.pointer) return;
    if (event.pointerType === 'mouse' && event.buttons === 0) return this.up(event);
    const cell = this.cellAt(event);
    if (cell < 0 || cell === this.last) return;
    this.last = cell;
    this.moved = true;
    // A drag never covers another rectangle: starting on one does nothing, and growing into one stops at it.
    // (The earlier rectangle is only ever taken away by tapping it.)
    if (rectAt(this.board(), this.puzzle().size, this.from)) return;
    const next = between(this.puzzle().size, this.from, cell);
    if (this.board().some((r) => overlap(r, next))) {
      if (!this.blocked()) this.haptics.error();
      this.blocked.set(true);
      return;
    }
    this.blocked.set(false);
    this.draft.set(next);
    this.haptics.tick();
  }

  protected up(event: PointerEvent): void {
    if (this.from < 0 || event.pointerId !== this.pointer) return;
    const size = this.puzzle().size;
    const rects = this.board();
    const start = this.from;
    const drawn = this.draft();
    this.from = -1;
    this.draft.set(null);
    this.blocked.set(false);
    if (!this.moved) {
      // A tap: take away the rectangle on that cell, or drop a single cell where there is none.
      if (rectAt(rects, size, start)) {
        this.haptics.tap();
        this.boardChange.emit(removeAt(rects, size, start));
      } else {
        this.haptics.place();
        this.boardChange.emit(place(rects, [Math.floor(start / size), start % size, Math.floor(start / size), start % size]));
      }
      return;
    }
    if (drawn) {
      this.haptics.place();
      this.boardChange.emit(place(rects, drawn));
    }
  }
}
