import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { between, covers, PatchesClue, PatchesPuzzle, place, Rect, rectAt, removeAt } from './engine';

@Component({
  selector: 'app-patches-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="grid"
      role="application"
      aria-label="Patches board. Drag across cells to draw a rectangle. Tap a rectangle to remove it."
      [style.--n]="puzzle().size"
      [class.win]="solved()"
      (pointerdown)="down($event)"
      (pointermove)="move($event)"
      (pointerup)="up($event)"
      (pointercancel)="up($event)"
      (contextmenu)="$event.preventDefault()"
    >
      @for (cell of cells(); track cell.i) {
        <div class="cell" [attr.data-i]="cell.i">
          @if (cell.clue; as clue) {
            <span class="clue" [class.done]="cell.covered">
              <b>{{ clue[1] }}</b>
              @if (clue[2] > 0) {
                <svg class="shape" viewBox="0 0 24 24" aria-hidden="true">
                  @switch (clue[2]) {
                    @case (1) { <rect x="2" y="7" width="20" height="10" rx="2.5" /> }
                    @case (2) { <rect x="7" y="2" width="10" height="20" rx="2.5" /> }
                    @default { <rect x="4" y="4" width="16" height="16" rx="2.5" /> }
                  }
                </svg>
              }
            </span>
          }
        </div>
      }
      @for (r of shown(); track r.key) {
        <div class="patch" [class.bad]="r.bad" [class.draft]="r.draft" [style.--hue]="r.hue" [style.top.%]="r.top" [style.left.%]="r.left" [style.width.%]="r.width" [style.height.%]="r.height"></div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }
    .grid {
      --line: color-mix(in srgb, var(--ink) 16%, var(--bg));
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
    }
    .cell {
      position: relative;
      display: grid;
      place-items: center;
      min-width: 0;
      min-height: 0;
      background: var(--surface);
    }
    .clue {
      position: relative;
      z-index: 3;
      display: grid;
      justify-items: center;
      line-height: 1;
      pointer-events: none;
    }
    .clue b {
      font-family: var(--font-display);
      font-weight: 700;
      font-size: clamp(0.85rem, 6.2cqw, 1.5rem);
      color: var(--ink);
    }
    .shape {
      width: clamp(0.7rem, 30cqw, 1.15rem);
      margin-top: 0.1rem;
      fill: none;
      stroke: var(--ink);
      stroke-width: 2.6;
      opacity: 0.7;
    }
    .patch {
      position: absolute;
      z-index: 2;
      box-sizing: border-box;
      margin: 2px;
      border: 2px solid oklch(0.62 0.14 calc(var(--hue) * 1deg));
      border-radius: 10px;
      background: color-mix(in srgb, oklch(0.72 0.14 calc(var(--hue) * 1deg)) 34%, var(--surface));
      pointer-events: none;
      transition: background-color 0.2s var(--ease);
      animation: settle 0.22s var(--spring) backwards;
    }
    .patch.draft {
      border-style: dashed;
      opacity: 0.8;
      animation: none;
    }
    .patch.bad {
      border-color: var(--bad);
      background: repeating-linear-gradient(45deg, color-mix(in srgb, var(--bad) 22%, transparent) 0 6px, color-mix(in srgb, var(--bad) 8%, transparent) 6px 12px);
    }
    .win .patch {
      animation: win 0.7s var(--ease) both;
    }
    @keyframes settle {
      from {
        transform: scale(0.94);
        opacity: 0;
      }
    }
    @keyframes win {
      50% {
        transform: scale(1.03);
      }
    }
  `,
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
    this.draft.set(between(this.puzzle().size, this.from, cell));
    this.haptics.tick();
  }

  protected up(event: PointerEvent): void {
    if (this.from < 0 || event.pointerId !== this.pointer) return;
    const size = this.puzzle().size;
    const rects = this.board();
    const start = this.from;
    this.from = -1;
    this.draft.set(null);
    const end = this.cellAt(event);
    const to = end < 0 ? this.last : end;
    if (!this.moved || to === start) {
      // A tap: take away the rectangle on that cell, or drop a single cell where there is none.
      const hit = rectAt(rects, size, start);
      if (hit) {
        this.haptics.tap();
        this.boardChange.emit(removeAt(rects, size, start));
      } else {
        this.haptics.place();
        this.boardChange.emit(place(rects, [Math.floor(start / size), start % size, Math.floor(start / size), start % size]));
      }
      return;
    }
    this.haptics.place();
    this.boardChange.emit(place(rects, between(size, start, to)));
  }
}
