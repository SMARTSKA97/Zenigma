import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { PlayScreen } from '../../shared/play-screen';
import { adjacent, Board, makeBoard, practiceSpec, specForDate } from './wend-engine';
import { loadWendWords, WendWords } from './wend-words';
import { cleanNote, MindResult, seeded, useTimers } from './mind-util';

interface Found {
  word: string;
  path: number[];
  hue: number;
  /** Which of the board's four words this is (0 is the shortest). */
  k: number;
}

const LEVEL_KEY = 'zenigma.wend.level';
const readLevel = (): number => {
  try {
    return Math.max(1, Number(localStorage.getItem(LEVEL_KEY)) || 1);
  } catch {
    return 1;
  }
};

/**
 * Wend, as on LinkedIn: a grid with grey blocks whose letters hide several words (3 to 11 letters), bigger and with more words as the week goes on. Trace each one
 * through touching letters (up, down, left or right), every letter used exactly once. The board has one solution, so a real word on
 * the wrong letters is turned down. Drag across the letters, or tap them one by one and press Check.
 * Hint shows the first letter of the shortest word still to find, and the next letter each time it is pressed again.
 * Played as one board per game from Practice (each win makes the next board bigger), or as the one board of the day (`seed`).
 */
@Component({
  selector: 'app-wend',
  imports: [PlayScreen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./mind.scss', './wend.scss'],
  templateUrl: './wend.html',
})
export class Wend implements OnInit {
  readonly done = output<MindResult>();
  /** Set for the daily board: the same board for everyone, played once, no clock. */
  readonly seed = input<string | null>(null);
  private readonly haptics = inject(HapticsService);
  private readonly timers = useTimers();
  private readonly destroy = inject(DestroyRef);
  private readonly gridRef = viewChild<ElementRef<HTMLElement>>('grid');

  private words!: WendWords;
  private random: () => number = Math.random;
  private board!: Board;
  private ended = false;
  private dragging = false;
  private moved = false;

  protected readonly ready = signal(false);
  protected readonly letters = signal<string[]>([]);
  protected readonly found = signal<Found[]>([]);
  protected readonly path = signal<number[]>([]);
  protected readonly bad = signal(false);
  protected readonly note = signal('');
  protected readonly hints = signal(0);
  private mistakes = 0;
  /** The word a hint is working on and how many of its letters are shown. */
  private readonly hintFor = signal<{ k: number; n: number } | null>(null);
  protected readonly hinted = computed(() => {
    const h = this.hintFor();
    return h ? this.board.paths[h.k].slice(0, h.n) : [];
  });
  protected readonly walls = signal<boolean[]>([]);
  protected readonly size = signal(5);
  /** One slot per word, shortest first: the numbers are the words' lengths. */
  protected readonly slots = signal<number[]>([]);
  protected readonly elapsed = signal(0);
  /** The day of the week of the daily board (Monday is small, Sunday is the biggest). */
  protected readonly weekday = signal('');
  protected readonly boards = signal(readLevel());
  protected readonly wordsFound = signal(0);
  protected readonly daily = computed(() => this.seed() !== null);
  protected readonly cells = computed(() => Array.from({ length: this.size() * this.size() }, (_, i) => i));
  protected readonly spelling = computed(() => this.path().map((i) => this.letters()[i]).join(''));
  /** Cell → colour of the word it is locked into. */
  protected readonly lockedHue = computed(() => {
    const out = new Map<number, number>();
    for (const f of this.found()) for (const c of f.path) out.set(c, f.hue);
    return out;
  });

  async ngOnInit(): Promise<void> {
    this.words = await loadWendWords();
    const seed = this.seed();
    if (seed !== null) this.random = seeded(seed);
    this.begin();
    this.ready.set(true);
    const t0 = Date.now();
    const tick = setInterval(() => this.elapsed.set(Math.floor((Date.now() - t0) / 1000)), 1000);
    this.destroy.onDestroy(() => {
      this.ended = true;
      clearInterval(tick);
    });
  }

  private begin(): void {
    const seed = this.seed();
    const date = seed?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
    // The daily follows the day of the week (Monday small, Sunday biggest); practice grows with every board solved.
    const spec = this.daily() && date ? specForDate(date) : practiceSpec(this.boards() - 1);
    this.board = makeBoard(this.words, this.random, spec);
    if (this.daily() && date) this.weekday.set(new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' }));
    this.size.set(this.board.size);
    this.slots.set(this.board.words.map((w) => w.length));
    this.letters.set(this.board.letters);
    this.walls.set(this.board.walls);
    this.found.set([]);
    this.path.set([]);
    this.hintFor.set(null);
    this.note.set('');
  }

  /** The points of a path for the line drawn over the board, in tile units (a tile is 1 by 1). */
  protected line(cells: number[]): string {
    const n = this.size();
    return cells.map((i) => `${(i % n) + 0.5},${Math.floor(i / n) + 0.5}`).join(' ');
  }

  private cellAt(event: PointerEvent): number | null {
    const el = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-i]');
    const grid = this.gridRef()?.nativeElement;
    if (!el || !grid?.contains(el)) return null;
    return Number(el.dataset['i']);
  }

  protected down(event: PointerEvent): void {
    if (this.ended) return;
    const cell = this.cellAt(event);
    if (cell === null || this.lockedHue().has(cell) || this.walls()[cell]) return;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    this.moved = false;
    this.note.set('');
    const path = this.path();
    const last = path[path.length - 1];
    if (path.length > 0 && cell === last) {
      this.path.set(path.slice(0, -1)); // tap the last letter again to take it back
      return;
    }
    this.dragging = true;
    if (path.length > 0 && !path.includes(cell) && adjacent(last, cell, this.size())) this.path.set([...path, cell]);
    else this.path.set([cell]);
    this.haptics.tick();
  }

  protected move(event: PointerEvent): void {
    if (!this.dragging || this.ended) return;
    const cell = this.cellAt(event);
    if (cell === null || this.lockedHue().has(cell) || this.walls()[cell]) return;
    const path = this.path();
    const last = path[path.length - 1];
    if (cell === last) return;
    if (path.length > 1 && cell === path[path.length - 2]) {
      this.path.set(path.slice(0, -1)); // sliding back over the last letter undoes it
      return;
    }
    if (!path.includes(cell) && adjacent(last, cell, this.size())) {
      this.path.set([...path, cell]);
      this.moved = true;
      this.haptics.tick();
    }
  }

  protected up(): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.moved && this.path().length >= 3) this.check();
  }

  protected check(): void {
    const path = this.path();
    if (path.length < 3 || this.ended) return;
    const word = this.spelling();
    const key = [...path].sort((a, b) => a - b).join(',');
    const k = this.board.paths.findIndex((p, i) => this.board.words[i] === word && [...p].sort((a, b) => a - b).join(',') === key);
    if (k < 0 || this.found().some((f) => f.k === k)) {
      this.mistakes++;
      this.haptics.error();
      this.bad.set(true);
      this.note.set(this.words.valid.has(word) ? `${word.toUpperCase()} is a word, but these letters belong to other answers` : `${word.toUpperCase()} is not one of this board's words`);
      this.timers.after(600, () => {
        this.bad.set(false);
        this.path.set([]);
      });
      return;
    }
    this.haptics.success();
    this.found.update((f) => [...f, { word, path, hue: k % 4, k }]);
    this.path.set([]);
    if (this.hintFor()?.k === k) this.hintFor.set(null);
    this.wordsFound.update((n) => n + 1);
    if (this.found().length === this.board.words.length) this.solved();
  }

  private solved(): void {
    this.ended = true;
    if (!this.daily()) {
      try {
        localStorage.setItem(LEVEL_KEY, String(this.boards() + 1));
      } catch {
        /* the next board is simply the same size */
      }
    }
    this.timers.after(900, () => this.finish());
  }

  /** Takes back the last locked word. */
  protected undo(): void {
    if (this.ended) return;
    if (this.path().length > 0) {
      this.path.set([]);
      return;
    }
    this.found.update((f) => f.slice(0, -1));
    this.wordsFound.update((n) => Math.max(0, n - 1));
  }

  /** Takes back every word on this board. */
  protected reset(): void {
    if (this.ended) return;
    this.wordsFound.update((n) => Math.max(0, n - this.found().length));
    this.found.set([]);
    this.path.set([]);
    this.hintFor.set(null);
  }

  /**
   * Shows the first letter of the shortest word still to find, and the next letter each time it is pressed again. If the letters
   * you are tracing have left the answer, they are taken back to the last correct one first.
   */
  protected hint(): void {
    if (this.ended) return;
    const todo = this.board.paths.map((p, k) => k).filter((k) => !this.found().some((f) => f.k === k));
    if (todo.length === 0) return;
    this.hints.update((n) => n + 1);
    const path = this.path();
    // The longest start of the trace that is still on an unfound word.
    let best = { k: -1, n: 0 };
    for (const k of todo) {
      let n = 0;
      while (n < path.length && this.board.paths[k][n] === path[n]) n++;
      if (n > best.n) best = { k, n };
    }
    if (path.length > 0 && best.n < path.length) this.path.set(path.slice(0, best.n));
    const h = this.hintFor();
    let k: number;
    let n: number;
    if (best.n > 0) {
      k = best.k;
      n = best.n + 1;
    } else if (h && todo.includes(h.k)) {
      k = h.k;
      n = h.n + 1;
    } else {
      k = todo[0];
      n = 1;
    }
    this.hintFor.set({ k, n: Math.min(n, this.board.paths[k].length) });
  }

  /** The letters of word `k` for the slots under the grid: all once found, the hinted ones while a hint is open. */
  protected slot(k: number): { letters: string[]; found: boolean; hue: number } {
    const length = this.board?.words[k]?.length ?? 0;
    const f = this.found().find((x) => x.k === k);
    const word = this.board?.words[k] ?? '';
    const h = this.hintFor();
    const shown = f ? length : h?.k === k ? h.n : 0;
    return { letters: Array.from({ length }, (_, i) => (i < shown ? word[i].toUpperCase() : '')), found: !!f, hue: k % 4 };
  }

  private finish(): void {
    this.ended = true;
    // Points for the board: 100, less 15 for every hint and 1 for every 10 seconds past the first minute (never under 40).
    const slow = Math.max(0, Math.floor((this.elapsed() - 60) / 10));
    const points = Math.max(40, 100 - 15 * this.hints() - slow);
    const hinted = cleanNote(this.hints(), this.mistakes);
    this.done.emit({ score: points, detail: this.daily() ? hinted : `Board ${this.boards()} in ${this.elapsed()}s · ${hinted}` });
  }
}
