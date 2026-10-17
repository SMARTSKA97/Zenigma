import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { WordListService } from '../word-guess/word-list.service';
import { Candidate, candidatesOf, canFinish, counts, makePuzzle, shuffle } from './wend-engine';
import { MindResult, useTimers } from './mind-util';

const WORDS_PER_PUZZLE = 4;
const SIZE = 5;

interface Found {
  word: string;
  /** Which of the four colours it was given. */
  hue: number;
}

/**
 * Twenty letters make four five-letter words, every letter used once. Tap letters to spell a word. A real word that leaves letters
 * which can still become words locks in; a word that is not real costs a life. Undo takes the last word back for free.
 */
@Component({
  selector: 'app-wend',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./mind.scss', './wend.scss'],
  templateUrl: './wend.html',
})
export class Wend implements OnInit {
  readonly done = output<MindResult>();
  private readonly lists = inject(WordListService);
  private readonly haptics = inject(HapticsService);
  private readonly timers = useTimers();

  private valid = new Set<string>();
  private common: string[] = [];
  private candidates: Candidate[] = [];
  private ended = false;

  protected readonly ready = signal(false);
  protected readonly round = signal(1);
  protected readonly lives = signal(3);
  protected readonly wordsFound = signal(0);
  protected readonly bad = signal(false);
  protected readonly busy = signal(false);
  protected readonly note = signal('');
  /** The twenty letters in their places. */
  protected readonly letters = signal<string[]>([]);
  /** Tile positions picked for the word being spelled, in order. */
  protected readonly picked = signal<number[]>([]);
  /** Tile position → colour index, for tiles already used in a locked word. */
  protected readonly locked = signal<Record<number, number>>({});
  protected readonly found = signal<Found[]>([]);
  protected readonly spelling = computed(() => this.picked().map((i) => this.letters()[i]).join(''));
  protected readonly hues = [0, 1, 2, 3];

  async ngOnInit(): Promise<void> {
    const words = await this.lists.load();
    this.valid = new Set([...words.valid, ...words.answers]);
    this.common = words.answers;
    // Real words of the right length, for checking that the leftover letters can still be used.
    this.candidates = candidatesOf([...this.valid].filter((w) => w.length === SIZE));
    this.ready.set(true);
    this.begin();
  }

  private begin(): void {
    const puzzle = makePuzzle(this.common, WORDS_PER_PUZZLE);
    this.letters.set(puzzle.letters);
    this.picked.set([]);
    this.locked.set({});
    this.found.set([]);
    this.note.set('');
    this.busy.set(false);
  }

  protected tap(i: number): void {
    if (this.busy() || this.locked()[i] !== undefined) return;
    const picked = this.picked();
    if (picked.includes(i)) {
      this.picked.set(picked.filter((p) => p !== i));
      return;
    }
    if (picked.length >= SIZE) return;
    const next = [...picked, i];
    this.picked.set(next);
    this.note.set('');
    if (next.length === SIZE) this.check(next);
  }

  private check(positions: number[]): void {
    const word = positions.map((i) => this.letters()[i]).join('');
    if (!this.valid.has(word)) {
      this.haptics.error();
      this.bad.set(true);
      this.note.set(`${word.toUpperCase()} is not a word`);
      this.timers.after(450, () => {
        this.bad.set(false);
        this.picked.set([]);
      });
      this.lose();
      return;
    }
    // Everything not yet locked, less this word: can it still become words?
    const remaining = this.letters().filter((_, i) => this.locked()[i] === undefined && !positions.includes(i));
    const wordsAfter = WORDS_PER_PUZZLE - this.found().length - 1;
    const pool = counts(remaining.join(''));
    if (!canFinish(pool, wordsAfter, SIZE, this.candidates)) {
      this.haptics.warning();
      this.note.set(`${word.toUpperCase()} is a word, but the other letters could not make words`);
      this.timers.after(900, () => this.picked.set([]));
      return;
    }
    this.haptics.success();
    const hue = this.found().length;
    this.found.update((f) => [...f, { word, hue }]);
    this.locked.update((l) => ({ ...l, ...Object.fromEntries(positions.map((p) => [p, hue])) }));
    this.picked.set([]);
    this.wordsFound.update((n) => n + 1);
    if (this.found().length === WORDS_PER_PUZZLE) {
      this.busy.set(true);
      this.timers.after(1200, () => {
        this.round.update((r) => r + 1);
        this.begin();
      });
    }
  }

  protected undo(): void {
    if (this.busy()) return;
    const found = this.found();
    if (this.picked().length > 0) {
      this.picked.set([]);
      return;
    }
    if (found.length === 0) return;
    const hue = found[found.length - 1].hue;
    this.found.set(found.slice(0, -1));
    this.locked.update((l) => Object.fromEntries(Object.entries(l).filter(([, h]) => h !== hue)));
    this.wordsFound.update((n) => Math.max(0, n - 1));
  }

  /** Mix up the tiles that are not locked yet. */
  protected shuffle(): void {
    if (this.busy()) return;
    const letters = this.letters();
    const free = letters.map((_, i) => i).filter((i) => this.locked()[i] === undefined);
    const mixed = shuffle(free.map((i) => letters[i]));
    const next = [...letters];
    free.forEach((slot, k) => (next[slot] = mixed[k]));
    this.letters.set(next);
    this.picked.set([]);
  }

  private lose(): void {
    this.lives.update((l) => l - 1);
    if (this.lives() <= 0) {
      this.busy.set(true);
      this.timers.after(1200, () => this.finish());
    }
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    const n = this.wordsFound();
    this.done.emit({ score: n, detail: `${n} ${n === 1 ? 'word' : 'words'} in ${this.round()} ${this.round() === 1 ? 'puzzle' : 'puzzles'}` });
  }
}
