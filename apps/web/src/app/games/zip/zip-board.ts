import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';

import { cutTo, step, ZipPath, ZipPuzzle } from './engine';

@Component({
  selector: 'app-zip-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="grid"
      role="application"
      aria-label="Zip board. Drag from 1 through every cell, reaching the numbers in order."
      tabindex="0"
      [style.--n]="puzzle().size"
      [class.win]="solved()"
      (pointerdown)="down($event)"
      (pointermove)="move($event)"
      (pointerup)="up($event)"
      (pointercancel)="up($event)"
      (contextmenu)="$event.preventDefault()"
      (keydown)="key($event)"
    >
      @for (cell of cells(); track cell.i) {
        <div class="cell" [attr.data-i]="cell.i" [class.on]="cell.on" [class.head]="cell.head">
          @if (cell.number) {
            <b class="num" [class.reached]="cell.on">{{ cell.number }}</b>
          }
        </div>
      }
      <svg class="trail" [attr.viewBox]="'0 0 ' + puzzle().size + ' ' + puzzle().size" aria-hidden="true">
        <polyline [attr.points]="points()" />
        @if (head(); as h) {
          <circle [attr.cx]="h.x" [attr.cy]="h.y" r="0.2" />
        }
      </svg>
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .grid {
      --line: color-mix(in srgb, var(--ink) 22%, var(--bg));
      position: relative;
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
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
      -webkit-touch-callout: none;
      outline: none;
    }
    .cell {
      position: relative;
      display: grid;
      place-items: center;
      min-width: 0;
      min-height: 0;
      background: var(--surface);
      transition: background-color 0.2s var(--ease);
    }
    .cell.on {
      background: color-mix(in srgb, var(--accent) 14%, var(--surface));
    }
    .num {
      position: relative;
      z-index: 2;
      display: grid;
      place-items: center;
      width: 62%;
      height: 62%;
      border-radius: 50%;
      background: var(--ink);
      color: var(--ink-contrast);
      font-family: var(--font-display);
      font-weight: 650;
      font-size: clamp(0.75rem, 5.2cqw, 1.3rem);
      font-variant-numeric: tabular-nums;
      transition:
        background-color 0.2s var(--ease),
        transform 0.25s var(--spring);
    }
    .num.reached {
      background: var(--accent);
      color: var(--accent-contrast);
      transform: scale(1.06);
    }
    .trail {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }
    .trail polyline {
      fill: none;
      stroke: var(--accent);
      stroke-width: 0.34;
      stroke-linecap: round;
      stroke-linejoin: round;
      opacity: 0.85;
    }
    .trail circle {
      fill: var(--accent);
    }
    .win .trail polyline {
      animation: glow 0.9s var(--ease) both;
    }
    @keyframes glow {
      from {
        stroke-width: 0.1;
        opacity: 0.3;
      }
      50% {
        stroke-width: 0.5;
      }
    }
  `,
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

