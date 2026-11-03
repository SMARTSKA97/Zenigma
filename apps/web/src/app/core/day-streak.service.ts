import { computed, inject, Injectable, signal } from '@angular/core';
import { MindDailyService } from '../games/mind/mind-daily';

const KEY = 'zenigma.puzzles.days';

const shift = (date: string, days: number): string => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * The daily streak: a day counts only when BOTH the mind set (one game from every skill) and all of the day's puzzles are finished.
 * The mind half comes from MindDailyService; the puzzle half is noted here when the Dailies screen shows every puzzle done.
 * Kept on this device. The per-game puzzle streaks on the server are separate and unchanged.
 */
@Injectable({ providedIn: 'root' })
export class DayStreakService {
  private readonly mind = inject(MindDailyService);
  private readonly puzzleDays = signal<string[]>(this.read());

  readonly puzzlesDone = computed(() => this.puzzleDays().includes(this.mind.date()));
  readonly mindDone = computed(() => this.mind.complete());
  readonly todayDone = computed(() => this.puzzlesDone() && this.mindDone());

  /** Days in a row with both halves done, counted up to today (or up to yesterday while today is unfinished). */
  readonly streak = computed(() => {
    const done = new Set(this.puzzleDays().filter((d) => this.mind.finishedDays().includes(d)));
    return countBack(done, this.mind.date());
  });

  /** Call when every puzzle available today has been finished (solved, won or lost). */
  markPuzzlesDone(date: string): void {
    if (this.puzzleDays().includes(date)) return;
    const days = [...this.puzzleDays(), date].slice(-400);
    this.puzzleDays.set(days);
    try {
      localStorage.setItem(KEY, JSON.stringify(days));
    } catch {
      /* no storage */
    }
  }

  /**
   * Past days when every puzzle on offer today was solved (or covered by a freeze), taken from the server's last five weeks of results.
   * This restores the puzzle half of the streak on days the app was not open to note it (or on a new device).
   */
  backfill(games: { recent: string[]; frozen: string[] }[]): void {
    if (!games.length) return;
    const common = commonDays(games);
    const known = new Set(this.puzzleDays());
    const add = common.filter((d) => !known.has(d));
    if (!add.length) return;
    const next = [...known, ...add].sort().slice(-400);
    this.puzzleDays.set(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* no storage */
    }
  }

  private read(): string[] {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown;
      return Array.isArray(raw) ? raw.filter((d): d is string => typeof d === 'string') : [];
    } catch {
      return [];
    }
  }
}

export function countBack(done: Set<string>, today: string): number {
  let day = done.has(today) ? today : shift(today, -1);
  let n = 0;
  while (done.has(day)) {
    n++;
    day = shift(day, -1);
  }
  return n;
}

/** Days on which every game was solved or covered by a freeze. */
export function commonDays(games: { recent: string[]; frozen: string[] }[]): string[] {
  if (!games.length) return [];
  const days = games.map((g) => new Set([...g.recent, ...g.frozen]));
  return [...days[0]].filter((d) => days.every((set) => set.has(d)));
}
