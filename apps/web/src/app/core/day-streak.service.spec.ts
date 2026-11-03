import { commonDays, countBack } from './day-streak.service';

describe('daily streak', () => {
  const set = (...d: string[]) => new Set(d);
  it('counts days in a row up to today', () => {
    expect(countBack(set('2026-10-17', '2026-10-18', '2026-10-19'), '2026-10-19')).toBe(3);
  });
  it('keeps the streak alive until today ends', () => {
    expect(countBack(set('2026-10-17', '2026-10-18'), '2026-10-19')).toBe(2);
  });
  it('breaks on a missed day', () => {
    expect(countBack(set('2026-10-16', '2026-10-18'), '2026-10-19')).toBe(1);
    expect(countBack(set('2026-10-16'), '2026-10-19')).toBe(0);
  });
});

describe('puzzle days from the server', () => {
  it('keeps only days when every game was solved or frozen', () => {
    const a = { recent: ['2026-10-17', '2026-10-18', '2026-10-19'], frozen: [] };
    const b = { recent: ['2026-10-17', '2026-10-19'], frozen: ['2026-10-18'] };
    const c = { recent: ['2026-10-18', '2026-10-19'], frozen: [] };
    expect(commonDays([a, b, c]).sort()).toEqual(['2026-10-18', '2026-10-19']);
    expect(commonDays([])).toEqual([]);
  });
});
