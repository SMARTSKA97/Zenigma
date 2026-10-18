import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnInit, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { adjacent, Board, CELLS, makeBoard, solve, Trace } from './wend-engine';
import { loadWendWords, WendWords } from './wend-words';
import { MindResult, seeded, useClock, useTimers } from './mind-util';

interface Found {
  word: string;
  path: number[];
  hue: number;
}

const PRACTICE_MS = 4 * 60 * 1000;

/**
 * Wend: a grid of letters that hides four words of 3, 4, 5 and 6 letters. Trace each one through touching letters (up, down, left or
 * right), every letter used exactly once and no word crossing another. Drag across the letters, or tap them one by one and press Check.
 * Hint shows the next letter, or takes back a word that leaves the rest with no way out.
 * Played as a four-minute run of boards from Practice, or as the one board of the day (`seed`).
 */
@Component({
  selector: 'app-wend',
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

  protected readonly clock = useClock(PRACTICE_MS, () => this.finish());
  protected readonly seconds = () => Math.ceil(this.clock.left() / 1000);
  protected readonly ready = signal(false);
  protected readonly letters = signal<string[]>([]);
  protected readonly found = signal<Found[]>([]);
  protected readonly path = signal<number[]>([]);
  protected readonly bad = signal(false);
  protected readonly note = signal('');
  protected readonly hints = signal(0);
  protected readonly hinted = signal<number[]>([]);
  protected readonly boards = signal(1);
  protected readonly wordsFound = signal(0);
  protected readonly daily = computed(() => this.seed() !== null);
  protected readonly cells = Array.from({ length: CELLS }, (_, i) => i);
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
    if (!this.daily()) this.clock.start();
    this.destroy.onDestroy(() => (this.ended = true));
  }

  private begin(): void {
    this.board = makeBoard(this.words, this.random);
    this.letters.set(this.board.letters);
    this.found.set([]);
    this.path.set([]);
    this.hinted.set([]);
    this.note.set('');
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
    if (cell === null || this.lockedHue().has(cell)) return;
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
    if (path.length > 0 && !path.includes(cell) && adjacent(last, cell)) this.path.set([...path, cell]);
    else this.path.set([cell]);
    this.haptics.tick();
  }

  protected move(event: PointerEvent): void {
    if (!this.dragging || this.ended) return;
    const cell = this.cellAt(event);
    if (cell === null || this.lockedHue().has(cell)) return;
    const path = this.path();
    const last = path[path.length - 1];
    if (cell === last) return;
    if (path.length > 1 && cell === path[path.length - 2]) {
      this.path.set(path.slice(0, -1)); // sliding back over the last letter undoes it
      return;
    }
    if (!path.includes(cell) && adjacent(last, cell)) {
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
    if (!this.words.valid.has(word)) {
      this.haptics.error();
      this.bad.set(true);
      this.note.set(`${word.toUpperCase()} is not a word`);
      this.timers.after(450, () => {
        this.bad.set(false);
        this.path.set([]);
      });
      return;
    }
    this.haptics.success();
    this.found.update((f) => [...f, { word, path, hue: f.length % 4 }]);
    this.path.set([]);
    this.hinted.set([]);
    this.wordsFound.update((n) => n + 1);
    if (this.lockedHue().size === CELLS) this.solved();
  }

  private solved(): void {
    if (this.daily()) {
      this.ended = true;
      this.timers.after(900, () => this.finish());
      return;
    }
    this.timers.after(1000, () => {
      this.boards.update((b) => b + 1);
      this.begin();
    });
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
    this.hinted.set([]);
  }

  /** Takes back every word on this board. */
  protected reset(): void {
    if (this.ended) return;
    this.wordsFound.update((n) => Math.max(0, n - this.found().length));
    this.found.set([]);
    this.path.set([]);
    this.hinted.set([]);
  }

  /** Shows the next letter of a word that fits, or, if the words found so far leave no way out, takes the last one back. */
  protected hint(): void {
    if (this.ended) return;
    this.hints.update((n) => n + 1);
    const free = this.cellsFree();
    const solution = solve(this.letters(), free, this.words);
    if (!solution) {
      this.note.set('Those words leave no way out. The last one is taken back.');
      this.found.update((f) => f.slice(0, -1));
      this.wordsFound.update((n) => Math.max(0, n - 1));
      this.path.set([]);
      return;
    }
    const path = this.path();
    // Carry on a word already started, otherwise show the first letter of the shortest word still to find.
    const along = solution.find((t) => path.length > 0 && path.length < t.path.length && path.every((c, i) => t.path[i] === c));
    const target: Trace = along ?? [...solution].sort((a, b) => a.path.length - b.path.length)[0];
    const next = along ? target.path[path.length] : target.path[0];
    this.hinted.set([next]);
  }

  private cellsFree(): boolean[] {
    const locked = this.lockedHue();
    return this.cells.map((c) => !locked.has(c));
  }

  private finish(): void {
    this.ended = true;
    this.clock.stop();
    if (this.daily()) {
      // Points for the day: 100, less 15 for every hint (never under 40).
      const points = Math.max(40, 100 - 15 * this.hints());
      this.done.emit({ score: points, detail: this.hints() === 0 ? 'No hints used' : `${this.hints()} ${this.hints() === 1 ? 'hint' : 'hints'} used` });
      return;
    }
    const n = this.wordsFound();
    this.done.emit({ score: n, detail: `${n} ${n === 1 ? 'word' : 'words'} on ${this.boards()} ${this.boards() === 1 ? 'board' : 'boards'}` });
  }
}
