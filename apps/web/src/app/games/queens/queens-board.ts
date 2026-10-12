import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { borders, isGiven, nextCell, QUEEN, MARK, QueensCell, QueensPuzzle } from './engine';

/** Region colours: hues spread around the wheel; thick outlines mean colour is never the only clue. */
const HUES = [25, 85, 145, 195, 255, 305, 345, 55, 115, 225, 280, 170];

@Component({
  selector: 'app-queens-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="defs" width="0" height="0" aria-hidden="true">
      <defs>
        <linearGradient id="crown-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffe083" />
          <stop offset="1" stop-color="#f0a21a" />
        </linearGradient>
      </defs>
    </svg>
    <div
      class="grid"
      role="grid"
      aria-label="Queens board"
      [style.--n]="puzzle().size"
      (pointerdown)="down($event)"
      (pointermove)="move($event)"
      (pointerup)="up($event)"
      (pointercancel)="cancel()"
    >
      @for (cell of cells(); track cell.i) {
        <button
          type="button"
          role="gridcell"
          class="cell"
          [class.bad]="cell.bad"
          [class.win]="solved()"
          [class.has-queen]="cell.value === QUEEN"
          [disabled]="locked() || cell.given"
          [class.given]="cell.given"
          [style.--h]="cell.hue"
          [style.--d]="cell.delay"
          [style.box-shadow]="cell.outline"
          [attr.aria-label]="cell.label"
          [attr.data-i]="cell.i"
          (click)="keyTap($event, cell.i)"
        >
          <b class="rl" aria-hidden="true">{{ cell.letter }}</b>
          @if (cell.value === QUEEN) {
            <svg class="queen" viewBox="0 0 24 24" aria-hidden="true">
              <path class="body" d="M3.2 19 2 7.5l5.2 4.3L12 4l4.8 7.8L22 7.5 20.8 19z" />
              <path class="band" d="M4 21.2h16" />
              <circle cx="12" cy="3.6" r="1.3" class="gem" />
              <circle cx="2" cy="6.6" r="1.1" class="gem" />
              <circle cx="22" cy="6.6" r="1.1" class="gem" />
            </svg>
          } @else if (cell.value === MARK) {
            <svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 7.5l9 9M16.5 7.5l-9 9" /></svg>
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .defs {
      position: absolute;
    }
    .grid {
      --line: color-mix(in srgb, var(--ink) 34%, var(--bg));
      container-type: inline-size;
      display: grid;
      grid-template-columns: repeat(var(--n), minmax(0, 1fr));
      grid-template-rows: repeat(var(--n), minmax(0, 1fr));
      width: var(--board, min(100%, 26rem));
      aspect-ratio: 1;
      margin: 0 auto;
      border: 2.5px solid var(--ink);
      border-radius: 16px;
      overflow: hidden;
      background: var(--line);
      gap: 1px;
      box-shadow: var(--shadow);
      touch-action: none; /* dragging across cells must not scroll the page */
      user-select: none;
      -webkit-user-select: none;
    }
    :host .cell {
      position: relative;
      display: grid;
      place-items: center;
      min-width: 0;
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      overflow: hidden;
      background: oklch(var(--cell-l) var(--cell-c) calc(var(--h) * 1deg));
      color: var(--text);
      transition:
        background-color 0.2s var(--ease),
        filter 0.2s var(--ease);
      touch-action: manipulation;
    }
    :host .cell:hover:not(:disabled) {
      filter: brightness(1.05);
      box-shadow: none;
    }
    :host .cell:disabled {
      opacity: 1;
      cursor: default;
    }
    /* A queen that came with the puzzle: it cannot be moved, so it wears a ring. */
    :host .given::after {
      content: '';
      position: absolute;
      inset: 10%;
      border-radius: 50%;
      border: 2px solid color-mix(in srgb, var(--ink) 55%, transparent);
      pointer-events: none;
    }
    .queen {
      width: 74%;
      height: 74%;
      overflow: visible;
      filter: drop-shadow(0 2px 2px rgb(0 0 0 / 0.28));
      animation: drop 0.42s var(--spring);
    }
    .queen .body {
      fill: url(#crown-gold);
      stroke: #6b4300;
      stroke-width: 1.2;
      stroke-linejoin: round;
    }
    .queen .band {
      stroke: #6b4300;
      stroke-width: 1.6;
      stroke-linecap: round;
    }
    .queen .gem {
      fill: #ffe083;
      stroke: #6b4300;
      stroke-width: 0.8;
    }
    /* A ring that ripples out where a queen lands. */
    .has-queen::before {
      content: '';
      position: absolute;
      inset: 18%;
      border-radius: 50%;
      border: 2px solid #f0a21a;
      opacity: 0;
      animation: ripple 0.55s var(--ease);
    }
    /* Region letters, shown in colour-blind mode so colour is never the only clue. */
    .rl {
      display: none;
      position: absolute;
      top: 3px;
      left: 5px;
      font-size: clamp(0.6rem, 3.4cqw, 0.9rem);
      font-weight: 700;
      opacity: 0.65;
      pointer-events: none;
    }
    :host-context([data-contrast='high']) .rl {
      display: block;
    }
    .mark {
      width: 50%;
      height: 50%;
      fill: none;
      stroke: var(--text);
      stroke-width: 2.6;
      stroke-linecap: round;
      opacity: 0.55;
      animation: fade 0.2s var(--spring);
    }
    .bad {
      background: color-mix(in srgb, var(--bad) 30%, oklch(var(--cell-l) var(--cell-c) calc(var(--h) * 1deg)));
    }
    .bad .queen {
      animation: shake 0.4s;
    }
    .bad .queen .body {
      stroke: var(--bad);
    }
    .win .queen {
      animation: cheer 0.7s var(--spring) both;
      animation-delay: var(--d);
    }
    @keyframes drop {
      from {
        transform: translateY(-60%) scale(0.4);
        opacity: 0;
      }
    }
    @keyframes ripple {
      from {
        inset: 30%;
        opacity: 0.9;
      }
      to {
        inset: -8%;
        opacity: 0;
      }
    }
    @keyframes fade {
      from {
        opacity: 0;
        transform: scale(0.4) rotate(-40deg);
      }
    }
    @keyframes shake {
      20%,
      60% {
        transform: translateX(-3px);
      }
      40%,
      80% {
        transform: translateX(3px);
      }
    }
    @keyframes cheer {
      40% {
        transform: translateY(-14%) scale(1.22) rotate(-6deg);
      }
      70% {
        transform: scale(0.95);
      }
    }
  `,
})
export class QueensBoard {
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
    if (isGiven(this.puzzle(), index)) return;
    this.start = index;
    this.last = index;
    this.dragged = false;
    this.erasing = this.board()[index] === MARK;
  }

  protected move(event: PointerEvent): void {
    if (this.start < 0) return;
    const index = this.cellAt(event);
    if (index < 0 || index === this.last) return;
    this.last = index;
    if (!this.dragged) {
      // The drag has really begun: it covers the cell it started on as well.
      this.dragged = true;
      this.draft.set([...this.board()]);
      this.paint(this.start);
    }
    this.paint(index);
  }

  protected up(event: PointerEvent): void {
    if (this.start < 0) return;
    const start = this.start;
    this.start = -1;
    if (!this.dragged) {
      this.tap(start);
      return;
    }
    const finished = this.draft();
    this.draft.set(null);
    if (finished && finished.some((c, i) => c !== this.board()[i])) this.boardChange.emit(finished);
    event.preventDefault();
  }

  protected cancel(): void {
    this.start = -1;
    this.dragged = false;
    this.draft.set(null);
  }

  /** Crosses only go on empty cells and only come off crosses; queens are never touched by a drag. */
  private paint(index: number): void {
    this.draft.update((board) => {
      if (!board) return board;
      const next = [...board];
      if (isGiven(this.puzzle(), index)) return next;
      if (this.erasing) {
        if (next[index] === MARK) next[index] = 0;
      } else if (next[index] === 0) next[index] = MARK;
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
    this.boardChange.emit(next);
  }
}
