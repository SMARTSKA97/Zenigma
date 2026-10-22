import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';
import { GameKeyboard } from '../../shared/game-keyboard';
import { PlayScreen } from '../../shared/play-screen';
import { accepts, DAILY_LINKS, linksForRound, makeChain, written } from './chain-link-engine';
import { cleanNote, MindResult, seeded, useTimers } from './mind-util';

interface Row {
  /** The word the chain was built with. */
  word: string;
  /** What the player ended up with (null while it is still blank). */
  shown: string | null;
}

/**
 * The first word is given. Each word after it is shown as its first letter and one line per remaining letter. A word is right when it
 * joins with the one before it into a compound word (MAN + MADE = man-made) and with the one after it. Chains grow from 4 links to 9.
 * A wrong word or a skip costs a life; three lives.
 */
@Component({
  selector: 'app-chain-link',
  imports: [PlayScreen, GameKeyboard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./mind.scss', './chain-link.scss'],
  templateUrl: './chain-link.html',
})
export class ChainLink implements OnInit {
  readonly done = output<MindResult>();
  /** Set for the daily chain: the same one for everyone, a single long chain, played once. */
  readonly seed = input<string | null>(null);
  private random: () => number = Math.random;
  private readonly haptics = inject(HapticsService);
  private readonly timers = useTimers();

  protected readonly round = signal(1);
  protected readonly lives = signal(3);
  protected readonly links = signal(0);
  protected readonly rows = signal<Row[]>([]);
  protected readonly at = signal(1);
  protected readonly typed = signal('');
  protected readonly bad = signal(false);
  protected readonly busy = signal(false);
  protected readonly seen = new Set<string>();
  private hints = 0;
  private mistakes = 0;
  /** Rows where a hint was used (they do not count as links). */
  private readonly hinted = new Set<string>();
  private ended = false;

  /** The row being filled in. */
  protected readonly current = computed(() => this.rows()[this.at()]);
  protected readonly blanks = computed(() => (this.current() ? this.current().word.length - 1 : 0));
  protected readonly joined = computed(() => {
    const rows = this.rows();
    const out: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const a = rows[i - 1].shown;
      const b = rows[i].shown;
      out.push(a && b ? written(a, b) : '');
    }
    return out;
  });

  ngOnInit(): void {
    const seed = this.seed();
    if (seed !== null) this.random = seeded(seed);
    this.begin();
  }

  private begin(): void {
    const chain = makeChain(this.seed() !== null ? DAILY_LINKS : linksForRound(this.round()), this.random, undefined, this.seen);
    // The word list is large enough that this does not happen; if it ever did, end kindly instead of hanging.
    if (!chain) return this.finish();
    chain.words.forEach((w) => this.seen.add(w));
    if (this.seen.size > 60) this.seen.clear();
    this.rows.set(chain.words.map((word, i) => ({ word, shown: i === 0 ? word : null })));
    this.at.set(1);
    this.typed.set('');
    this.busy.set(false);
  }

  protected key(letter: string): void {
    if (this.busy() || this.typed().length >= this.blanks()) return;
    this.typed.update((t) => t + letter);
  }

  protected erase(): void {
    this.typed.update((t) => t.slice(0, -1));
  }

  protected letters(row: Row, index: number): string[] {
    if (row.shown) return [...row.shown];
    const cur = this.current();
    if (cur === row) {
      const typed = this.typed();
      return [row.word[0], ...Array.from({ length: row.word.length - 1 }, (_, i) => typed[i] ?? '')];
    }
    return [row.word[0], ...Array.from({ length: row.word.length - 1 }, () => '')];
  }

  protected submit(): void {
    const row = this.current();
    if (this.busy() || !row) return;
    const guess = row.word[0] + this.typed();
    if (guess.length !== row.word.length) return;
    const rows = this.rows();
    const previous = rows[this.at() - 1].shown ?? '';
    const next = rows[this.at() + 1]?.word;
    if (accepts(previous, guess, next)) {
      this.place(guess);
      this.haptics.success();
    } else {
      this.miss();
    }
  }

  /** Types the next correct letter of the word (and takes back anything typed that was off the way). */
  protected hint(): void {
    const row = this.current();
    if (this.busy() || !row) return;
    const target = row.word.slice(1);
    const typed = this.typed();
    const base = target.startsWith(typed) ? typed : '';
    if (base.length >= target.length) return;
    this.typed.set(base + target[base.length]);
    this.hints++;
    this.hinted.add(`${this.round()}:${this.at()}`);
    this.haptics.tick();
  }

  protected skip(): void {
    const row = this.current();
    if (this.busy() || !row) return;
    this.place(row.word, true);
    this.lose();
  }

  private place(word: string, gaveUp = false): void {
    this.rows.update((rows) => rows.map((r, i) => (i === this.at() ? { ...r, shown: word } : r)));
    if (!gaveUp && !this.hinted.has(`${this.round()}:${this.at()}`)) this.links.update((n) => n + 1);
    this.typed.set('');
    if (this.at() + 1 >= this.rows().length) {
      this.busy.set(true);
      this.timers.after(1100, () => {
        if (this.lives() <= 0 || this.seed() !== null) return this.finish();
        this.round.update((r) => r + 1);
        this.begin();
      });
      return;
    }
    this.at.update((i) => i + 1);
  }

  private miss(): void {
    this.haptics.error();
    this.bad.set(true);
    this.timers.after(350, () => this.bad.set(false));
    this.typed.set('');
    this.mistakes++;
    this.lose();
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
    const n = this.links();
    this.done.emit({ score: n, detail: `${n} ${n === 1 ? 'link' : 'links'} in ${this.round()} ${this.round() === 1 ? 'chain' : 'chains'} · ${cleanNote(this.hints, this.mistakes)}` });
  }
}
