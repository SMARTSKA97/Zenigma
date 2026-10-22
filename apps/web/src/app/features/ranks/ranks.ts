import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Circle, CirclesService } from '../../core/circles.service';
import { formatDuration, Leaderboard, LeaderboardService } from '../../core/leaderboard.service';
import { SyncService } from '../../core/sync.service';
import { DAILY_GAMES, gameInfo, MIND_LIVE } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';
import { Segmented, SegmentOption } from '../../shared/segmented';

type Kind = 'daily' | 'practice';
type Period = 'today' | 'week' | 'all';
type Group = 'puzzles' | 'mind';

interface RankGame {
  id: string;
  name: string;
  hue: number;
}

/** The mind games with a daily board: the daily set, then the extra dailies. */
const MIND_DAILY_IDS = ['pinpoint', 'chain-link', 'crossclimb', 'wend', 'comet-slice'];
const rankGame = (id: string): RankGame => {
  const g = gameInfo(id);
  return { id, name: g?.name ?? id, hue: g?.hue ?? 200 };
};
const MIND_DAILY_GAMES: RankGame[] = [{ id: 'mind-set', name: 'Daily set', hue: 200 }, ...MIND_DAILY_IDS.map(rankGame)];
const MIND_PRACTICE_GAMES: RankGame[] = MIND_LIVE.map(rankGame);

@Component({
  selector: 'app-ranks',
  imports: [RouterLink, Glyph, Segmented],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ranks.html',
  styleUrl: './ranks.scss',
})
export class Ranks {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(LeaderboardService);
  protected readonly sync = inject(SyncService);
  protected readonly auth = inject(AuthService);
  private readonly circlesApi = inject(CirclesService);
  protected readonly circles = signal<Circle[]>([]);
  private readonly query = toSignal(this.route.queryParamMap);

