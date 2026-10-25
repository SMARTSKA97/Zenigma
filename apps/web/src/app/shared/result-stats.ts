import { ChangeDetectionStrategy, Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { indiaDate } from '../core/hints.service';
import { formatDuration } from '../core/leaderboard.service';
import { GameStats, StatsService } from '../core/stats.service';

/** Under a finished daily: the player's numbers for the game and the last seven days of the streak, like a streak calendar. */
@Component({
  selector: 'app-result-stats',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (g(); as s) {
      <section class="rs" aria-label="Your stats for this game">
        <dl class="nums">
          <div><dt>Solved</dt><dd>{{ s.solved }}</dd></div>
          <div><dt>Best time</dt><dd>{{ s.bestMs ? time(s.bestMs) : '-' }}</dd></div>
          <div><dt>Average</dt><dd>{{ s.averageMs ? time(s.averageMs) : '-' }}</dd></div>
          <div><dt>Best streak</dt><dd>{{ s.best }}</dd></div>
        </dl>
        <div class="streak">
          <b>{{ streak() }}-day streak <span aria-hidden="true">🔥</span></b>
          <ol aria-label="Last seven days">
            @for (d of week(); track d.date) {
              <li [class.on]="d.on" [class.today]="d.today"><span class="dot" aria-hidden="true">{{ d.on ? '✓' : '' }}</span><small>{{ d.label }}</small></li>
            }
          </ol>
        </div>
      </section>
    }
  `,
  styles: `
    :host { display: block; width: 100%; }
    .rs { display: grid; gap: 0.7rem; padding: 0.8rem 0.9rem; border-radius: 20px; background: var(--surface-2); text-align: left; }
    .nums { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3rem; margin: 0; text-align: center; }
    dt { color: var(--muted); font-size: 0.72rem; }
    dd { margin: 0; font-size: 1.1rem; font-weight: 800; font-variant-numeric: tabular-nums; }
    .streak { display: grid; gap: 0.5rem; }
    ol { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.2rem; margin: 0; padding: 0; list-style: none; text-align: center; }
    li { display: grid; justify-items: center; gap: 0.15rem; color: var(--muted); }
    .dot { display: grid; place-items: center; width: 1.7rem; height: 1.7rem; border-radius: 50%; border: 2px solid var(--border); font-size: 0.85rem; font-weight: 800; color: #3a2a00; }
    li.on .dot { background: #f5b82e; border-color: #f5b82e; }
    li.today small { color: var(--text); font-weight: 800; }
  `,
})
export class ResultStats implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly stats = inject(StatsService);
  readonly game = input.required<string>();
  protected readonly all = signal<GameStats | null>(null);
  protected readonly g = computed(() => this.all());

  /** The streak as the server counts it, but never below today (this result is today's). */
  protected readonly streak = computed(() => Math.max(1, this.all()?.current ?? 0));
  protected readonly week = computed(() => {
    const s = this.all();
    const out: { date: string; label: string; on: boolean; today: boolean }[] = [];
    const today = indiaDate();
    for (let i = 6; i >= 0; i--) {
      const date = indiaDate(Date.now() - i * 86_400_000);
      const label = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
      out.push({ date, label, today: date === today, on: date === today || !!s?.recent.includes(date) || !!s?.frozen.includes(date) });
    }
    return out;
  });

  protected time(ms: number): string {
    return formatDuration(ms);
  }

  async ngOnInit(): Promise<void> {
    if (!this.auth.signedIn()) return;
    try {
      const stats = await this.stats.load();
      this.all.set(stats.games.find((g) => g.game === this.game()) ?? null);
    } catch {
      /* the result is still shown without the numbers */
    }
  }
}
