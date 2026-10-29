import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { ScreenGuardService } from '../../core/screen-guard.service';
import { AuthService } from '../../core/auth.service';
import { BackService } from '../../core/back.service';
import { ConnectionService } from '../../core/connection.service';
import { HapticsService } from '../../core/haptics.service';
import { formatDuration, Leaderboard, LeaderboardService } from '../../core/leaderboard.service';
import { gameInfo } from '../../games/catalog';
import { ChainLink } from '../../games/mind/chain-link';
import { CometSlice } from '../../games/mind/comet-slice';
import { Crossclimb } from '../../games/mind/crossclimb';
import { MIND_META } from '../../games/mind/mind-meta';
import { MindResult } from '../../games/mind/mind-util';
import { Pinpoint } from '../../games/mind/pinpoint';
import { Wend } from '../../games/mind/wend';
import { dailyPoints, isWordDaily, WordDailyGame, WordDailyService } from '../../games/mind/word-daily';
import { DayStreakService } from '../../core/day-streak.service';
import { Glyph } from '../../shared/glyph';
import { UpNext } from '../../shared/up-next';
import { CardInput } from '../../shared/share-card';
import { ShareSheet } from '../../shared/share-sheet';

/** One word daily: the puzzle of the day (the same for everyone), played once, with today's board under the result. */
@Component({
  selector: 'app-word-daily-page',
  imports: [RouterLink, Glyph, ShareSheet, UpNext, Pinpoint, ChainLink, Crossclimb, Wend, CometSlice],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './word-daily-page.html',
  styleUrl: './word-daily-page.scss',
})
export class WordDailyPage {
  protected readonly nav = inject(BackService);
  protected readonly daily = inject(WordDailyService);
  protected readonly auth = inject(AuthService);
  protected readonly ds = inject(DayStreakService);
  /** The extra dailies open once today's puzzles and mind set are done (a result already in stays visible). */
  protected readonly locked = computed(() => !this.ds.todayDone() && !this.result());
  private readonly conn = inject(ConnectionService);
  private readonly api = inject(LeaderboardService);
  private readonly haptics = inject(HapticsService);
  private readonly route = inject(ActivatedRoute);

  protected readonly id = toSignal(this.route.paramMap.pipe(map((p) => p.get('game') ?? '')), { initialValue: '' });
  protected readonly game = computed<WordDailyGame | null>(() => (isWordDaily(this.id()) ? (this.id() as WordDailyGame) : null));
  protected readonly info = computed(() => gameInfo(this.id()));
  protected readonly how = computed(() => MIND_META[this.id() as keyof typeof MIND_META]?.how ?? '');
  protected readonly stage = signal<'intro' | 'play' | 'result'>('intro');
  protected readonly detail = signal('');
  protected readonly sharing = signal(false);

  /** A card with the score out of 100 (no answers, so nothing is spoiled), the time and today's streak. */
  protected readonly shareData = computed<{ card: CardInput; text: string } | null>(() => {
    const r = this.result();
    const info = this.info();
    if (!r || !info) return null;
    const score = `${r.points} / 100`;
    return {
      text: `Zenigma ${info.name} ${this.daily.date()}: ${score} in ${formatDuration(r.ms)}\nhttps://zenigma.ska97homelab.uk`,
      card: { name: info.name, label: `Daily ${this.daily.date()}`, hue: info.hue, grid: [], score, time: formatDuration(r.ms), streak: this.ds.streak() },
    };
  });
  protected readonly board = signal<Leaderboard | null>(null);
  protected readonly boardFailed = signal(false);
  protected readonly seed = computed(() => (this.game() ? this.daily.seed(this.game()!) : ''));
  protected readonly result = computed(() => (this.game() ? this.daily.results()[this.game()!] ?? null : null));
  private startedAt = 0;

  protected readonly what = computed(() => {
    switch (this.game()) {
      case 'pinpoint': return 'One category, worth 5 points on the first clue down to 1.';
      case 'chain-link': return 'One long chain of seven links. Three lives.';
      case 'crossclimb': return 'One ladder with four rows to find. Three lives.';
      case 'wend': return 'One board. Fewer hints is better.';
      case 'comet-slice': return 'The same comets and skulls for everyone. One run, a minute at most.';
      default: return '';
    }
  });

  private readonly guard = inject(ScreenGuardService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.daily.refresh();
    // While today's challenge is open, keep the screen on and (on Android) block screenshots, as for the puzzle dailies.
    effect(() => {
      const playing = this.stage() === 'play';
      untracked(() => (playing ? this.guard.enter(true) : this.guard.leave()));
    });
    this.destroyRef.onDestroy(() => this.guard.leave());
    // Already played today: straight to the result.
    effect(() => {
      if (this.stage() === 'intro' && this.result()) this.stage.set('result');
    });
    // The board, once the server is awake anyway and again when the result arrives.
    effect(() => {
      const game = this.game();
      this.result();
      if (!game || !this.auth.signedIn() || !this.conn.serverReady() || this.stage() !== 'result') return;
      this.api.wordDailyBoard(game, 'today').then((b) => (this.board.set(b), this.boardFailed.set(false))).catch(() => this.boardFailed.set(true));
    });
  }

  protected start(): void {
    this.daily.refresh();
    this.startedAt = Date.now();
    this.stage.set('play');
  }

  protected finish(r: MindResult): void {
    const game = this.game();
    if (!game) return;
    const points = dailyPoints(game, r.score, this.daily.date());
    this.detail.set(r.detail ?? '');
    this.daily.record(game, points, Date.now() - this.startedAt);
    this.haptics.success();
    this.stage.set('result');
  }

  protected time(ms: number): string {
    return formatDuration(ms);
  }
}
