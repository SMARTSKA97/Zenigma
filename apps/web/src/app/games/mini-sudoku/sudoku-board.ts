import { ChangeDetectionStrategy, Component, computed, HostListener, input, output, signal } from '@angular/core';
import { boxOf, SIZE, SudokuPuzzle } from './engine';

@Component({
  selector: 'app-sudoku-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid" role="grid" aria-label="Mini Sudoku board">
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
          [class.win]="solved()"
          [class.box-right]="cell.boxRight"
          [class.box-bottom]="cell.boxBottom"
          [disabled]="locked()"
          [style.--d]="cell.delay"
          [attr.aria-label]="cell.label"
          (click)="select(cell.i)"
        >
          @if (cell.value) {
            <span class="digit" [class.placed]="!cell.given">{{ cell.value }}</span>
          }
        </button>
      }
    </div>

    <div class="pad" role="group" aria-label="Numbers">
      @for (n of numbers; track n) {
        <button type="button" class="key" [disabled]="locked() || selected() === null" (click)="enter(n)">{{ n }}</button>
      }
      <button type="button" class="key erase" aria-label="Erase" [disabled]="locked() || selected() === null" (click)="enter(0)">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6H9l-5 6 5 6h11zM12 9.5l5 5M17 9.5l-5 5" /></svg>
      </button>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .grid {
      --side: min(100%, 26rem, calc(100dvh - 26rem));
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      width: var(--side);
      aspect-ratio: 1;
      margin: 0 auto;
      border: 2px solid var(--ink);
      border-radius: 14px;
      overflow: hidden;
      background: var(--surface);
    }
    .cell {
      display: grid;
      place-items: center;
      min-height: 0;
      padding: 0;
      border: 0;
      border-right: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
      border-radius: 0;
      background: var(--surface);
      color: var(--text);
      font-family: var(--font-display);
      font-size: clamp(1.2rem, 6vw, 1.9rem);
      font-weight: 500;
      transition: background-color 0.15s var(--ease);
    }
    .cell:nth-child(6n) {
      border-right: 0;
    }
    .cell:nth-child(n + 31) {
      border-bottom: 0;
    }
    .cell.box-right {
      border-right: 2px solid var(--ink);
    }
    .cell.box-bottom {
      border-bottom: 2px solid var(--ink);
    }
    .cell:hover:not(:disabled) {
      box-shadow: none;
    }
    .cell:disabled {
      opacity: 1;
      cursor: default;
    }
    .peer {
      background: var(--surface-2);
    }
    .same {
      background: var(--accent-soft);
    }
    .selected {
      background: var(--accent-soft);
      box-shadow: inset 0 0 0 2.5px var(--accent) !important;
    }
    .given {
      font-weight: 700;
    }
    .digit.placed {
      color: var(--accent);
      animation: pop 0.22s var(--spring);
    }
    .bad {
      background: color-mix(in srgb, var(--bad) 18%, var(--surface));
    }
    .bad .digit {
      color: var(--bad);
    }
    .win .digit {
      animation: cheer 0.6s var(--spring) both;
      animation-delay: var(--d);
    }
    .pad {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.4rem;
      width: min(100%, 26rem);
      margin: 1rem auto 0;
    }
    .key {
      min-height: 46px;
      padding: 0;
      border-radius: 12px;
      border: 0;
      background: var(--key-bg);
      color: var(--text);
      font-family: var(--font-display);
      font-size: 1.25rem;
      box-shadow: none !important;
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
    @keyframes pop {
      from {
        transform: scale(0.5);
        opacity: 0;
      }
    }
    @keyframes cheer {
      40% {
        transform: scale(1.3);
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

  protected readonly numbers = [1, 2, 3, 4, 5, 6];
  protected readonly selected = signal<number | null>(null);

  protected readonly cells = computed(() => {
    const puzzle = this.puzzle();
    const bad = this.bad();
    const board = this.board();
    const sel = this.selected();
    const selValue = sel === null ? 0 : board[sel];
    return board.map((value, i) => ({
      i,
      delay: ((i % 6) + Math.floor(i / 6)) * 0.05 + 's',
      value,
      given: puzzle.givens[i] !== '0',
      selected: sel === i,
      peer: sel !== null && sel !== i && (Math.floor(sel / SIZE) === Math.floor(i / SIZE) || sel % SIZE === i % SIZE || boxOf(sel) === boxOf(i)),
      same: sel !== null && sel !== i && selValue !== 0 && value === selValue,
      bad: bad.has(i),
      boxRight: i % SIZE === 2,
      boxBottom: Math.floor(i / SIZE) === 1 || Math.floor(i / SIZE) === 3,
      label: `Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}, ${value ? value : 'empty'}${puzzle.givens[i] !== '0' ? ', fixed' : ''}`,
    }));
  });

  protected select(index: number): void {
    this.selected.set(index);
  }

  protected enter(value: number): void {
    const sel = this.selected();
    if (sel === null || this.locked() || this.puzzle().givens[sel] !== '0') return;
    const next = [...this.board()];
    next[sel] = next[sel] === value ? 0 : value;
    this.boardChange.emit(next);
  }

  @HostListener('window:keydown', ['$event'])
  onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey || this.locked()) return;
    if (event.key >= '1' && event.key <= '6') this.enter(Number(event.key));
    else if (event.key === 'Backspace' || event.key === 'Delete' || event.key === '0') this.enter(0);
    else if (event.key.startsWith('Arrow')) {
      const sel = this.selected() ?? 0;
      const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -SIZE, ArrowDown: SIZE }[event.key] ?? 0;
      const target = sel + delta;
      const sameRow = Math.floor(target / SIZE) === Math.floor(sel / SIZE);
      if (target >= 0 && target < SIZE * SIZE && (Math.abs(delta) === SIZE || sameRow)) this.selected.set(target);
      event.preventDefault();
    }
  }
}
