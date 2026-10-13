import { ChangeDetectionStrategy, Component, computed, HostListener, inject, input, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';

import { boxOf, boxShape, extraGroup, onDiagonal, peersOf, sizeOf, SudokuPuzzle } from './engine';
import { isKindRule } from './kinds';

@Component({
  selector: 'app-sudoku-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sudoku-board.html',
  styleUrl: './sudoku-board.scss',
})
export class SudokuBoard {
  private readonly haptics = inject(HapticsService);
  readonly puzzle = input.required<SudokuPuzzle>();
  readonly board = input.required<number[]>();
  readonly bad = input<Set<number>>(new Set());
  readonly locked = input(false);
  /** No row, column or same-number highlighting. */
  readonly blind = input(false);
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

  /** What is drawn over the grid: thermometers, Renban lines, arrows, cages, bars and the even/odd shapes. */
  protected readonly art = computed(() => {
    const p = this.puzzle();
    if (!isKindRule(p.rule) || this.size() !== 9) return null;
    const xy = (i: number) => ({ x: (i % 9) + 0.5, y: Math.floor(i / 9) + 0.5 });
    const shapes: { x: number; y: number; circle: boolean }[] = [];
    const lines: string[] = [];
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
    for (const l of p.lines ?? []) lines.push(l.map((c) => `${xy(c).x},${xy(c).y}`).join(' '));
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
    return { shapes, lines, thermos, arrows, cageLines, bars, sums };
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
      peer: !this.blind() && sel !== null && sel !== i && peersOf(sel, SIZE, puzzle).includes(i),
      same: !this.blind() && sel !== null && sel !== i && selValue !== 0 && value === selValue,
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

    if (this.noteMode() && value !== 0) this.haptics.tick();
    else if (value === 0) this.haptics.tap();
    else this.haptics.place();
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
