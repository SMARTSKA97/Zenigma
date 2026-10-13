import { PrefsService } from '../../core/prefs.service';
import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ConnectionService } from '../../core/connection.service';
import { AuthService } from '../../core/auth.service';
import { DailyGameStatus, DailyHub as Hub, formatDuration, LeaderboardService } from '../../core/leaderboard.service';
import { Stats, StatsService } from '../../core/stats.service';
import { SyncService } from '../../core/sync.service';
import { CATEGORIES, DAILY_GAMES, dailyDifficulty } from '../../games/catalog';
import { Insights } from '../stats/insights';
import { Glyph } from '../../shared/glyph';
import { FreezeSheet } from '../../shared/freeze-sheet';

@Component({
  selector: 'app-daily-hub',
  imports: [RouterLink, Glyph, FreezeSheet, Insights],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './daily-hub.html',
  styleUrl: './daily-hub.scss',
})
export class DailyHub implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  protected readonly prefs = inject(PrefsService);
  private readonly sync = inject(SyncService);
  protected readonly conn = inject(ConnectionService);
  private readonly api = inject(LeaderboardService);
  private readonly statsApi = inject(StatsService);
  protected readonly stats = signal<Stats | null>(null);
  protected readonly freezesOpen = signal(false);

  protected readonly games = DAILY_GAMES;
  /** Today's puzzles by kind: logic puzzles, Sudoku, words. */
  protected readonly groups = CATEGORIES.map((c) => ({ ...c, games: DAILY_GAMES.filter((g) => g.category === c.id) })).filter((c) => c.games.length > 0);
  protected readonly hub = signal<Hub | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  private readonly now = signal(Date.now());
  private tick?: ReturnType<typeof setInterval>;

  protected readonly difficulty = computed(() => dailyDifficulty(this.hub()?.date));
  protected readonly doneCount = computed(() => (this.hub()?.games ?? []).filter((g) => ['solved', 'won', 'lost'].includes(g.status)).length);
  protected readonly untilNext = computed(() => {
    const target = this.hub()?.nextRolloverUtc;
    if (!target) return '…';
    const minutes = Math.max(0, Math.ceil((Date.parse(target) - this.now()) / 60000));
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  });

  /** The last seconds before the next set arrives: 5, 4, 3, 2, 1, then 0 (arrived) for a moment. Null the rest of the time. */
  protected readonly countdown = signal<number | null>(null);
  private arrived = false;

  private watch(): void {
    const target = this.hub()?.nextRolloverUtc;
    if (!target) return;
    const left = Math.ceil((Date.parse(target) - Date.now()) / 1000);
    if (left > 0 && left <= 5) {
      this.countdown.set(left);
    } else if (left <= 0 && left > -3 && this.countdown() !== null && !this.arrived) {
      this.arrived = true;
      this.countdown.set(0);
      void this.load();
      setTimeout(() => {
        this.countdown.set(null);
        this.arrived = false;
      }, 2500);
    }
  }

  ngOnInit(): void {
    this.tick = setInterval(() => {
      this.now.set(Date.now());
      this.watch();
    }, 1000);
    void this.load();
  }

  ngOnDestroy(): void {
    clearInterval(this.tick);
  }

  protected streakOf(id: string): number {
    return this.stats()?.games.find((g) => g.game === id)?.current ?? 0;
  }

  protected statusOf(id: string): DailyGameStatus | undefined {
    return this.hub()?.games.find((g) => g.game === id);
  }

  protected describe(st: DailyGameStatus | undefined): string {
    if (!st || !st.available) return 'Today\'s puzzle is not ready yet';
    switch (st.status) {
      case 'solved':
        return `Solved in ${formatDuration(st.elapsedMs ?? 0)}`;
      case 'won':
        return `Solved in ${st.guesses} ${st.guesses === 1 ? 'guess' : 'guesses'}`;
      case 'lost':
        return 'Out of guesses';
      case 'playing':
        return 'In progress';
      default:
        return 'Not played yet';
    }
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    if (!this.sync.online() || this.conn.offlineMode()) {
      this.loading.set(false);
      this.failed.set(true);
      return;
    }
    if (this.auth.signedIn()) void this.statsApi.load().then((s) => this.stats.set(s)).catch(() => undefined);
    try {
      this.hub.set(await this.api.dailyHub());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
