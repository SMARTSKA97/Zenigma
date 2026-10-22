import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { GameKeyboard } from '../../shared/game-keyboard';
import { PlayScreen } from '../../shared/play-screen';
import { WordListService } from '../word-guess/word-list.service';
import { accepts, blanksForRound, buildIndex, distancesTo, Index, makeLadder, neighbours } from './crossclimb-engine';
import { cleanNote, MindResult, seeded, useTimers } from './mind-util';

/**
 * A word ladder. The first and last words are given; fill the rows between so that every row differs from the one above it by
 * exactly one letter. Any real word that keeps the way to the last word open is accepted. Ladders grow from 2 rows to 5.
 * A wrong word or a skip costs a life; three lives. Undo takes back the last row for free.
 */
@Component({
  selector: 'app-crossclimb',
  imports: [PlayScreen, GameKeyboard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./mind.scss', './chain-link.scss', './crossclimb.scss'],
  templateUrl: './crossclimb.html',
})
export class Crossclimb implements OnInit {
  readonly done = output<MindResult>();
  /** Set for the daily ladder: the same one for everyone, a single ladder with four rows to find, played once. */
  readonly seed = input<string | null>(null);
  private random: () => number = Math.random;
  private readonly lists = inject(WordListService);
  private readonly haptics = inject(HapticsService);
  private readonly timers = useTimers();

  private valid = new Set<string>();
  private everyWord = new Set<string>();
  private common: string[] = [];
  private index: Index = new Map();
  private distToEnd: ReadonlyMap<string, number> = new Map();
  private ended = false;
  private hints = 0;
  private mistakes = 0;
  private readonly hinted = new Set<string>();

  protected readonly ready = signal(false);
  protected readonly round = signal(1);
  protected readonly lives = signal(3);
  protected readonly rowsDone = signal(0);
  protected readonly bad = signal(false);
  protected readonly busy = signal(false);
  /** The row being filled starts as a copy of the word above; change one letter. */
  protected readonly draft = signal<string[]>([]);
  /** Which tile the next key goes to. */
  protected readonly cursor = signal(0);
  protected readonly typed = computed(() => this.draft().join(''));
  protected readonly changed = computed(() => this.draft().filter((l, i) => l !== this.above()[i]).length);
  protected readonly above = computed(() => [...(this.rows()[this.at() - 1] ?? '')]);
  /** First word, the rows filled so far (null while blank), last word. */
  protected readonly rows = signal<(string | null)[]>([]);
  private solution: string[] = [];
  protected readonly at = signal(1);
  protected readonly last = computed(() => this.rows().length - 1);

  async ngOnInit(): Promise<void> {
    const words = await this.lists.load();
    this.valid = words.valid;
    this.common = words.answers;
    // The index covers every real word, so the ladder may pass through the less usual ones the player might type.
    const seed = this.seed();
    if (seed !== null) this.random = seeded(seed);
    this.everyWord = new Set([...words.valid, ...words.answers]);
    this.index = buildIndex(this.everyWord);
    this.ready.set(true);
    this.begin();
  }

  private begin(): void {
    const ladder = makeLadder(this.seed() !== null ? 4 : blanksForRound(this.round()), this.common, this.index, this.random);
    if (!ladder) return this.finish();
    this.solution = ladder.words;
    this.distToEnd = distancesTo(ladder.words[ladder.words.length - 1], this.index);
    this.rows.set(ladder.words.map((w, i) => (i === 0 || i === ladder.words.length - 1 ? w : null)));
    this.at.set(1);
    this.resetDraft();
    this.busy.set(false);
  }

  private resetDraft(): void {
    this.draft.set(this.above());
    this.cursor.set(0);
  }

  /** Tap a tile of the open row to choose which letter to change. */
  protected pick(index: number): void {
    if (!this.busy()) this.cursor.set(index);
  }

  protected key(letter: string): void {
    if (this.busy()) return;
    const at = this.cursor();
    this.draft.update((d) => d.map((l, i) => (i === at ? letter : l)));
    this.cursor.set(Math.min(4, at + 1));
  }

  /** Puts the tile back to the letter above it, and steps back from an untouched one. */
  protected erase(): void {
    if (this.busy()) return;
    let at = this.cursor();
    if (this.draft()[at] === this.above()[at] && at > 0) at--;
    this.draft.update((d) => d.map((l, i) => (i === at ? this.above()[i] : l)));
    this.cursor.set(at);
  }

  /** What a row shows: the word if it is set, the draft in the open row, blanks below it. */
  protected letters(row: string | null, index: number): string[] {
    if (row) return [...row];
    if (index === this.at() && !this.busy()) return this.draft();
    return ['', '', '', '', ''];
  }

  protected submit(): void {
    if (this.busy() || this.typed().length !== 5 || this.changed() === 0) return;
    const rows = this.rows();
    const above = rows[this.at() - 1]!;
    const used = rows.filter((r): r is string => !!r);
    const left = this.last() - this.at() - 1;
    const guess = this.typed();
    if (accepts(guess, above, used, rows[this.last()]!, left, this.everyWord, this.distToEnd)) {
      this.haptics.success();
      this.place(guess, false);
    } else {
      this.haptics.error();
      this.bad.set(true);
      this.timers.after(350, () => this.bad.set(false));
      this.resetDraft();
      this.mistakes++;
      this.lose();
    }
  }

  /** Puts the right new letter into the open row (and moves to its tile). */
  protected hint(): void {
    if (this.busy()) return;
    const rows = this.rows();
    const above = rows[this.at() - 1]!;
    const used = rows.filter((r): r is string => !!r);
    const left = this.last() - this.at() - 1;
    const fits = (w: string) => accepts(w, above, used, rows[this.last()]!, left, this.everyWord, this.distToEnd);
    const planned = this.solution[this.at()];
    const target = fits(planned) ? planned : (neighbours(above, this.index).find(fits) ?? planned);
    const k = [...target].findIndex((c, i) => c !== above[i]);
    if (k < 0) return;
    this.draft.set([...above].map((l, i) => (i === k ? target[i] : l)));
    this.cursor.set(k);
    this.hints++;
    this.hinted.add(`${this.round()}:${this.at()}`);
    this.haptics.tick();
  }

  protected skip(): void {
    if (this.busy()) return;
    const rows = this.rows();
    const above = rows[this.at() - 1]!;
    const used = rows.filter((r): r is string => !!r);
    const left = this.last() - this.at() - 1;
    const fits = (w: string) => accepts(w, above, used, rows[this.last()]!, left, this.everyWord, this.distToEnd);
    // The word the ladder was made with, unless the player's own rows above mean it no longer fits; then any word that does.
    const planned = this.solution[this.at()];
    const reveal = fits(planned) ? planned : (neighbours(above, this.index).find(fits) ?? planned);
    this.place(reveal, true);
    this.lose();
  }

  protected undo(): void {
    if (this.busy() || this.at() <= 1) return;
    this.rows.update((r) => r.map((w, i) => (i === this.at() - 1 ? null : w)));
    this.at.update((i) => i - 1);
    this.resetDraft();
  }

  private place(word: string, gaveUp: boolean): void {
    this.rows.update((r) => r.map((w, i) => (i === this.at() ? word : w)));
    if (!gaveUp && !this.hinted.has(`${this.round()}:${this.at()}`)) this.rowsDone.update((n) => n + 1);
    if (this.at() + 1 >= this.last()) {
      this.busy.set(true);
      this.timers.after(1100, () => {
        if (this.lives() <= 0 || this.seed() !== null) return this.finish();
        this.round.update((r) => r + 1);
        this.begin();
      });
      return;
    }
    this.at.update((i) => i + 1);
    this.resetDraft();
  }

  private lose(): void {
    this.lives.update((l) => l - 1);
    if (this.lives() <= 0) {
      this.busy.set(true);
      this.timers.after(1100, () => this.finish());
    }
  }

  private finish(): void {
    if (this.ended) return;
    this.ended = true;
    const n = this.rowsDone();
    this.done.emit({ score: n, detail: `${n} ${n === 1 ? 'rung' : 'rungs'} in ${this.round()} ${this.round() === 1 ? 'ladder' : 'ladders'} · ${cleanNote(this.hints, this.mistakes)}` });
  }
}
