import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  template: `
    <h1>Leaderboards</h1>

    <div class="chips" role="tablist" aria-label="Game">
      @for (g of games; track g.id) {
        <button type="button" role="tab" class="chip" [class.on]="game() === g.id" [attr.aria-selected]="game() === g.id" [style.--h]="g.hue" (click)="pickGame(g.id)">
          <span class="ico"><app-glyph [game]="g.id" /></span>{{ g.name }}
        </button>
      }
    </div>

    <app-segmented class="seg" label="Board" [options]="kindOptions" [value]="kind()" (valueChange)="pickKind($event)" />
    @if (kind() === 'daily') {
      <app-segmented class="seg" label="Period" [options]="dailyPeriods" [value]="period()" (valueChange)="period.set($event)" />
    } @else {
      <app-segmented class="seg" label="Period" [options]="practicePeriods" [value]="period()" (valueChange)="period.set($event)" />
    }

    <p class="muted caption">{{ caption() }}</p>

    @if (loading()) {
      <div class="list" aria-busy="true">
        @for (n of [1, 2, 3, 4, 5, 6]; track n) {
          <div class="skeleton line"></div>
        }
      </div>
    } @else if (failed()) {
      <section class="card empty">
        <p class="muted">Could not load the leaderboard{{ sync.online() ? '' : ' while offline' }}.</p>
        <button type="button" (click)="load()">Try again</button>
      </section>
    } @else if (board(); as b) {
      @if (b.entries.length === 0) {
        <section class="card empty">
          <h2>No one yet</h2>
          <p class="muted">{{ kind() === 'daily' ? 'Be the first to finish today.' : 'Solve a level to get on the board.' }}</p>
          <a class="button" [routerLink]="kind() === 'daily' ? ['/daily', game()] : ['/games', game()]">Play {{ gameName() }}</a>
        </section>
      } @else {
        <ol class="list">
          @for (e of b.entries; track e.rank) {
            <li class="line" [class.me]="e.isMe" [style.--i]="$index">
              <span class="pos" [attr.data-top]="e.rank <= 3 ? e.rank : null">{{ e.rank }}</span>
              <span class="who">{{ e.name }}@if (e.isMe) { <em>you</em> }</span>
              <span class="val">{{ valueOf(e.value, e.secondary) }}</span>
            </li>
          }
          @if (b.me && !inList(b)) {
            <li class="gap" aria-hidden="true">···</li>
            <li class="line me">
              <span class="pos">{{ b.me.rank }}</span>
              <span class="who">{{ b.me.name }} <em>you</em></span>
              <span class="val">{{ valueOf(b.me.value, b.me.secondary) }}</span>
            </li>
          }
        </ol>
      }
    }
  `,
  styleUrl: './ranks.scss',
})
export class Ranks {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(LeaderboardService);
  protected readonly sync = inject(SyncService);
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
    effect(() => {
      // Practice has no "today" board.
      if (this.kind() === 'practice' && this.period() === 'today') untracked(() => this.period.set('week'));
    });
    effect(() => {
      this.game();
      this.kind();
      this.period();
      untracked(() => void this.load());
    });
  }

  protected pickGame(game: string): void {
    void this.router.navigate([], { queryParams: { game }, queryParamsHandling: 'merge', replaceUrl: true });
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
      const board = await this.api.board(this.game(), this.kind(), this.period());
      if (id === this.requestId) this.board.set(board);
    } catch {
      if (id === this.requestId) this.failed.set(true);
    } finally {
      if (id === this.requestId) this.loading.set(false);
    }
  }
}
