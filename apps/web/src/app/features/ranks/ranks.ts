import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { Circle, CirclesService } from '../../core/circles.service';
import { formatDuration, Leaderboard, LeaderboardService } from '../../core/leaderboard.service';
import { SyncService } from '../../core/sync.service';
import { DAILY_GAMES } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';
import { Segmented, SegmentOption } from '../../shared/segmented';

type Kind = 'daily' | 'practice';
type Period = 'today' | 'week' | 'all';

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

  protected readonly games = DAILY_GAMES;
  protected readonly kindOptions: SegmentOption<Kind>[] = [
    { value: 'daily', label: 'Daily' },
    { value: 'practice', label: 'Practice' },
  ];
  protected readonly dailyPeriods: SegmentOption<Period>[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This week' },
    { value: 'all', label: 'All time' },
  ];
  protected readonly practicePeriods: SegmentOption<Period>[] = [
    { value: 'week', label: 'This week' },
    { value: 'all', label: 'All time' },
  ];

  protected readonly game = computed(() => {
    const id = this.query()?.get('game') ?? 'word-guess';
    return DAILY_GAMES.some((g) => g.id === id) ? id : 'word-guess';
  });
  protected readonly kind = computed<Kind>(() => (this.query()?.get('kind') === 'practice' ? 'practice' : 'daily'));
  protected readonly circle = computed(() => {
    const id = this.query()?.get('circle');
    return id && this.circles().some((c) => c.id === id) ? id : null;
  });
  protected readonly period = signal<Period>('today');
  protected readonly board = signal<Leaderboard | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly gameName = computed(() => DAILY_GAMES.find((g) => g.id === this.game())?.name ?? '');
  private requestId = 0;

  protected readonly caption = computed(() => {
    const p = this.period();
    if (this.kind() === 'daily') {
      return p === 'today' ? 'Fastest finishes of today\'s puzzle.' : p === 'week' ? 'Most daily wins this week; ties go to the faster total.' : 'Most daily wins ever; ties go to the faster total.';
    }
    return p === 'week' ? 'Most levels solved this week.' : 'Most levels solved in total.';
  });

  constructor() {
    if (this.auth.signedIn()) void this.circlesApi.list().then((c) => this.circles.set(c)).catch(() => undefined);
    effect(() => {
      // Practice has no "today" board.
      if (this.kind() === 'practice' && this.period() === 'today') untracked(() => this.period.set('week'));
    });
    effect(() => {
      this.game();
      this.kind();
      this.period();
      this.circle();
      untracked(() => void this.load());
    });
  }

  protected pickGame(game: string): void {
    void this.router.navigate([], { queryParams: { game }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected pickCircle(circle: string | null): void {
    void this.router.navigate([], { queryParams: { circle }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected pickKind(kind: Kind): void {
    void this.router.navigate([], { queryParams: { kind }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  protected inList(b: Leaderboard): boolean {
    return b.entries.some((e) => e.isMe);
  }

  /** Daily today shows a time (or guess count for Word Guess); every other board shows a count. */
  protected valueOf(value: number, secondary: number): string {
    const b = this.board();
    if (b?.kind === 'daily' && b.period === 'today') return this.game() === 'word-guess' ? `${value} ${value === 1 ? 'guess' : 'guesses'}` : formatDuration(value);
    const unit = b?.kind === 'daily' ? (value === 1 ? 'win' : 'wins') : value === 1 ? 'level' : 'levels';
    return secondary > 0 && b?.kind === 'daily' ? `${value} ${unit}` : `${value} ${unit}`;
  }

  protected async load(): Promise<void> {
    const id = ++this.requestId;
    this.loading.set(true);
    this.failed.set(false);
    try {
      const board = await this.api.board(this.game(), this.kind(), this.period(), this.circle());
      if (id === this.requestId) this.board.set(board);
    } catch {
      if (id === this.requestId) this.failed.set(true);
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }
}
