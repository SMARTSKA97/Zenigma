import { computed, inject, Injectable, signal } from '@angular/core';
import { DAILY_GAMES, PRACTICE_TRACKS } from '../games/catalog';
import { MindStore } from '../games/mind/mind-store';
import { PracticeStore } from '../games/puzzle/practice.store';
import { AuthService } from './auth.service';
import { Stats, StatsService } from './stats.service';

export interface PlayerLevel {
  level: number;
  /** XP earned inside this level. */
  into: number;
  /** XP this level is worth in total. */
  span: number;
}

/** Level 1 starts at 0 XP; level L starts at 40 × (L − 1)² XP, so early levels come quickly and later ones take real play. */
export function levelFromXp(xp: number): PlayerLevel {
  const safe = Math.max(0, Math.floor(xp));
  const level = Math.floor(Math.sqrt(safe / 40)) + 1;
  const start = 40 * (level - 1) ** 2;
  return { level, into: safe - start, span: 40 * (2 * level - 1) };
}

const TITLES: [number, string][] = [
  [1, 'Cadet'],
  [3, 'Solver'],
  [6, 'Puzzler'],
  [10, 'Strategist'],
  [15, 'Sage'],
  [20, 'Master'],
  [30, 'Grandmaster'],
];
export function titleOf(level: number): string {
  return [...TITLES].reverse().find(([from]) => level >= from)?.[1] ?? 'Cadet';
}

/** The player's level and XP, worked out on this device from what they have already done: levels cleared, dailies, mind games and streaks. */
@Injectable({ providedIn: 'root' })
export class PlayerService {
  private readonly practice = inject(PracticeStore);
  private readonly mind = inject(MindStore);
  private readonly auth = inject(AuthService);
  private readonly statsApi = inject(StatsService);
  private readonly loaded = signal(0);
  private readonly stats = signal<Stats | null>(null);
  private started = false;

  readonly levelsCleared = computed(() => {
    this.loaded();
    return PRACTICE_TRACKS.reduce((n, t) => n + this.practice.solvedLevels(t.track)().size, 0);
  });
  readonly dailiesSolved = computed(() => this.stats()?.games.reduce((n, g) => n + g.solved, 0) ?? 0);
  readonly mindPlays = this.mind.totalPlays;
  readonly bestStreak = computed(() => Math.max(0, ...(this.stats()?.games.map((g) => Math.max(g.best, g.current)) ?? [0])));
  readonly dailyKinds = DAILY_GAMES.length;

  readonly xp = computed(() => this.levelsCleared() * 10 + this.dailiesSolved() * 25 + this.mindPlays() * 4 + this.bestStreak() * 10);
  readonly progress = computed(() => levelFromXp(this.xp()));
  readonly title = computed(() => titleOf(this.progress().level));

  /** Loads what the numbers come from. Never wakes the server: saved stats first, refreshed only if it is awake anyway. */
  start(): void {
    if (this.started) return;
    this.started = true;
    for (const t of PRACTICE_TRACKS) void this.practice.load(t.track).then(() => this.loaded.update((n) => n + 1));
    if (this.auth.signedIn()) {
      this.stats.set(this.statsApi.peek());
      void this.statsApi.refreshIfAwake().then((s) => s && this.stats.set(s)).catch(() => undefined);
    }
  }
}
