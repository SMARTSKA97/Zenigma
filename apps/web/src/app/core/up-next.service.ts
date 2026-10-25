import { computed, inject, Injectable, signal } from '@angular/core';
import { gameInfo } from '../games/catalog';
import { MindDailyService } from '../games/mind/mind-daily';
import { WordDailyService } from '../games/mind/word-daily';
import { AuthService } from './auth.service';
import { ConnectionService } from './connection.service';
import { DayStreakService } from './day-streak.service';
import { DailyHub, LeaderboardService } from './leaderboard.service';

export interface UpNextItem {
  id: string;
  name: string;
  /** Where the game is played today. */
  link: string;
  group: 'Puzzles' | 'Mind set' | 'Extra dailies';
}

const FINISHED = ['solved', 'won', 'lost'];

/** Today's dailies that have not been played yet, in the order worth playing them: puzzles, the mind set, then the extras they unlock. */
@Injectable({ providedIn: 'root' })
export class UpNextService {
  private readonly api = inject(LeaderboardService);
  private readonly auth = inject(AuthService);
  private readonly conn = inject(ConnectionService);
  private readonly mind = inject(MindDailyService);
  private readonly word = inject(WordDailyService);
  private readonly ds = inject(DayStreakService);
  private readonly hub = signal<DailyHub | null>(null);

  readonly items = computed<UpNextItem[]>(() => {
    const out: UpNextItem[] = [];
    const hub = this.hub();
    for (const g of hub?.games ?? []) {
      if (g.available && !FINISHED.includes(g.status)) out.push({ id: g.game, name: gameInfo(g.game)?.name ?? g.game, link: `/daily/${g.game}`, group: 'Puzzles' });
    }
    const mindDone = this.mind.results();
    for (const g of this.mind.games()) {
      if (!mindDone[g]) out.push({ id: g, name: gameInfo(g)?.name ?? g, link: `/mind/${g}`, group: 'Mind set' });
    }
    // The extra dailies open once both halves of today are done.
    if (this.ds.todayDone()) {
      const done = this.word.results();
      for (const g of this.word.games) {
        if (!done[g]) out.push({ id: g, name: gameInfo(g)?.name ?? g, link: `/daily-word/${g}`, group: 'Extra dailies' });
      }
    }
    return out;
  });

  /** Asks the server which puzzles are still open (quietly: offline or signed out, the mind set and extras still show). */
  async refresh(): Promise<void> {
    if (!this.auth.signedIn() || this.conn.offlineMode() || !navigator.onLine) return;
    try {
      const hub = await this.api.dailyHub();
      this.hub.set(hub);
      const ready = hub.games.filter((g) => g.available);
      if (ready.length > 0 && ready.every((g) => FINISHED.includes(g.status))) this.ds.markPuzzlesDone(hub.date);
    } catch {
      /* keep what we had */
    }
  }
}
