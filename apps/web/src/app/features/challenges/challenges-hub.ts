import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DailyHub } from '../daily/daily-hub';
import { WordDailyPanel } from '../daily/word-daily-panel';
import { DayStreakService } from '../../core/day-streak.service';
import { DayStreakCard } from '../../shared/day-streak-card';
import { MindDailyPanel } from '../mind/mind-daily-panel';
import { ChallengesPage } from './challenges';

type Tab = 'puzzles' | 'mind' | 'extras' | 'goals';

/** Everything with a clock on it, in one place: today's puzzles, today's mind set, and the weekly and monthly goals. */
@Component({
  selector: 'app-challenges-hub',
  imports: [DailyHub, WordDailyPanel, MindDailyPanel, ChallengesPage, DayStreakCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './challenges-hub.html',
  styleUrl: './challenges-hub.scss',
})
export class ChallengesHub {
  private readonly route = inject(ActivatedRoute);
  protected readonly ds = inject(DayStreakService);
  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'puzzles', label: 'Puzzles' },
    { id: 'mind', label: 'Mind' },
    { id: 'extras', label: 'Extras' },
    { id: 'goals', label: 'Goals' },
  ];
  protected readonly tab = signal<Tab>(this.initial());

  private initial(): Tab {
    const t = this.route.snapshot.queryParamMap.get('tab');
    return t === 'mind' || t === 'goals' || t === 'extras' ? t : 'puzzles';
  }

  protected pick(t: Tab): void {
    this.tab.set(t);
    try {
      history.replaceState(history.state, '', `${location.pathname}?tab=${t}`);
    } catch {
      /* the address bar is a nicety */
    }
  }
}
