import { inject, Injectable } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { AuthService } from './auth.service';
import { LeaderboardService } from './leaderboard.service';
import { StatsService } from './stats.service';

interface StreakWidgetPlugin {
  update(options: { streak: number; done: number; total: number; rollover: number }): Promise<void>;
}
const StreakWidget = registerPlugin<StreakWidgetPlugin>('StreakWidget');

/**
 * The Android home-screen streak widget. The app only writes numbers to it (the longest streak, today's puzzles done, when the
 * next set arrives); the widget draws them by itself, with no network. Does nothing outside the Android app.
 */
@Injectable({ providedIn: 'root' })
export class WidgetService {
  private readonly auth = inject(AuthService);
  private readonly stats = inject(StatsService);
  private readonly board = inject(LeaderboardService);
  private readonly supported = Capacitor.getPlatform() === 'android';

  /** Pushes numbers the caller already has. */
  async push(streak: number, done: number, total: number, rolloverUtc: string): Promise<void> {
    if (!this.supported) return;
    try {
      await StreakWidget.update({ streak, done, total, rollover: Date.parse(rolloverUtc) || 0 });
    } catch {
      /* no widget placed, or an older build */
    }
  }

  /** Reads the latest from the server and pushes it (call when the server is awake anyway, e.g. right after a daily is solved). */
  async refresh(): Promise<void> {
    if (!this.supported || !this.auth.signedIn()) return;
    try {
      const [stats, hub] = await Promise.all([this.stats.load(), this.board.dailyHub()]);
      const done = hub.games.filter((g) => ['solved', 'won', 'lost'].includes(g.status)).length;
      await this.push(Math.max(0, ...stats.games.map((g) => g.current)), done, hub.games.length, hub.nextRolloverUtc);
    } catch {
      /* the widget keeps its last numbers */
    }
  }
}
