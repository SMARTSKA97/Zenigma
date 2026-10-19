import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DayStreakService } from '../core/day-streak.service';

/** The daily streak: both halves of today (the mind set and the puzzles) have to be finished. */
@Component({
  selector: 'app-day-streak-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ds" [class.done]="ds.todayDone()">
      <span class="fire" aria-hidden="true">🔥</span>
      <span class="body">
        <b>{{ ds.streak() }}-day streak{{ ds.todayDone() ? ' · today is done' : '' }}</b>
        <span class="halves">
          <span [class.ok]="ds.mindDone()">{{ ds.mindDone() ? '✓' : '○' }} Mind set</span>
          <span [class.ok]="ds.puzzlesDone()">{{ ds.puzzlesDone() ? '✓' : '○' }} Puzzles</span>
        </span>
      </span>
    </div>
    <p class="muted fine">Finish both every day to keep this streak going.</p>
  `,
  styles: `
    :host { display: block; margin: 0 0 12px; }
    .ds { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); }
    .ds.done { border-color: #2f9e6b; }
    .fire { font-size: 1.6rem; }
    .body { display: grid; gap: 2px; }
    .halves { display: flex; gap: 14px; font-size: 0.85rem; color: var(--muted); }
    .halves .ok { color: #2f9e6b; font-weight: 600; }
    .fine { margin: 4px 4px 0; font-size: 0.78rem; }
  `,
})
export class DayStreakCard {
  protected readonly ds = inject(DayStreakService);
}
