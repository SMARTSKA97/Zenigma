import { ChangeDetectionStrategy, Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { ConnectionService } from '../../core/connection.service';
import { Leaderboard, LeaderboardService } from '../../core/leaderboard.service';
import { gameInfo, SKILLS } from '../../games/catalog';
import { MindDailyService } from '../../games/mind/mind-daily';
import { MIND_META } from '../../games/mind/mind-meta';
import { Glyph } from '../../shared/glyph';
import { CardInput } from '../../shared/share-card';
import { ShareSheet } from '../../shared/share-sheet';

/** Today's mind set: one short game from each skill, the same for everyone. */
@Component({
  selector: 'app-mind-daily-panel',
  imports: [RouterLink, Glyph, ShareSheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mind-daily-panel.html',
  styleUrl: './mind-daily-panel.scss',
})
export class MindDailyPanel implements OnInit {
  protected readonly daily = inject(MindDailyService);
  private readonly api = inject(LeaderboardService);
  protected readonly auth = inject(AuthService);
  private readonly conn = inject(ConnectionService);
  protected readonly sharing = signal(false);

  /** The finished set as a card: points out of the maximum (no answers, so nothing is spoiled) and the day's streak. */
  protected readonly shareData = computed<{ card: CardInput; text: string }>(() => {
    const score = `${this.daily.points()} / ${this.daily.maxPoints()}`;
    const streak = this.daily.streak();
    return {
      text: `Zenigma mind set ${this.daily.date()}: ${score}${streak ? ` · 🔥 ${streak}` : ''}\nhttps://zenigma.ska97homelab.uk`,
      card: { name: 'Mind set', label: `Daily ${this.daily.date()}`, hue: 285, grid: [], score, streak },
    };
  });
  protected readonly period = signal<'today' | 'week'>('today');
  protected readonly board = signal<Leaderboard | null>(null);
  protected readonly boardFailed = signal(false);

  constructor() {
    // Reload the board when the period changes, and again when today's set is finished (so the player's own points show).
    effect(() => {
      const period = this.period();
      this.daily.points();
      if (!this.auth.signedIn() || !this.conn.serverReady()) return;
      this.api.mindBoard(period).then((b) => (this.board.set(b), this.boardFailed.set(false))).catch(() => this.boardFailed.set(true));
    });
  }

  ngOnInit(): void {
    this.daily.refresh();
  }

  protected info(id: string) {
    return gameInfo(id);
  }

  protected skill(id: string) {
    return SKILLS.find((s) => s.id === MIND_META[id as keyof typeof MIND_META]?.skill);
  }

  protected firstOpen(): string | null {
    return this.daily.games().find((g) => !this.daily.results()[g]) ?? null;
  }
}
