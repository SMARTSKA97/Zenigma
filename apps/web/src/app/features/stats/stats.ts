import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { formatDuration } from '../../core/leaderboard.service';
import { GameStats, Stats, StatsService } from '../../core/stats.service';
import { SyncService } from '../../core/sync.service';
import { DAILY_GAMES } from '../../games/catalog';
import { Glyph } from '../../shared/glyph';
import { FreezeList } from '../../shared/freeze-sheet';

/** Per-game streaks, times and a five-week calendar, plus the streak freezes each game has earned. */
@Component({
  selector: 'app-stats',
  imports: [RouterLink, Glyph, FreezeList],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Your stats</h1>
    <p class="muted"><a routerLink="/badges">See your badges ›</a></p>

    @if (!auth.signedIn()) {
      <section class="card cta">
        <div>
          <h2>Sign in to see your stats</h2>
          <p class="muted">Streaks and times come from your daily results.</p>
        </div>
        <a class="button" routerLink="/account">Sign in</a>
      </section>
    } @else if (loading()) {
      <div class="skeleton block"></div>
      <div class="skeleton block tall"></div>
    } @else if (failed()) {
      <section class="card cta">
        <p class="muted">Could not load your stats{{ sync.online() ? '' : ' while offline' }}.</p>
        <button type="button" (click)="load()">Try again</button>
      </section>
    } @else if (stats(); as s) {
      <section class="rewards card">
        <h2>❄ Streak freezes</h2>
        <app-freeze-list [stats]="s" />
      </section>

      <div class="list">
        @for (g of games(); track g.game; let i = $index) {
          <article class="card game" [style.--h]="hue(g.game)" [style.--i]="i">
            <header>
              <span class="art"><app-glyph [game]="$any(g.game)" /></span>
              <div class="name">
                <h2>{{ name(g.game) }}</h2>
                <p class="muted">{{ g.solved }} {{ g.solved === 1 ? 'daily' : 'dailies' }} solved</p>
              </div>
              <div class="streak" [class.on]="g.current > 0" [attr.aria-label]="g.current + ' day streak'">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5c.5 3-1.5 4.7-3 6.4-1.3 1.5-2.3 3-2.3 5.2a5.3 5.3 0 0 0 10.6 0c0-1.7-.6-3-1.5-4.2-.3 1.2-1 1.9-1.8 2.2.4-3.2-.5-6.5-2-9.6z" /></svg>
                <strong>{{ g.current }}</strong>
              </div>
            </header>

            <dl>
              <div><dt>Best streak</dt><dd>{{ g.best }}</dd></div>
              @if (g.game === 'word-guess') {
                <div><dt>Best</dt><dd>{{ g.bestGuesses ?? '–' }}</dd></div>
                <div><dt>Average</dt><dd>{{ g.averageGuesses ?? '–' }}</dd></div>
              } @else {
                <div><dt>Best time</dt><dd>{{ g.bestMs !== null ? time(g.bestMs) : '–' }}</dd></div>
                <div><dt>Average</dt><dd>{{ g.averageMs !== null ? time(g.averageMs) : '–' }}</dd></div>
              }
            </dl>

            <div class="calendar" role="img" [attr.aria-label]="'Last five weeks: ' + g.recent.length + ' days solved'">
              @for (d of days(); track d) {
                <i [class.solved]="g.recent.includes(d)" [class.frozen]="g.frozen.includes(d)" [class.today]="d === s.date" [attr.title]="d"></i>
              }
            </div>
          </article>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 40rem;
      margin: 0 auto;
    }
    h1 {
      margin-bottom: 1.25rem;
    }
    .cta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      h2,
      p {
        margin: 0;
      }
    }
    .block {
      height: 9rem;
      border-radius: var(--radius);
      margin-bottom: 1rem;
    }
    .block.tall {
      height: 16rem;
    }
    .rewards {
      display: grid;
      gap: 1.25rem;
      margin-bottom: 1rem;
    }
    .freeze {
      display: flex;
      align-items: center;
      gap: 1rem;
      h2,
      p {
        margin: 0;
      }
      p {
        font-size: 0.85rem;
      }
    }
    .ice {
      display: flex;
      gap: 0.35rem;
      svg {
        width: 2.2rem;
        height: 2.2rem;
        padding: 0.35rem;
        border-radius: 12px;
        fill: none;
        stroke: var(--muted);
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
        background: var(--surface-2);
        transition: all 0.4s var(--spring);
      }
      svg.on {
        stroke: #2b8fd6;
        background: color-mix(in srgb, #2b8fd6 18%, var(--surface));
      }
    }
    .week .row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
      font-size: 0.9rem;
    }
    .bar {
      height: 10px;
      border-radius: 99px;
      background: var(--surface-2);
      overflow: hidden;
      span {
        display: block;
        height: 100%;
        border-radius: 99px;
        background: var(--accent);
        transition: width 0.7s var(--ease);
      }
    }
    .small {
      margin: 0.5rem 0 0;
      font-size: 0.8rem;
    }
    .list {
      display: grid;
      gap: 0.9rem;
    }
    .game {
      animation: rise 0.45s var(--ease) backwards;
      animation-delay: calc(var(--i) * 70ms);
      header {
        display: flex;
        align-items: center;
        gap: 0.9rem;
      }
      h2,
      p {
        margin: 0;
      }
      .name {
        flex: 1;
        min-width: 0;
      }
    }
    .art {
      flex: none;
      width: 3rem;
      height: 3rem;
      padding: 0.5rem;
      border-radius: 14px;
      background: oklch(var(--tile-l) var(--tile-c) calc(var(--h) * 1deg));
      color: oklch(var(--glyph-l) var(--glyph-c) calc(var(--h) * 1deg));
    }
    .streak {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.35rem 0.8rem 0.35rem 0.6rem;
      border-radius: 999px;
      background: var(--surface-2);
      color: var(--muted);
      font-family: var(--font-display);
      svg {
        width: 1.3rem;
        height: 1.3rem;
        fill: currentColor;
      }
      strong {
        font-size: 1.15rem;
      }
    }
    .streak.on {
      background: color-mix(in srgb, #f08a12 18%, var(--surface));
      color: #e07a00;
    }
    dl {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 0.5rem;
      margin: 1rem 0;
      div {
        padding: 0.6rem 0.75rem;
        border-radius: 14px;
        background: var(--surface-2);
      }
      dt {
        font-size: 0.72rem;
        color: var(--muted);
      }
      dd {
        margin: 0;
        font-family: var(--font-display);
        font-size: 1.15rem;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }
    }
    .calendar {
      display: grid;
      grid-template-columns: repeat(14, 1fr);
      gap: 4px;
      i {
        aspect-ratio: 1;
        border-radius: 5px;
        background: var(--surface-2);
      }
      i.solved {
        background: var(--good);
      }
      i.frozen {
        background: #2b8fd6;
      }
      i.today {
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }
    }
  `,
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
