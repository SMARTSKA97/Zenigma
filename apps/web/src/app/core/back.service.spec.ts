import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { BackService } from './back.service';

describe('BackService', () => {
  const service = () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    return TestBed.inject(BackService);
  };

  it('goes out of a game, then home, never through history', () => {
    const b = service();
    expect(b.parentOf('/')).toBeNull();
    expect(b.parentOf('/games/queens/classic-easy?level=12')).toBe('/games/queens/classic-easy/levels');
    expect(b.parentOf('/games/queens/classic')).toBe('/practice'); // the difficulty chooser
    expect(b.parentOf('/games/sudoku/mini-easy')).toBe('/games/sudoku/mini-easy/levels');
    expect(b.parentOf('/games/sudoku/mini')).toBe('/practice'); // the difficulty chooser
    expect(b.parentOf('/games/queens/levels')).toBe('/practice');
    expect(b.parentOf('/games/sudoku/mini/levels')).toBe('/practice');
    expect(b.parentOf('/games/sudoku')).toBe('/practice');
    expect(b.parentOf('/games/word-guess')).toBe('/practice');
    expect(b.parentOf('/daily/tango')).toBe('/challenges');
    expect(b.parentOf('/daily/word-guess')).toBe('/challenges');
  });

  it('sends every game, daily or practice, back to where it was opened from, never to Settings', () => {
    const b = service();
    expect(b.parentOf('/daily-word/wend')).toBe('/challenges');
    expect(b.parentOf('/mind/quick-sums')).toBe('/mind');
    expect(b.parentOf('/mind/quick-sums', '/challenges?tab=mind')).toBe('/challenges?tab=mind');
    expect(b.parentOf('/daily-word/comet-slice', '/challenges')).toBe('/challenges');
    expect(b.parentOf('/games/word-guess', '/')).toBe('/');
    expect(b.parentOf('/speed/queens')).toBe('/practice');
    expect(b.parentOf('/badges')).toBe('/stats');
  });

  it('goes up from tabs and info pages', () => {
    const b = service();
    for (const tab of ['/daily', '/practice', '/ranks', '/settings', '/stats']) expect(b.parentOf(tab)).toBe('/');
    expect(b.parentOf('/ranks/circles')).toBe('/ranks');
    expect(b.parentOf('/rules/queens')).toBe('/rules');
    expect(b.parentOf('/rules')).toBe('/settings');
    expect(b.parentOf('/about')).toBe('/settings');
    expect(b.parentOf('/privacy')).toBe('/settings');
  });

  it('closes the newest sheet first', () => {
    const b = service();
    const closed: string[] = [];
    const a = b.registerOverlay(() => closed.push('a'));
    b.registerOverlay(() => closed.push('b'));
    (b as unknown as { press(): void }).press();
    a();
    expect(closed).toEqual(['b']);
  });
});
