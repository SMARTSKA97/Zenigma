import { computed, inject, Injectable, signal } from '@angular/core';
import { LocalStore } from '../../core/local-store';
import { PrefsService } from '../../core/prefs.service';
import { BoardController, BoardRow } from './board';
import { WordListService } from './word-list.service';
import { SyncService } from '../../core/sync.service';
import {
  GameState,
  keyboardMarks,
  MAX_GUESSES,
  newGame,
  replay,
  shareText,
  submitGuess,
  SubmitError,
  WORD_LENGTH,
} from './engine';

const SAVE_KEY = 'wg:practice';
export const REVEAL_MS = 1800;

interface SavedGame {
  answer: string;
  hard: boolean;
  guesses: string[];
}

const MESSAGES: Record<SubmitError, string> = {
  'too-short': 'Not enough letters',
  'not-a-word': 'Not in word list',
  'game-over': '',
  'hard-mode': '',
};

const ordinal = (n: number) => ['1st', '2nd', '3rd', '4th', '5th'][n - 1] ?? `${n}th`;

/** Practice game for Word Guess: unlimited, works offline, saved on this device and synced when you are signed in. */
@Injectable({ providedIn: 'root' })
export class WordGuessStore implements BoardController {
  private readonly local = inject(LocalStore);
  private readonly sync = inject(SyncService);
  private readonly prefs = inject(PrefsService);

  private readonly wordList = inject(WordListService);

  readonly state = signal<GameState | null>(null);
  readonly current = signal('');
  readonly message = signal<string | null>(null);
  readonly shakeRow = signal<number | null>(null);
  /** How many submitted rows the keyboard may colour. Lags behind while the tiles are still flipping. */
  readonly revealed = signal(0);
  readonly revealing = signal(false);
  readonly loading = signal(true);

  readonly rows = computed<BoardRow[]>(() => {
    const state = this.state();
    const typed = this.current();
    const submitted = state?.guesses ?? [];
    return Array.from({ length: MAX_GUESSES }, (_, r) => {
      if (r < submitted.length) {
        return { letters: [...submitted[r].word], marks: submitted[r].marks, submitted: true };
      }
      const letters = r === submitted.length ? [...typed] : [];
      return { letters, marks: [], submitted: false };
    });
  });

  readonly keyMarks = computed(() => keyboardMarks(this.state()?.guesses.slice(0, this.revealed()) ?? []));
  readonly status = computed(() => this.state()?.status ?? 'playing');
  readonly answer = computed(() => (this.finished() ? (this.state()?.answer ?? null) : null));
  readonly finished = computed(() => (this.state()?.status ?? 'playing') !== 'playing');
  readonly modeLocked = computed(() => (this.state()?.guesses.length ?? 0) > 0 && !this.finished());

  readonly stats = computed(() => {
    const finished = this.sync.events().filter((e) => e.kind === 'wordguess.finished');
    const results = finished.map((e) => e.payload as { status: string; guesses: string[] });
    const won = results.filter((r) => r.status === 'won');
    const distribution = Array.from({ length: MAX_GUESSES }, (_, i) => won.filter((r) => r.guesses.length === i + 1).length);
    return { played: results.length, won: won.length, distribution };
  });

  async start(): Promise<void> {
    if (this.state()) return;
    const words = await this.loadWords();
    const saved = await this.local.getMeta<SavedGame>(SAVE_KEY);
    const restored = saved ? replay(saved.answer, saved.guesses, saved.hard, (w) => words.valid.has(w)) : null;
    if (restored && restored.status === 'playing') {
      this.state.set(restored);
      this.revealed.set(restored.guesses.length);
    } else {
      await this.newWord();
    }
    this.loading.set(false);
  }

  async newWord(): Promise<void> {
    const words = await this.loadWords();
    const played = new Set(
      this.sync
        .events()
        .filter((e) => e.kind === 'wordguess.finished')
        .map((e) => (e.payload as { answer: string }).answer),
    );
    const fresh = words.answers.filter((w) => !played.has(w));
    const pool = fresh.length > 0 ? fresh : words.answers;
    const answer = pool[crypto.getRandomValues(new Uint32Array(1))[0] % pool.length];

    this.state.set(newGame(answer, this.prefs.hardMode()));
    this.current.set('');
    this.revealed.set(0);
    this.message.set(null);
    await this.persist();
  }

  type(letter: string): void {
    if (!this.canInput() || this.current().length >= WORD_LENGTH) return;
    this.current.update((c) => c + letter.toLowerCase());
  }

  erase(): void {
    if (!this.canInput()) return;
    this.current.update((c) => c.slice(0, -1));
  }

  async enter(): Promise<void> {
    const state = this.state();
    if (!state || !this.canInput()) return;
    const words = await this.loadWords();

    const result = submitGuess(state, this.current(), (w) => words.valid.has(w));
    if (!result.ok) {
      const text =
        result.error === 'hard-mode' && result.detail
          ? result.detail.reason === 'position'
            ? `${ordinal(result.detail.index ?? 1)} letter must be ${result.detail.letter.toUpperCase()}`
            : `Guess must contain ${result.detail.letter.toUpperCase()}`
          : MESSAGES[result.error];
      this.flash(text);
      this.shakeRow.set(state.guesses.length);
      setTimeout(() => this.shakeRow.set(null), 500);
      return;
    }

    this.state.set(result.state);
    this.current.set('');
    this.revealing.set(true);
    const delay = this.reducedMotion() ? 0 : REVEAL_MS;
    setTimeout(() => {
      this.revealed.set(result.state.guesses.length);
      this.revealing.set(false);
      if (result.state.status === 'won') this.flash(['Genius!', 'Magnificent!', 'Impressive!', 'Splendid!', 'Great!', 'Phew!'][result.state.guesses.length - 1], 4000);
      if (result.state.status === 'lost') this.flash(result.state.answer.toUpperCase(), 6000);
    }, delay);

    await this.persist();
    if (result.state.status !== 'playing') {
      await this.sync.record('wordguess.finished', {
        mode: 'practice',
        answer: result.state.answer,
        guesses: result.state.guesses.map((g) => g.word),
        hard: result.state.hard,
        status: result.state.status,
      });
    }
  }

  share(): string {
    return shareText(this.state()!, 'Zenigma Word Guess', this.prefs.highContrast());
  }

  private canInput(): boolean {
    return this.state()?.status === 'playing' && !this.revealing();
  }

  private flash(text: string, ms = 1600): void {
    if (!text) return;
    this.message.set(text);
    setTimeout(() => this.message.update((m) => (m === text ? null : m)), ms);
  }

  private async persist(): Promise<void> {
    const state = this.state();
    if (!state) return;
    if (state.status === 'playing') {
      await this.local.setMeta<SavedGame>(SAVE_KEY, {
        answer: state.answer,
        hard: state.hard,
        guesses: state.guesses.map((g) => g.word),
      });
    } else {
      await this.local.deleteMeta(SAVE_KEY);
    }
  }

  private reducedMotion(): boolean {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private loadWords() {
    return this.wordList.load();
  }
}
