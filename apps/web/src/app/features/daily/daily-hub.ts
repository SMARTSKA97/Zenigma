import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { DailyGameStatus, DailyHub as Hub, formatDuration, LeaderboardService } from '../../core/leaderboard.service';
import { SyncService } from '../../core/sync.service';
import { DAILY_GAMES } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';

@Component({
  selector: 'app-daily-hub',
  imports: [RouterLink, Glyph],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="hero">
      <p class="eyebrow">Daily challenge</p>
      <h1>{{ doneCount() }} of {{ games.length }} done today</h1>
      <p class="lede">One puzzle per game, the same for everyone. Next set in <strong>{{ untilNext() }}</strong>.</p>
      <div class="dots" aria-hidden="true">
        @for (g of games; track g.id) {
          <i [class.on]="statusOf(g.id)?.status === 'solved' || statusOf(g.id)?.status === 'won' || statusOf(g.id)?.status === 'lost'"></i>
        }
      </div>
    </section>

    @if (!auth.signedIn()) {
      <section class="card cta">
        <div>
          <h2>Sign in to play</h2>
          <p class="muted">Daily results go on the leaderboard, so they need an account.</p>
        </div>
        <a class="button" routerLink="/account">Sign in</a>
      </section>
    }

    @if (loading()) {
      <div class="list" aria-busy="true">
        @for (n of [1, 2, 3, 4]; track n) {
          <div class="skeleton row-skeleton"></div>
        }
      </div>
    } @else if (failed()) {
      <section class="card cta">
        <p class="muted">Could not load today's challenges.</p>
        <button type="button" (click)="load()">Try again</button>
      </section>
    } @else {
      <div class="list">
        @for (g of games; track g.id) {
          @let st = statusOf(g.id);
          <article class="item" [style.--h]="g.hue">
            <span class="art"><app-glyph [game]="g.id" /></span>
            <div class="info">
              <h3>{{ g.name }}</h3>
              <p class="muted">{{ describe(st) }}</p>
            </div>
            <div class="end">
              @if (st?.rank) {
                <a class="rank" [routerLink]="['/ranks']" [queryParams]="{ game: g.id, kind: 'daily' }" aria-label="Leaderboard">#{{ st!.rank }}</a>
              }
              @if (!st || !st.available) {
                <span class="muted small">Not ready</span>
              } @else if (st.status === 'new') {
                <a class="button" [routerLink]="['/daily', g.id]">Play</a>
              } @else if (st.status === 'playing') {
                <a class="button" [routerLink]="['/daily', g.id]">Resume</a>
              } @else {
                <a class="button secondary" [routerLink]="['/ranks']" [queryParams]="{ game: g.id, kind: 'daily' }">Ranks</a>
              }
            </div>
          </article>
        }
      </div>
    }

    <p class="foot muted">Want to play for fun? Practice is endless and works offline. <a routerLink="/">Open practice</a></p>
  `,
  styleUrl: './daily-hub.scss',
})
export class DailyHub implements OnInit, OnDestroy {
  protected readonly auth = inject(AuthService);
  private readonly sync = inject(SyncService);
  private readonly api = inject(LeaderboardService);

  protected readonly games = DAILY_GAMES;
  protected readonly hub = signal<Hub | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  private readonly now = signal(Date.now());
  private tick?: ReturnType<typeof setInterval>;

  protected readonly doneCount = computed(() => (this.hub()?.games ?? []).filter((g) => ['solved', 'won', 'lost'].includes(g.status)).length);
  protected readonly untilNext = computed(() => {
    const target = this.hub()?.nextRolloverUtc;
    if (!target) return '…';
    const minutes = Math.max(0, Math.ceil((Date.parse(target) - this.now()) / 60000));
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  });

  ngOnInit(): void {
    this.tick = setInterval(() => this.now.set(Date.now()), 30_000);
    void this.load();
  }

  ngOnDestroy(): void {
    clearInterval(this.tick);
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
    if (!this.sync.online()) {
      this.loading.set(false);
      this.failed.set(true);
      return;
    }
    try {
      this.hub.set(await this.api.dailyHub());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