  protected readonly kindOptions: SegmentOption<Kind>[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'practice', label: 'Practice' },
  ];
  protected readonly groupOptions: SegmentOption<Group>[] = [
    { value: 'puzzles', label: 'Puzzles' },
    { value: 'mind', label: 'Mind games' },
  ];
  private readonly allPeriods: Record<Period, SegmentOption<Period>> = {
    today: { value: 'today', label: 'Today' },
    week: { value: 'week', label: 'This week' },
    all: { value: 'all', label: 'All time' },
  };

  protected readonly kind = computed<Kind>(() => (this.query()?.get('kind') === 'practice' ? 'practice' : 'daily'));
  protected readonly group = computed<Group>(() => {
    const asked = this.query()?.get('group');
    if (asked === 'mind' || asked === 'puzzles') return asked;
    // A link to a mind game's board (no section given) opens the mind section.
    return (MIND_LIVE as readonly string[]).includes(this.query()?.get('game') ?? '') ? 'mind' : 'puzzles';
  });
  /** The games of the chosen section: puzzles (and Word Guess), or the mind games that have a board in this mode. */
  protected readonly games = computed<RankGame[]>(() =>
    this.group() === 'puzzles' ? DAILY_GAMES.map((g) => ({ id: g.id, name: g.name, hue: g.hue })) : this.kind() === 'daily' ? MIND_DAILY_GAMES : MIND_PRACTICE_GAMES,
  );
  protected readonly game = computed(() => {
    const id = this.query()?.get('game');
    const list = this.games();
    return list.some((g) => g.id === id) ? (id as string) : list[0].id;
  });
  /** Which periods this board has: mind practice is all-time only. */
  protected readonly periods = computed<SegmentOption<Period>[]>(() => {
    const p = this.allPeriods;
    if (this.group() === 'mind') return this.kind() === 'daily' ? [p.today, p.week] : [p.all];
    return this.kind() === 'daily' ? [p.today, p.week, p.all] : [p.week, p.all];
  });
  protected readonly circle = computed(() => {
    const id = this.query()?.get('circle');
    return this.group() === 'puzzles' && id && this.circles().some((c) => c.id === id) ? id : null;
  });
  protected readonly period = signal<Period>('today');
  protected readonly board = signal<Leaderboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly gameName = computed(() => this.games().find((g) => g.id === this.game())?.name ?? '');
  private requestId = 0;

  protected readonly caption = computed(() => {
    const p = this.period();
    if (this.group() === 'mind') {
      return this.kind() === 'daily'
        ? p === 'today'
          ? 'Points from today\'s mind board, then the faster time.'
          : 'Points added up over this week\'s mind dailies.'
        : 'Each player\'s best mark in this game, out of 100.';
    }
    if (this.kind() === 'daily') {
      return p === 'today' ? 'Fastest finishes of today\'s puzzle.' : p === 'week' ? 'Most daily wins this week; ties go to the faster total.' : 'Most daily wins ever; ties go to the faster total.';
    }
    return p === 'week' ? 'Most levels solved this week.' : 'Most levels solved in total.';
  });

  constructor() {
    if (this.auth.signedIn()) void this.circlesApi.list().then((c) => this.circles.set(c)).catch(() => undefined);
    effect(() => {
      // Keep the period to one this board has (practice has no "today" board, mind practice only all time).
      const options = this.periods();
      if (!options.some((o) => o.value === this.period())) untracked(() => this.period.set(options[0].value));
    });
    effect(() => {
      this.game();
      this.kind();
      this.group();
      this.period();
      this.circle();
      untracked(() => void this.load());
    });
  }

  protected pickGame(game: string): void {
    void this.router.navigate([], { queryParams: { game }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected pickGroup(group: Group): void {
    void this.router.navigate([], { queryParams: { group, game: null, circle: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected pickCircle(circle: string | null): void {
    void this.router.navigate([], { queryParams: { circle }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected pickKind(kind: Kind): void {
    // The mind games on offer differ between daily and practice, so the game is chosen again.
    void this.router.navigate([], { queryParams: { kind, game: this.group() === 'mind' ? null : this.game() }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected inList(b: Leaderboard): boolean {
    return b.entries.some((e) => e.isMe);
  }

  /** Daily today shows a time (or guess count for Word Guess); every other board shows a count. */
  protected valueOf(value: number, secondary: number): string {
    const b = this.board();
    if (this.group() === 'mind') return this.kind() === 'daily' ? `${value} ${value === 1 ? 'point' : 'points'}` : `${value} / 100`;
    if (b?.kind === 'daily' && b.period === 'today') return this.game() === 'word-guess' ? `${value} ${value === 1 ? 'guess' : 'guesses'}` : formatDuration(value);
    const unit = b?.kind === 'daily' ? (value === 1 ? 'win' : 'wins') : value === 1 ? 'level' : 'levels';
    return secondary > 0 && b?.kind === 'daily' ? `${value} ${unit}` : `${value} ${unit}`;
  }

  protected async load(): Promise<void> {
    const id = ++this.requestId;
    const mind = this.group() === 'mind';
    // Show the last board seen at once (if any) and refresh it quietly, instead of a loader.
    const earlier = mind ? null : this.api.peekBoard(this.game(), this.kind(), this.period(), this.circle());
    if (earlier) this.board.set(earlier);
    this.loading.set(!earlier);
    this.failed.set(false);
    try {
      const period = this.period();
      const board = mind
        ? this.kind() === 'practice'
          ? await this.api.mindPracticeBoard(this.game())
          : this.game() === 'mind-set'
            ? await this.api.mindBoard(period === 'week' ? 'week' : 'today')
            : await this.api.wordDailyBoard(this.game(), period === 'week' ? 'week' : 'today')
        : await this.api.board(this.game(), this.kind(), period, this.circle());
      if (id === this.requestId) this.board.set(board);
    } catch {
      if (id === this.requestId && !earlier) this.failed.set(true);
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }
}
