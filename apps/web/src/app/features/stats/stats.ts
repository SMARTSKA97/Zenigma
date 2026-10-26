import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { formatDuration } from '../../core/leaderboard.service';
import { GameStats, Stats, StatsService } from '../../core/stats.service';
import { SyncService } from '../../core/sync.service';
import { DAILY_GAMES } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';
import { FreezeList } from '../../shared/freeze-sheet';
import { CardInput, StreakCardInput } from '../../shared/share-card';
import { streakShare } from '../../shared/streak-share';
import { ShareSheet } from '../../shared/share-sheet';
import { Insights } from './insights';
import { PlayerCard } from '../../shared/player-card';

/** Per-game streaks, times and a five-week calendar, plus the streak freezes each game has earned. */
@Component({
  selector: 'app-stats',
  imports: [RouterLink, Glyph, FreezeList, ShareSheet, Insights, PlayerCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './stats.html',
  styleUrl: './stats.scss',
})
export class StatsPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly sync = inject(SyncService);
  private readonly api = inject(StatsService);

  protected readonly stats = signal<Stats | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  protected readonly games = computed<GameStats[]>(() => {
    const order = DAILY_GAMES.map((g) => g.id as string);
    return [...(this.stats()?.games ?? [])].sort((a, b) => order.indexOf(a.game) - order.indexOf(b.game));
  });
  /** The last 35 days, oldest first, ending today. */
  protected readonly days = computed(() => {
    const today = this.stats()?.date;
    if (!today) return [];
    const end = Date.parse(`${today}T00:00:00Z`);
    return Array.from({ length: 35 }, (_, i) => new Date(end - (34 - i) * 86_400_000).toISOString().slice(0, 10));
  });

  protected readonly shareCard = signal<{ card?: CardInput; streakCard?: StreakCardInput; text: string } | null>(null);

  /** A streak card to post as it is, and a sticker to lay over a photo. */
  protected shareStreak(): void {
    const s = this.stats();
    if (!s) return;
    const streak = Math.max(0, ...s.games.map((g) => g.current));
    const best = Math.max(0, ...s.games.map((g) => g.best));
    this.shareCard.set(streakShare(Math.max(1, streak), this.auth.user()?.displayName, best));
  }

  ngOnInit(): void {
    void this.load();
  }

  protected name(id: string): string {
    return DAILY_GAMES.find((g) => g.id === id)?.name ?? id;
  }

  protected hue(id: string): number {
    return DAILY_GAMES.find((g) => g.id === id)?.hue ?? 200;
  }

  protected time(ms: number): string {
    return formatDuration(ms);
  }

  protected async load(): Promise<void> {
    if (!this.auth.signedIn()) {
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.failed.set(false);
    try {
      this.stats.set(await this.api.load());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
