import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';

import { nextCell, SIZE, TangoCell, TangoPuzzle } from './engine';

@Component({
  selector: 'app-tango-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg class="defs" width="0" height="0" aria-hidden="true">
      <defs>
        <radialGradient id="sun-core" cx="40%" cy="35%" r="70%">
          <stop offset="0" stop-color="#ffe083" />
          <stop offset="1" stop-color="#f08a12" />
        </radialGradient>
        <linearGradient id="moon-body" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stop-color="#9aa7ff" />
          <stop offset="1" stop-color="#4f5fe0" />
        </linearGradient>
      </defs>
    </svg>
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
            [attr.data-i]="cell.i"
            (click)="tap(cell.i)"
          >
            @if (cell.value === 's') {
              <svg class="sun" viewBox="0 0 48 48" aria-hidden="true">
                <g class="rays">
                  @for (a of rays; track a) {
                    <rect x="22" y="2.5" width="4" height="8" rx="2" [attr.transform]="'rotate(' + a + ' 24 24)'" />
                  }
                </g>
                <circle cx="24" cy="24" r="10.5" fill="url(#sun-core)" />
              </svg>
            } @else if (cell.value === 'm') {
              <svg class="moon" viewBox="0 0 48 48" aria-hidden="true">
                <path d="M37.5 29.5A16.5 16.5 0 0 1 18.5 10.5a16.5 16.5 0 1 0 19 19z" fill="url(#moon-body)" />
                <circle cx="33" cy="12" r="1.6" class="star" />
                <circle cx="38.5" cy="19" r="1" class="star" />
              </svg>
            }
          </button>
        }
      </div>
      @for (edge of edges(); track edge.key) {
        <span class="sign" [class.diff]="edge.kind !== '='" [style.left.%]="edge.x" [style.top.%]="edge.y" aria-hidden="true">{{ edge.kind === '=' ? '=' : '×' }}</span>
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
    .wrap {
      position: relative;
      width: var(--board, min(100%, 26rem));
      aspect-ratio: 1;
      margin: 0 auto;
    }
    .grid {
      --line: color-mix(in srgb, var(--ink) 18%, var(--bg));
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      grid-template-rows: repeat(6, minmax(0, 1fr));
      gap: 1px;
      width: 100%;
      height: 100%;
      border: 2.5px solid var(--ink);
      border-radius: 16px;
      overflow: hidden;
      background: var(--line);
      box-shadow: var(--shadow);
    }
    :host .cell {
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
      transition: background-color 0.2s var(--ease);
      touch-action: manipulation;
    }
    :host .cell:hover:not(:disabled) {
      box-shadow: none;
      background: var(--surface-2);
    }
    :host .cell:disabled {
      opacity: 1;
      cursor: default;
    }
    :host .given {
      background: var(--surface-2);
    }
    :host .bad {
      background: color-mix(in srgb, var(--bad) 22%, var(--surface));
    }
    .sun,
    .moon {
      width: 82%;
      height: 82%;
      overflow: visible;
      filter: drop-shadow(0 1.5px 1.5px rgb(0 0 0 / 0.2));
    }
    .sun {
      animation: sun-in 0.5s var(--spring);
    }
    .moon {
      animation: moon-in 0.5s var(--spring);
    }
    .rays rect {
      fill: #f5a623;
    }
    .rays {
      transform-origin: 24px 24px;
      animation: spin 24s linear infinite;
    }
    .star {
      fill: #fff;
      opacity: 0.85;
    }
    .bad .sun,
    .bad .moon {
      animation: shake 0.4s;
    }
    .win .sun,
    .win .moon {
      animation: cheer 0.7s var(--spring) both;
      animation-delay: var(--d);
    }
    .sign {
      position: absolute;
      z-index: 1;
      display: grid;
      place-items: center;
      width: 1.55rem;
      height: 1.55rem;
      transform: translate(-50%, -50%);
      border-radius: 50%;
      background: var(--surface);
      border: 1.5px solid var(--ink);
      color: var(--ink);
      font-weight: 700;
      font-size: 0.95rem;
      line-height: 1;
      box-shadow: 0 1px 3px rgb(0 0 0 / 0.18);
      pointer-events: none;
    }
    .sign.diff {
      background: var(--ink);
      color: var(--ink-contrast);
    }
    @keyframes sun-in {
      from {
        transform: scale(0.2) rotate(-120deg);
        opacity: 0;
      }
    }
    @keyframes moon-in {
      from {
        transform: scale(0.2) rotate(90deg);
        opacity: 0;
      }
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
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
        transform: scale(1.25) rotate(-10deg);
      }
      70% {
        transform: scale(0.95);
      }
    }
  `,
})
export class TangoBoard {
  private readonly haptics = inject(HapticsService);
  readonly puzzle = input.required<TangoPuzzle>();
  readonly board = input.required<TangoCell[]>();
  readonly bad = input<Set<number>>(new Set());
  readonly locked = input(false);
  readonly solved = input(false);
  readonly boardChange = output<TangoCell[]>();

  protected readonly rays = [0, 45, 90, 135, 180, 225, 270, 315];

  protected readonly cells = computed(() => {
    const puzzle = this.puzzle();
    const bad = this.bad();
    return this.board().map((value, i) => ({
      i,
      delay: ((i % SIZE) + Math.floor(i / SIZE)) * 0.05 + 's',
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
    if (next[index] !== '.') this.haptics.tap();
    else this.haptics.tick();
    this.boardChange.emit(next);
  }
}
