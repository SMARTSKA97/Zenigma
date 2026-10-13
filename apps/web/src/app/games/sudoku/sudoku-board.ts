import { ChangeDetectionStrategy, Component, computed, HostListener, inject, input, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';

import { boxOf, boxShape, extraGroup, onDiagonal, peersOf, sizeOf, SudokuPuzzle } from './engine';
import { isKindRule } from './kinds';

@Component({
  selector: 'app-sudoku-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="frame" [class.sand]="sandwich()">
      @if (sandwich(); as sw) {
        <div class="clues top" aria-hidden="true">
          @for (v of sw.cols; track $index) {
            <i>{{ v }}</i>
          }
        </div>
        <div class="clues side" aria-hidden="true">
          @for (v of sw.rows; track $index) {
            <i>{{ v }}</i>
          }
        </div>
      }
    <div class="grid" role="grid" aria-label="Sudoku board" [class.mini]="size() === 6" [style.--n]="size()">
      @for (cell of cells(); track cell.i) {
        <button
          type="button"
          role="gridcell"
          class="cell"
          [class.given]="cell.given"
          [class.selected]="cell.selected"
          [class.peer]="cell.peer"
          [class.diag]="cell.diag"
          [class.same]="cell.same"
          [class.bad]="cell.bad"
          [class.flash]="cell.flash"
          [class.win]="solved()"
          [class.box-left]="cell.boxLeft"
          [class.box-top]="cell.boxTop"
          [disabled]="locked()"
          [style.--d]="cell.delay"
          [attr.aria-label]="cell.label"
          [attr.data-i]="cell.i"
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
      @if (art(); as a) {
        <svg class="art" viewBox="0 0 9 9" preserveAspectRatio="none" aria-hidden="true">
          @for (s of a.shapes; track $index) {
            @if (s.circle) {
              <circle class="shape" [attr.cx]="s.x" [attr.cy]="s.y" [attr.r]="0.36" />
            } @else {
              <rect class="shape" [attr.x]="s.x - 0.32" [attr.y]="s.y - 0.32" width="0.64" height="0.64" rx="0.06" />
            }
          }
          @for (t of a.thermos; track $index) {
            <polyline class="thermo" [attr.points]="t.points" />
            <circle class="bulb" [attr.cx]="t.bx" [attr.cy]="t.by" r="0.33" />
          }
          @for (w of a.arrows; track $index) {
            <circle class="ring" [attr.cx]="w.cx" [attr.cy]="w.cy" r="0.4" />
            <polyline class="arrow" [attr.points]="w.points" />
            <polyline class="arrow" [attr.points]="w.head" />
          }
          @for (l of a.cageLines; track $index) {
            <line class="cage" [attr.x1]="l[0]" [attr.y1]="l[1]" [attr.x2]="l[2]" [attr.y2]="l[3]" />
          }
          @for (b of a.bars; track $index) {
            <rect class="bar" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="0.04" />
          }
          @for (t of a.sums; track $index) {
            <text class="sum" [attr.x]="t.x" [attr.y]="t.y">{{ t.sum }}</text>
          }
        </svg>
      }
    </div>
    </div>

    <div class="controls">
    <div class="mode">
      <button type="button" class="notes-toggle" [class.on]="noteMode()" [attr.aria-pressed]="noteMode()" (click)="noteMode.set(!noteMode())">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z" /></svg>
        Notes {{ noteMode() ? 'on' : 'off' }}
      </button>
    </div>

    <div class="pad" role="group" aria-label="Numbers" [style.--keys]="size() + 1">
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
    .frame {
      width: var(--board, min(100%, 26rem));
      margin: 0 auto;
    }
    .frame.sand {
      display: grid;
      grid-template-columns: 1.4rem minmax(0, 1fr);
      grid-template-rows: 1.4rem auto;
    }
    .clues {
      display: grid;
      font-size: 0.78rem;
      font-weight: 700;
      color: var(--muted);
      font-variant-numeric: tabular-nums;
    }
    .clues i {
      display: grid;
      place-items: center;
      font-style: normal;
    }
    .clues.top {
      grid-column: 2;
      grid-row: 1;
      grid-template-columns: repeat(9, 1fr);
    }
    .clues.side {
      grid-column: 1;
      grid-row: 2;
      grid-template-rows: repeat(9, 1fr);
    }
    .frame.sand .grid {
      grid-column: 2;
      grid-row: 2;
    }
    .art {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2;
      overflow: visible;
    }
    .art .shape {
      fill: color-mix(in srgb, var(--muted) 30%, transparent);
    }
    .art .thermo {
      fill: none;
      stroke: color-mix(in srgb, var(--muted) 55%, transparent);
      stroke-width: 0.26;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .art .bulb {
      fill: color-mix(in srgb, var(--muted) 55%, transparent);
    }
    .art .ring {
      fill: none;
      stroke: var(--muted);
      stroke-width: 0.04;
    }
    .art .arrow {
      fill: none;
      stroke: var(--muted);
      stroke-width: 0.05;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .art .cage {
      stroke: var(--ink);
      stroke-width: 0.03;
      stroke-dasharray: 0.12 0.08;
    }
    .art .bar {
      fill: var(--ink);
    }
    .art .sum {
      font-family: var(--font-body);
      font-size: 0.24px;
      font-weight: 700;
      fill: var(--ink);
      paint-order: stroke;
      stroke: var(--surface);
      stroke-width: 0.07px;
    }
    .grid {
      --line: color-mix(in srgb, var(--ink) 22%, var(--bg));
      container-type: inline-size;
      display: grid;
      grid-template-columns: repeat(var(--n, 9), minmax(0, 1fr));
      grid-template-rows: repeat(var(--n, 9), minmax(0, 1fr));
      gap: 1px;
      position: relative;
      width: 100%;
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
    :host .diag {
      background: color-mix(in srgb, var(--accent) 7%, var(--surface));
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
    /* One row of numbers (plus erase) under the board, so the board keeps as much of the screen as possible. */
    .pad {
      display: grid;
      grid-template-columns: repeat(var(--keys, 10), minmax(0, 1fr));
      gap: 0.3rem;
      width: var(--board, min(100%, 26rem));
      margin: 0.7rem auto 0;
    }
    :host .key {
      position: relative;
      min-width: 0;
      min-height: 52px;
      padding: 0;
      border-radius: 12px;
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
  private readonly haptics = inject(HapticsService);
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
    for (let b = 0; b < SIZE; b++) units.push(Array.from({ length: SIZE * SIZE }, (_, i) => i).filter((i) => this.regionOf(i) === b));
    if (this.puzzle().rule === 'diagonal') {
      units.push(Array.from({ length: SIZE }, (_, k) => k * SIZE + k));
      units.push(Array.from({ length: SIZE }, (_, k) => k * SIZE + (SIZE - 1 - k)));
    }
    const rule = this.puzzle().rule;
    if (rule === 'windoku' || rule === 'disjoint') {
      const byGroup = new Map<number, number[]>();
      for (let i = 0; i < SIZE * SIZE; i++) {
        const g = extraGroup(rule, i, SIZE);
        if (g >= 0) byGroup.set(g, [...(byGroup.get(g) ?? []), i]);
      }
      units.push(...byGroup.values());
    }
    for (const unit of units) {
      const values = unit.map((i) => board[i]);
      if (!values.includes(0) && new Set(values).size === SIZE) unit.forEach((i) => done.add(i));
    }
    return done;
  });

  /** The region (or box) a cell belongs to. */
  private regionOf(i: number): number {
    const p = this.puzzle();
    return p.rule === 'jigsaw' ? Number(p.regions![i]) : boxOf(i, this.size());
  }

  protected readonly sandwich = computed(() => {
    const p = this.puzzle();
    return p.rule === 'sandwich' ? { rows: p.rows!, cols: p.cols! } : null;
  });

  /** What is drawn over the grid: thermometers, arrows, cages, bars and the even/odd shapes. */
  protected readonly art = computed(() => {
    const p = this.puzzle();
    if (!isKindRule(p.rule) || this.size() !== 9) return null;
    const xy = (i: number) => ({ x: (i % 9) + 0.5, y: Math.floor(i / 9) + 0.5 });
    const shapes: { x: number; y: number; circle: boolean }[] = [];
    const thermos: { points: string; bx: number; by: number }[] = [];
    const arrows: { cx: number; cy: number; points: string; head: string }[] = [];
    const cageLines: number[][] = [];
    const bars: { x: number; y: number; w: number; h: number }[] = [];
    const sums: { x: number; y: number; sum: number }[] = [];
    if (p.rule === 'even-odd') {
      for (let i = 0; i < 81; i++) if (p.parity![i] !== '.') shapes.push({ ...xy(i), circle: p.parity![i] === 'e' });
    }
    for (const t of p.thermos ?? []) {
      const b = xy(t[0]);
      thermos.push({ points: t.map((c) => `${xy(c).x},${xy(c).y}`).join(' '), bx: b.x, by: b.y });
    }
    for (const [circle, ...path] of p.arrows ?? []) {
      const c = xy(circle);
      const first = xy(path[0]);
      const len = Math.hypot(first.x - c.x, first.y - c.y) || 1;
      const start = { x: c.x + ((first.x - c.x) / len) * 0.4, y: c.y + ((first.y - c.y) / len) * 0.4 };
      const pts = [start, ...path.map(xy)];
      const end = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      const ang = Math.atan2(end.y - prev.y, end.x - prev.x);
      const wing = (d: number) => `${end.x - Math.cos(ang + d) * 0.24},${end.y - Math.sin(ang + d) * 0.24}`;
      arrows.push({ cx: c.x, cy: c.y, points: pts.map((q) => `${q.x},${q.y}`).join(' '), head: `${wing(0.5)} ${end.x},${end.y} ${wing(-0.5)}` });
    }
    for (const [sum, ...cs] of p.cages ?? []) {
      const set = new Set(cs);
      const inset = 0.09;
      for (const c of cs) {
        const x = c % 9;
        const y = Math.floor(c / 9);
        if (!set.has(c - 9) || y === 0) cageLines.push([x + inset, y + inset, x + 1 - inset, y + inset]);
        if (!set.has(c + 9) || y === 8) cageLines.push([x + inset, y + 1 - inset, x + 1 - inset, y + 1 - inset]);
        if (!set.has(c - 1) || x === 0) cageLines.push([x + inset, y + inset, x + inset, y + 1 - inset]);
        if (!set.has(c + 1) || x === 8) cageLines.push([x + 1 - inset, y + inset, x + 1 - inset, y + 1 - inset]);
      }
      const head = Math.min(...cs);
      sums.push({ x: (head % 9) + 0.12, y: Math.floor(head / 9) + 0.3, sum });
    }
    for (const [a, b] of p.bars ?? []) {
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      if (hi - lo === 1) bars.push({ x: (hi % 9) - 0.07, y: Math.floor(hi / 9) + 0.32, w: 0.14, h: 0.36 });
      else bars.push({ x: (hi % 9) + 0.32, y: Math.floor(hi / 9) - 0.07, w: 0.36, h: 0.14 });
    }
    return { shapes, thermos, arrows, cageLines, bars, sums };
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
    const jig = puzzle.rule === 'jigsaw';
    return board.map((value, i) => ({
      i,
      delay: ((i % SIZE) + Math.floor(i / SIZE)) * 0.03 + 's',
      value,
      notes: value || !notes[i] ? [] : this.numbers().map((n) => (notes[i] & (1 << n) ? String(n) : '')),
      given: puzzle.givens[i] !== '0',
      selected: sel === i,
      diag: (puzzle.rule === 'diagonal' && onDiagonal(i, SIZE)) || (puzzle.rule === 'windoku' && extraGroup('windoku', i, SIZE) >= 0),
      peer: sel !== null && sel !== i && peersOf(sel, SIZE, puzzle).includes(i),
      same: sel !== null && sel !== i && selValue !== 0 && value === selValue,
      bad: bad.has(i),
      flash: done.has(i) && !this.solved(),
      boxLeft: i % SIZE !== 0 && (jig ? this.regionOf(i) !== this.regionOf(i - 1) : (i % SIZE) % bw === 0),
      boxTop: i >= SIZE && (jig ? this.regionOf(i) !== this.regionOf(i - SIZE) : Math.floor(i / SIZE) % bh === 0),
      label: `Row ${Math.floor(i / SIZE) + 1}, column ${(i % SIZE) + 1}, ${value ? value : 'empty'}${puzzle.givens[i] !== '0' ? ', fixed' : ''}`,
    }));
  });

  protected select(index: number): void {
    this.haptics.tick();
    this.selected.set(index);
  }

  protected enter(value: number): void {
    const sel = this.selected();
    if (sel === null || this.locked() || this.puzzle().givens[sel] !== '0') return;

    this.haptics.tap();
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
          const sees = i !== sel && peersOf(sel, SIZE, this.puzzle()).includes(i);
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
