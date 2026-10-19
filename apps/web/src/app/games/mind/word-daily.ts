import { computed, inject, Injectable, signal } from '@angular/core';
import { indiaDate } from '../../core/hints.service';
import { SyncService } from '../../core/sync.service';

/** The games with an extra daily board (the word games and Comet Slice): the same puzzle or throws for everyone, played once for a result. */
export const WORD_DAILY_GAMES = ['pinpoint', 'chain-link', 'crossclimb', 'wend', 'comet-slice'] as const;
export type WordDailyGame = (typeof WORD_DAILY_GAMES)[number];
export const isWordDaily = (id: string): id is WordDailyGame => (WORD_DAILY_GAMES as readonly string[]).includes(id);

/** What the game's own score means out of the day's board, turned into 0 to 100 points. */
export function dailyPoints(game: WordDailyGame, score: number): number {
  const out = game === 'chain-link' ? (score / 5) * 100 : game === 'pinpoint' ? (score / 15) * 100 : game === 'crossclimb' ? (score / 4) * 100 : game === 'comet-slice' ? (score / 80) * 100 : score;
  return Math.max(0, Math.min(100, Math.round(out)));
}

/** The seed that makes today's puzzle the same for everyone (it changes with the India date, like every other daily). */
export const dailySeed = (game: WordDailyGame, date: string): string => `wdaily:${game}:${date}`;

const STATE_KEY = 'zenigma.wdaily';

export interface WordDailyResult {
  points: number;
  ms: number;
}

interface DayState {
  date: string;
  done: Partial<Record<WordDailyGame, WordDailyResult>>;
}

/** Today's word dailies on this device, and the events that carry the results to the server for the board. */
@Injectable({ providedIn: 'root' })
export class WordDailyService {
  private readonly sync = inject(SyncService);
  readonly date = signal(indiaDate());
  private readonly state = signal<DayState>(this.readState());

  readonly games = WORD_DAILY_GAMES;
  readonly results = computed(() => (this.state().date === this.date() ? this.state().done : {}) as Partial<Record<WordDailyGame, WordDailyResult>>);
  readonly doneCount = computed(() => this.games.filter((g) => this.results()[g]).length);
  readonly points = computed(() => this.games.reduce((n, g) => n + (this.results()[g]?.points ?? 0), 0));

  /** Picks up a new day (the screen may have stayed open past the rollover). */
  refresh(): void {
    this.date.set(indiaDate());
  }

  seed(game: WordDailyGame): string {
    return dailySeed(game, this.date());
  }

  /** Keeps the first result of the day: one try, as in the other dailies. Returns false if today's was already done. */
  record(game: WordDailyGame, points: number, ms: number): boolean {
    this.refresh();
    const today = this.date();
    const current = this.state().date === today ? this.state() : { date: today, done: {} };
    if (current.done[game]) return false;
    const next: DayState = { date: today, done: { ...current.done, [game]: { points, ms } } };
    this.state.set(next);
    try {
      localStorage.setItem(STATE_KEY, JSON.stringify(next));
    } catch {
      /* the result still reaches the server through the event log */
    }
    void this.sync.record('wdaily.completed', { game, date: today, points, ms });
    return true;
  }

  private readState(): DayState {
    try {
      const raw = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') as DayState | null;
      if (raw && typeof raw.date === 'string' && raw.done && typeof raw.done === 'object') return raw;
    } catch {
      /* no storage */
    }
    return { date: '', done: {} };
  }
}
