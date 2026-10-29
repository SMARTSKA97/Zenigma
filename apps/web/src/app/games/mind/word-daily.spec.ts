import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncService } from '../../core/sync.service';
import { dailyPoints, dailySeed, isWordDaily, WordDailyService } from './word-daily';

describe('word dailies', () => {
  const record = vi.fn().mockResolvedValue(undefined);
  beforeEach(() => {
    localStorage.clear();
    record.mockClear();
    TestBed.configureTestingModule({ providers: [{ provide: SyncService, useValue: { record } }] });
  });

  it('turns each game\'s score into 0 to 100 points', () => {
    expect(dailyPoints('pinpoint', 5)).toBe(100);
    expect(dailyPoints('pinpoint', 3)).toBe(60);
    expect(dailyPoints('chain-link', 7)).toBe(100);
    expect(dailyPoints('crossclimb', 2)).toBe(50);
    expect(dailyPoints('wend', 400)).toBe(100);
    expect(dailyPoints('wend', -3)).toBe(0);
    expect(dailyPoints('comet-slice', 60, '2026-10-30')).toBe(50); // a hard day: 120 is full marks
    expect(dailyPoints('comet-slice', 500, '2026-10-30')).toBe(100);
    expect(dailyPoints('comet-slice', 15, '2026-10-26')).toBe(50); // an easy day: 30 is full marks
  });

  it('knows its games and gives one seed per game and day', () => {
    expect(isWordDaily('wend')).toBe(true);
    expect(isWordDaily('comet-slice')).toBe(true);
    expect(isWordDaily('sudoku')).toBe(false);
    expect(dailySeed('wend', '2026-10-18')).not.toBe(dailySeed('pinpoint', '2026-10-18'));
    expect(dailySeed('wend', '2026-10-18')).not.toBe(dailySeed('wend', '2026-10-19'));
  });

  it('keeps the first result of the day and reports it once', () => {
    const daily = TestBed.inject(WordDailyService);
    expect(daily.record('wend', 70, 61000)).toBe(true);
    expect(daily.record('wend', 100, 1000)).toBe(false);
    expect(daily.results().wend?.points).toBe(70);
    expect(daily.doneCount()).toBe(1);
    expect(daily.points()).toBe(70);
    expect(record).toHaveBeenCalledTimes(1);
    expect(record.mock.calls[0][0]).toBe('wdaily.completed');
  });
});
