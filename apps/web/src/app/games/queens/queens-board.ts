import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { borders, nextCell, QUEEN, MARK, QueensCell, QueensPuzzle } from './engine';

/** Region colours: hues spread around the wheel; the thick outlines mean colour is never the only clue. */
const HUES = [25, 85, 145, 195, 255, 305, 345, 55, 115, 225, 280, 170];

@Component({
  selector: 'app-queens-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid" role="grid" aria-label="Queens board" [style.--n]="puzzle().size">
      @for (cell of cells(); track cell.i) {
        <button
          type="button"
          role="gridcell"
          class="cell"
          [class.bad]="cell.bad"
          [class.win]="solved()"
          [disabled]="locked()"
          [style.--h]="cell.hue"
          [style.--d]="cell.delay"
          [style.box-shadow]="cell.outline"
          [attr.aria-label]="cell.label"
          (click)="tap(cell.i)"
        >
          @if (cell.value === QUEEN) {
            <svg class="queen" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 18.5l-1-11 5 4 4.5-7 4.5 7 5-4-1 11z" /><path d="M4.5 21h15" /></svg>
          } @else if (cell.value === MARK) {
            <svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" /></svg>
          }
        </button>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .grid {
      --side: min(100%, 26rem, calc(100dvh - 21rem));
      display: grid;
      grid-template-columns: repeat(var(--n), 1fr);
      width: var(--side);
      aspect-ratio: 1;
      margin: 0 auto;
      border-radius: 14px;
      overflow: hidden;
      --line: color-mix(in srgb, var(--ink) 78%, var(--bg));
      background: var(--line);
      padding: 2px;
      gap: 0;
    }
    .cell {
      position: relative;
      display: grid;
      place-items: center;
      min-height: 0;
      padding: 0;
      border: 0;
      border-radius: 0;
      background: oklch(var(--cell-l) var(--cell-c) calc(var(--h) * 1deg));
      color: var(--text);
      font: inherit;
      transition: background-color 0.2s var(--ease);
      -webkit-tap-highlight-color: transparent;
    }
    .cell:hover:not(:disabled) {
      box-shadow: none;
      filter: brightness(1.04);
    }
    .cell:disabled {
      opacity: 1;
      cursor: default;
    }
    .queen {
      width: 66%;
      height: 66%;
      fill: var(--ink);
      stroke: var(--ink);
      stroke-width: 1.5;
      stroke-linejoin: round;
      stroke-linecap: round;
      animation: drop 0.28s var(--spring);
    }
    .mark {
      width: 38%;
      height: 38%;
      fill: none;
      stroke: var(--text);
      stroke-width: 2.4;
      stroke-linecap: round;
      opacity: 0.45;
      animation: fade 0.18s var(--ease);
    }
    .bad .queen {
      fill: var(--bad);
      stroke: var(--bad);
      animation: shake 0.35s;
    }
    .bad {
      background: color-mix(in srgb, var(--bad) 22%, oklch(var(--cell-l) var(--cell-c) calc(var(--h) * 1deg)));
    }
    .win .queen {
      animation: cheer 0.6s var(--spring) both;
      animation-delay: var(--d);
    }
    @keyframes drop {
      from {
        transform: translateY(-40%) scale(0.5);
        opacity: 0;
      }
    }
    @keyframes fade {
      from {
        opacity: 0;
        transform: scale(0.6);
      }
    }
    @keyframes shake {
      25% {
        transform: translateX(-3px);
      }
      75% {
        transform: translateX(3px);
      }
    }
    @keyframes cheer {
      40% {
        transform: scale(1.25) rotate(-6deg);
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
    const board = this.board();
    const bad = this.bad();
    return board.map((value, i) => {
      const b = borders(puzzle, i);
      const sides: string[] = [];
      // The "region edge" is drawn as an inset line on each side that borders another region (or the board edge).
      if (b.top) sides.push('inset 0 2px 0 0 var(--line)');
      if (b.bottom) sides.push('inset 0 -2px 0 0 var(--line)');
      if (b.left) sides.push('inset 2px 0 0 0 var(--line)');
      if (b.right) sides.push('inset -2px 0 0 0 var(--line)');
      const row = Math.floor(i / puzzle.size) + 1;
      const col = (i % puzzle.size) + 1;
      return {
        i,
        delay: ((i % puzzle.size) + Math.floor(i / puzzle.size)) * 0.04 + 's',
        value,
        bad: bad.has(i),
        hue: HUES[puzzle.regions[i] % HUES.length],
        outline: sides.join(', ') || 'none',
        label: `Row ${row}, column ${col}, ${value === QUEEN ? 'queen' : value === MARK ? 'marked' : 'empty'}`,
      };
    });
  });

  protected tap(index: number): void {
    const next = [...this.board()];
    next[index] = nextCell(next[index]);
    this.boardChange.emit(next);
  }
}
