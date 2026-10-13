import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';

import { borders, isGiven, nextCell, QUEEN, MARK, QueensCell, QueensPuzzle } from './engine';

/** Region colours: hues spread around the wheel; thick outlines mean colour is never the only clue. */
const HUES = [25, 85, 145, 195, 255, 305, 345, 55, 115, 225, 280, 170];

@Component({
  selector: 'app-queens-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './queens-board.html',
  styleUrl: './queens-board.scss',
})
export class QueensBoard {
  private readonly haptics = inject(HapticsService);
  readonly puzzle = input.required<QueensPuzzle>();
  readonly board = input.required<QueensCell[]>();
  readonly bad = input<Set<number>>(new Set());
  readonly locked = input(false);
  readonly solved = input(false);
  readonly boardChange = output<QueensCell[]>();

  protected readonly QUEEN = QUEEN;
  protected readonly MARK = MARK;

  protected readonly cells = computed(() => {
    const puzzle = this.puzzle();
    const board = this.draft() ?? this.board();
    const bad = this.bad();
    return board.map((value, i) => {
      const b = borders(puzzle, i);
      const sides: string[] = [];
      // Region outlines: an inset line on every side that borders another region.
      if (b.top) sides.push('inset 0 2px 0 0 var(--ink)');
      if (b.bottom) sides.push('inset 0 -2px 0 0 var(--ink)');
      if (b.left) sides.push('inset 2px 0 0 0 var(--ink)');
      if (b.right) sides.push('inset -2px 0 0 0 var(--ink)');
      const row = Math.floor(i / puzzle.size) + 1;
      const col = (i % puzzle.size) + 1;
      return {
        i,
        delay: ((i % puzzle.size) + Math.floor(i / puzzle.size)) * 0.04 + 's',
        value,
        given: isGiven(puzzle, i),
        bad: bad.has(i),
        hue: HUES[puzzle.regions[i] % HUES.length],
        letter: String.fromCharCode(65 + puzzle.regions[i]),
        outline: sides.join(', ') || 'none',
        label: `Row ${row}, column ${col}, ${value === QUEEN ? (isGiven(puzzle, i) ? 'queen, fixed' : 'queen') : value === MARK ? 'marked' : 'empty'}`,
      };
    });
  });

  /** The board while a finger or mouse is dragging, before the whole drag is handed over as one move. */
  private readonly draft = signal<QueensCell[] | null>(null);
  private start = -1;
  /** The pointer that began the drag; other fingers are ignored. */
  private pointer = -1;
  private last = -1;
  private dragged = false;
  /** What the drag does: put crosses on empty cells, or (when it began on a cross) take crosses away. */
  private erasing = false;

  private cellAt(event: PointerEvent): number {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-i]');
    const value = el?.getAttribute('data-i');
    return value === null || value === undefined ? -1 : Number(value);
  }

  protected down(event: PointerEvent): void {
    if (this.locked() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const index = this.cellAt(event);
    if (index < 0) return;
    this.finish(); // never carry a half-finished drag over (a lost pointerup would otherwise leave the board stuck)
    if (isGiven(this.puzzle(), index)) return;
    this.start = index;
    this.pointer = event.pointerId;
    this.last = index;
    this.dragged = false;
    this.erasing = this.board()[index] === MARK;
  }

  protected move(event: PointerEvent): void {
    if (this.start < 0 || event.pointerId !== this.pointer) return;
    // A mouse button released outside the board never reports pointerup here: stop the drag instead of painting on hover.
    if (event.pointerType === 'mouse' && event.buttons === 0) return this.up(event);
    const index = this.cellAt(event);
    if (index < 0 || index === this.last) return;
    this.last = index;
    if (!this.dragged) {
      // The drag has really begun: it covers the cell it started on as well.
      this.dragged = true;
      try {
        (event.currentTarget as HTMLElement | null)?.setPointerCapture(event.pointerId);
      } catch {
        /* capture is a nicety; dragging works without it */
      }
      this.draft.set([...this.board()]);
      this.paint(this.start);
    }
    this.paint(index);
  }

  protected up(event: PointerEvent): void {
    if (this.start < 0 || event.pointerId !== this.pointer) return;
    const start = this.start;
    const wasDrag = this.dragged;
    this.finish();
    if (!wasDrag && event.type === 'pointerup') this.tap(start);
  }

  /** Ends any drag in progress, handing a finished one over as a single move (so Undo takes it back in one step). */
  private finish(): void {
    const finished = this.dragged ? this.draft() : null;
    this.start = -1;
    this.last = -1;
    this.dragged = false;
    this.draft.set(null);
    if (finished && finished.some((c, i) => c !== this.board()[i])) this.boardChange.emit(finished);
  }

  /** Crosses only go on empty cells and only come off crosses; queens are never touched by a drag. */
  private paint(index: number): void {
    this.draft.update((board) => {
      if (!board) return board;
      const next = [...board];
      if (isGiven(this.puzzle(), index)) return next;
      if (this.erasing) {
        if (next[index] === MARK) {
          next[index] = 0;
          this.haptics.tick();
        }
      } else if (next[index] === 0) {
        next[index] = MARK;
        this.haptics.tick();
      }
      return next;
    });
  }

  /** Keyboard (Enter or Space) clicks have no pointer; pointer taps are handled above. */
  protected keyTap(event: MouseEvent, index: number): void {
    if (event.detail === 0) this.tap(index);
  }

  protected tap(index: number): void {
    if (this.locked() || isGiven(this.puzzle(), index)) return;
    const next = [...this.board()];
    next[index] = nextCell(next[index]);
    if (next[index] === QUEEN) this.haptics.place();
    else if (next[index] === MARK) this.haptics.tap();
    else this.haptics.tick();
    this.boardChange.emit(next);
  }
}
