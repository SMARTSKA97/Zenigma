import { ChangeDetectionStrategy, Component, computed, HostListener, input, output, signal } from '@angular/core';
import { boxOf, boxShape, sizeOf, SudokuPuzzle } from './engine';

@Component({
  selector: 'app-sudoku-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid" role="grid" aria-label="Sudoku board" [class.mini]="size() === 6" [style.--n]="size()">
      @for (cell of cells(); track cell.i) {
        <button
          type="button"
          role="gridcell"
          class="cell"
          [class.given]="cell.given"
          [class.selected]="cell.selected"
          [class.peer]="cell.peer"
          [class.same]="cell.same"
          [class.bad]="cell.bad"
          [class.flash]="cell.flash"
          [class.win]="solved()"
          [class.box-left]="cell.boxLeft"
          [class.box-top]="cell.boxTop"
          [disabled]="locked()"
          [style.--d]="cell.delay"
          [attr.aria-label]="cell.label"
          (click)="select(cell.i)"
        >
          @if (cell.value) {
            <span class="digit" [class.placed]="!cell.given">{{ cell.value }}</span>
          } @else if (cell.notes.length) {
            <span class="notes" aria-hidden="true">
              @for (n of cell.notes; track $index) {
                <i>{{ n }}</i>
              }
            </span>
          }
        </button>
      }
    </div>

    <div class="controls">
    <div class="mode">
      <button type="button" class="notes-toggle" [class.on]="noteMode()" [attr.aria-pressed]="noteMode()" (click)="noteMode.set(!noteMode())">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z" /></svg>
        Notes {{ noteMode() ? 'on' : 'off' }}
      </button>
    </div>

    <div class="pad" role="group" aria-label="Numbers">
      @for (n of numbers(); track n) {
        <button type="button" class="key" [class.spent]="counts()[n] >= size()" [disabled]="locked() || selected() === null" (click)="enter(n)">
          {{ n }}
          <i class="left" aria-hidden="true">{{ size() - counts()[n] }}</i>
        </button>
      }
      <button type="button" class="key erase" aria-label="Erase" [disabled]="locked() || selected() === null" (click)="enter(0)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6H9l-5 6 5 6h11zM12 9.5l5 5M17 9.5l-5 5" /></svg>
      </button>
    </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .controls {
      display: contents;
    }
    @media (min-width: 900px) {
      :host {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 13rem;
        gap: 1.5rem;
        align-items: center;
      }
      .controls {
        display: block;
      }
      .controls .mode {
        margin: 0 0 0.75rem;
        justify-content: flex-start;
      }
      .controls .pad {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        width: 100%;
        margin: 0;
      }
    }
    .grid {
      --line: color-mix(in srgb, var(--ink) 22%, var(--bg));
      container-type: inline-size;
      display: grid;
      grid-template-columns: repeat(var(--n, 9), minmax(0, 1fr));
      grid-template-rows: repeat(var(--n, 9), minmax(0, 1fr));
      gap: 1px;
      width: var(--board, min(100%, 26rem));
      aspect-ratio: 1;
      margin: 0 auto;
      border: 2.5px solid var(--ink);
      border-radius: 16px;
      overflow: hidden;
      background: var(--line);
      box-shadow: var(--shadow);
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
      background: var(--surface);
      color: var(--text);
      font-family: var(--font-display);
      font-size: clamp(1rem, 6.4cqw, 2.4rem);
      font-weight: 500;
      letter-spacing: 0;
      transition: background-color 0.15s var(--ease);
      touch-action: manipulation;
    }
    /* The mini grid has bigger cells, so bigger digits. */
    :host .mini .cell {
      font-size: clamp(1.3rem, 9.6cqw, 3.4rem);
    }
    :host .mini .notes {
      font-size: clamp(0.6rem, 3.6cqw, 1.2rem);
    }
    /* Box borders: a thicker line where a 3 by 3 box starts. */
    :host .cell.box-left {
      box-shadow: inset 2px 0 0 0 var(--ink);
    }
    :host .cell.box-top {
      box-shadow: inset 0 2px 0 0 var(--ink);
    }
    :host .cell.box-left.box-top {
      box-shadow:
        inset 2px 0 0 0 var(--ink),
        inset 0 2px 0 0 var(--ink);
    }
    :host .cell:hover:not(:disabled) {
      filter: brightness(0.97);
    }
    :host .cell:disabled {
      opacity: 1;
      cursor: default;
    }
    :host .peer {
      background: var(--surface-2);
    }
    :host .same {
      background: var(--accent-soft);
    }
    :host .selected {
      background: var(--accent-soft);
      z-index: 1;
      animation: select 0.25s var(--spring);
    }
    :host .selected::before {
      content: '';
      position: absolute;
      inset: 0;
      border: 2.5px solid var(--accent);
      border-radius: 5px;
      pointer-events: none;
    }
    .given {
      font-weight: 700;
    }
    .digit {
      line-height: 1;
    }
    .digit.placed {
      color: var(--accent);
      animation: pop 0.3s var(--spring);
    }
    .notes {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      width: 92%;
      height: 92%;
      font-family: var(--font-body);
      font-size: clamp(0.45rem, 2.5cqw, 0.9rem);
      font-weight: 600;
      color: var(--muted);
      i {
        display: grid;
        place-items: center;
        font-style: normal;
        line-height: 1;
      }
    }
    :host .bad {
      background: color-mix(in srgb, var(--bad) 20%, var(--surface));
    }
    .bad .digit {
      color: var(--bad);
      animation: shake 0.4s;
    }
    :host .flash {
      animation: flash 0.7s var(--ease);
      animation-delay: var(--d);
    }
    .win .digit {
      animation: cheer 0.7s var(--spring) both;
      animation-delay: var(--d);
    }
    .mode {
      display: flex;
      justify-content: center;
      margin-top: 0.85rem;
    }
    :host .notes-toggle {
      min-height: 36px;
      padding: 0.3rem 1rem;
      gap: 0.45rem;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0;
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border);
      box-shadow: none;
    }
    :host .notes-toggle.on {
      background: var(--accent-soft);
      border-color: var(--accent);
      color: var(--accent);
    }
    .notes-toggle svg {
      width: 16px;
      height: 16px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    .pad {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 0.45rem;
      width: var(--board, min(100%, 26rem));
      margin: 0.7rem auto 0;
    }
    :host .key {
      position: relative;
      min-width: 0;
      min-height: 50px;
      padding: 0;
      border-radius: 14px;
      border: 0;
      background: var(--key-bg);
      color: var(--text);
      font-family: var(--font-display);
      font-size: 1.4rem;
      font-weight: 550;
      letter-spacing: 0;
      box-shadow: none;
    }
    :host .key:disabled {
      opacity: 0.4;
    }
    :host .key.spent {
      opacity: 0.3;
    }
    .key .left {
      position: absolute;
      right: 7px;
      bottom: 4px;
      font-family: var(--font-body);
      font-size: 0.62rem;
      font-style: normal;
      font-weight: 600;
      color: var(--muted);
    }
    .key svg {
      width: 22px;
      height: 22px;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linejoin: round;
      stroke-linecap: round;
    }
    @keyframes select {
      from {
        transform: scale(0.9);
      }
    }
    @keyframes pop {
      from {
        transform: scale(0.3);
        opacity: 0;
      }
      60% {
        transform: scale(1.2);
      }
    }
    @keyframes shake {
      20%,
      60% {
        transform: translateX(-2px);
      }
      40%,
      80% {
        transform: translateX(2px);
      }
    }
    @keyframes flash {
      40% {
        background: color-mix(in srgb, var(--good) 35%, var(--surface));
      }
    }
    @keyframes cheer {
      40% {
        transform: scale(1.35);
      }
      70% {
        transform: scale(0.95);
      }
    }
  `,
})
export class SudokuBoard {
  readonly puzzle = input.required<SudokuPuzzle>();
  readonly board = input.required<number[]>();
  readonly bad = input<Set<number>>(new Set());
  readonly locked = input(false);
  readonly solved = input(false);
  readonly boardChange = output<number[]>();

  protected readonly size = computed(() => sizeOf(this.puzzle().givens.length));
  protected readonly numbers = computed(() => Array.from({ length: this.size() }, (_, i) => i + 1));
  protected readonly selected = signal<number | null>(null);
  protected readonly noteMode = signal(false);
  /** Pencil marks: a bitmask of candidate digits for each cell. They stay on this screen and are not part of the answer. */
  private readonly notes = signal<Record<number, number>>({});

  /** How many of each digit are on the board (so the keypad can show what is left). */
  protected readonly counts = computed(() => {
    const counts = new Array(10).fill(0);
    for (const v of this.board()) counts[v]++;
    return counts;
  });

  /** Cells in a row, column or box that is full with no repeats; they flash once as it completes. */
  private readonly completed = computed(() => {
    const board = this.board();
    const SIZE = this.size();
    const done = new Set<number>();
    const units: number[][] = [];
    for (let k = 0; k < SIZE; k++) {
      units.push(Array.from({ length: SIZE }, (_, j) => k * SIZE + j));
      units.push(Array.from({ length: SIZE }, (_, j) => j * SIZE + k));
    }
    for (let b = 0; b < SIZE; b++) units.push(Array.from({ length: SIZE * SIZE }, (_, i) => i).filter((i) => boxOf(i, SIZE) === b));
    for (const unit of units) {
      const values = unit.map((i) => board[i]);
      if (!values.includes(0) && new Set(values).size === SIZE) unit.forEach((i) => done.add(i));
    }
    return done;
  });

  protected readonly cells = computed(() => {
    const puzzle = this.puzzle();
    const SIZE = this.size();
    const [bh, bw] = boxShape(SIZE);
    const bad = this.bad();
    const board = this.board();
    const sel = this.selected();
    const done = this.completed();
    const notes = this.notes();
    const selValue = sel === null ? 0 : board[sel];
    return board.map((value, i) => ({
      i,
      delay: ((i % SIZE) + Math.floor(i / SIZE)) * 0.03 + 's',
      value,
      notes: value || !notes[i] ? [] : this.numbers().map((n) => (notes[i] & (1 << n) ? String(n) : '')),
      given: puzzle.givens[i] !== '0',
      selected: sel === i,
      peer: sel !== null && sel !== i && (Math.floor(sel / SIZE) === Math.floor(i / SIZE) || sel % SIZE === i % SIZE || boxOf(sel, SIZE) === boxOf(i, SIZE)),
      same: sel !== null && sel !== i && selValue !== 0 && value === selValue,
      bad: bad.has(i),
      flash: done.has(i) && !this.solved(),
      boxLeft: i % SIZE !== 0 && (i % SIZE) % bw === 0,
      boxTop: Math.floor(i / SIZE) % bh === 0 && i >= SIZE,
      label: `Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}, ${value ? value : 'empty'}${puzzle.givens[i] !== '0' ? ', fixed' : ''}`,
    }));
  });

  protected select(index: number): void {
    this.selected.set(index);
  }

  protected enter(value: number): void {
    const sel = this.selected();
    if (sel === null || this.locked() || this.puzzle().givens[sel] !== '0') return;

    if (this.noteMode() && value !== 0) {
      if (this.board()[sel] !== 0) return; // notes only go in empty cells
      this.notes.update((n) => ({ ...n, [sel]: (n[sel] ?? 0) ^ (1 << value) }));
      return;
    }

    const next = [...this.board()];
    next[sel] = next[sel] === value ? 0 : value;
    this.boardChange.emit(next);

    this.notes.update((n) => {
      const out = { ...n };
      delete out[sel];
      if (next[sel] !== 0) {
        // A placed number can no longer be a candidate anywhere it can see.
        const SIZE = this.size();
        for (let i = 0; i < SIZE * SIZE; i++) {
          if (out[i] === undefined) continue;
          const sees = Math.floor(i / SIZE) === Math.floor(sel / SIZE) || i % SIZE === sel % SIZE || boxOf(i, SIZE) === boxOf(sel, SIZE);
          if (sees) out[i] &= ~(1 << next[sel]);
        }
      }
      return out;
    });
  }

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || this.locked()) return;
    if (event.key >= '1' && event.key <= String(this.size())) this.enter(Number(event.key));
    else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') this.enter(0);
    else if (event.key === 'n' || event.key === 'N') this.noteMode.set(!this.noteMode());
    else if (event.key.startsWith('Arrow')) {
      const SIZE = this.size();
      const sel = this.selected() ?? 0;
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -SIZE, ArrowDown: SIZE }[event.key] ?? 0;
      const target = sel + delta;
      const sameRow = Math.floor(target / SIZE) === Math.floor(sel / SIZE);
      if (target >= 0 && target < SIZE * SIZE && (Math.abs(delta) === SIZE || sameRow)) this.selected.set(target);
      event.preventDefault();
    }
  }
}
