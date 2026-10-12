import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { nextCell, SIZE, TangoCell, TangoPuzzle } from './engine';

@Component({
  selector: 'app-tango-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap">
      <div class="grid" role="grid" aria-label="Tango board">
        @for (cell of cells(); track cell.i) {
          <button
            type="button"
            role="gridcell"
            class="cell"
            [class.given]="cell.given"
            [class.bad]="cell.bad"
            [class.win]="solved()"
            [disabled]="locked() || cell.given"
            [style.--d]="cell.delay"
            [attr.aria-label]="cell.label"
            (click)="tap(cell.i)"
          >
            @if (cell.value === 's') {
              <svg class="sun" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
              </svg>
            } @else if (cell.value === 'm') {
              <svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" /></svg>
            }
          </button>
        }
      </div>
      @for (edge of edges(); track edge.key) {
        <span class="sign" [style.left.%]="edge.x" [style.top.%]="edge.y" aria-hidden="true">{{ edge.kind === '=' ? '=' : '×' }}</span>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .wrap {
      --side: min(100%, 26rem, calc(100dvh - 21rem));
      position: relative;
      width: var(--side);
      aspect-ratio: 1;
      margin: 0 auto;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      width: 100%;
      height: 100%;
      border: 1.5px solid var(--border);
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
      transition: background-color 0.2s var(--ease);
    }
    .cell:nth-child(6n) {
      border-right: 0;
    }
    .cell:nth-child(n + 31) {
      border-bottom: 0;
    }
    .cell:hover:not(:disabled) {
      box-shadow: none;
      background: var(--surface-2);
    }
    .cell:disabled {
      opacity: 1;
      cursor: default;
    }
    .given {
      background: var(--surface-2);
    }
    .bad {
      background: color-mix(in srgb, var(--bad) 18%, var(--surface));
    }
    svg {
      width: 62%;
      height: 62%;
      animation: pop 0.26s var(--spring);
    }
    .sun {
      fill: var(--sun);
      stroke: var(--sun);
      stroke-width: 1.6;
      stroke-linecap: round;
    }
    .moon {
      fill: var(--moon);
      stroke: var(--moon);
      stroke-width: 1.2;
      stroke-linejoin: round;
    }
    .win svg {
      animation: cheer 0.6s var(--spring) both;
      animation-delay: var(--d);
    }
    .sign {
      position: absolute;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 1.35rem;
      height: 1.35rem;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: var(--surface);
      border: 1px solid var(--muted);
      color: var(--text);
      font-weight: 700;
      font-size: 0.85rem;
      line-height: 1;
      pointer-events: none;
    }
    @keyframes pop {
      from {
        transform: scale(0.4);
        opacity: 0;
      }
    }
    @keyframes cheer {
      40% {
        transform: scale(1.25) rotate(-8deg);
      }
    }
  `,
})
export class TangoBoard {
  readonly puzzle = input.required<TangoPuzzle>();
  readonly board = input.required<TangoCell[]>();
  readonly bad = input<Set<number>>(new Set());
  readonly locked = input(false);
  readonly solved = input(false);
  readonly boardChange = output<TangoCell[]>();

  protected readonly cells = computed(() => {
    const puzzle = this.puzzle();
    const bad = this.bad();
    return this.board().map((value, i) => ({
      i,
      delay: ((i % 6) + Math.floor(i / 6)) * 0.05 + 's',
      value,
      given: puzzle.givens[i] !== '.',
      bad: bad.has(i),
      label: `Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}, ${value === 's' ? 'sun' : value === 'm' ? 'moon' : 'empty'}${puzzle.givens[i] !== '.' ? ', fixed' : ''}`,
    }));
  });

  /** Signs sit on the line between the two cells they describe. */
  protected readonly edges = computed(() =>
    this.puzzle().edges.map(([a, b, kind]) => {
      const horizontal = b === a + 1;
      const x = horizontal ? ((a % SIZE) + 1) * (100 / SIZE) : ((a % SIZE) + 0.5) * (100 / SIZE);
      const y = horizontal ? (Math.floor(a / SIZE) + 0.5) * (100 / SIZE) : (Math.floor(a / SIZE) + 1) * (100 / SIZE);
      return { key: `${a}-${b}`, kind, x, y };
    }),
  );

  protected tap(index: number): void {
    const next = [...this.board()];
    next[index] = nextCell(next[index]);
    this.boardChange.emit(next);
  }
}
