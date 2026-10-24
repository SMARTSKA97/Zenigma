import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AuthService } from '../core/auth.service';
import { ShareSheet } from './share-sheet';
import { streakShare } from './streak-share';
import { DayStreakService } from '../core/day-streak.service';

/** The daily streak: both halves of today (the mind set and the puzzles) have to be finished. */
@Component({
  selector: 'app-day-streak-card',
  imports: [ShareSheet],
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
      @if (ds.streak() > 0) {
        <button type="button" class="share" (click)="open.set(true)" aria-label="Share your streak">Share</button>
      }
    </div>
    @if (open()) {
      <app-share-sheet [streakCard]="share().streakCard" [text]="share().text" (closed)="open.set(false)" />
    }
    <p class="muted fine">Finish both every day to keep this streak going.</p>
  `,
  styles: `
    :host { display: block; margin: 0 0 12px; }
    .ds { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 16px; background: var(--surface); border: 1px solid var(--border); }
    .ds.done { border-color: #2f9e6b; }
    .fire { font-size: 1.6rem; }
    .share { margin-left: auto; min-height: 0; padding: 0.35rem 0.85rem; border-radius: 999px; font-size: 0.82rem; font-weight: 700; background: transparent; color: var(--accent); border: 1px solid var(--border); box-shadow: none; }
    .body { display: grid; gap: 2px; }
    .halves { display: flex; gap: 14px; font-size: 0.85rem; color: var(--muted); }
    .halves .ok { color: #2f9e6b; font-weight: 600; }
    .fine { margin: 4px 4px 0; font-size: 0.78rem; }
  `,
})
export class DayStreakCard {
  protected readonly ds = inject(DayStreakService);
  private readonly auth = inject(AuthService);
  protected readonly open = signal(false);
  protected readonly share = computed(() => streakShare(this.ds.streak(), this.auth.user()?.displayName));
}
