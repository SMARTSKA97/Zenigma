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
    expect(b.parentOf('/games/queens?level=12')).toBe('/games/queens/levels');
    expect(b.parentOf('/games/sudoku/mini-easy')).toBe('/games/sudoku/mini-easy/levels');
    expect(b.parentOf('/games/sudoku/mini')).toBe('/'); // the difficulty chooser
    expect(b.parentOf('/games/queens/levels')).toBe('/');
    expect(b.parentOf('/games/sudoku/mini/levels')).toBe('/');
    expect(b.parentOf('/games/sudoku')).toBe('/');
    expect(b.parentOf('/games/word-guess')).toBe('/');
    expect(b.parentOf('/daily/tango')).toBe('/daily');
    expect(b.parentOf('/daily/word-guess')).toBe('/daily');
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
