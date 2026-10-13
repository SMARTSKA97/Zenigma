import { describe, expect, it } from 'vitest';
import { levelCountOf } from '../../games/catalog';
import { featuredFor } from './featured';

describe('featured level of the week', () => {
  it('is the same all week and changes on Monday', () => {
    const mon = featuredFor(new Date(2026, 9, 12));
    expect(featuredFor(new Date(2026, 9, 18, 23, 59))).toEqual(mon);
    expect(featuredFor(new Date(2026, 9, 19)).week).toBe('2026-10-19');
  });

  it('always names a real level of a real track', () => {
    for (let w = 0; w < 120; w++) {
      const f = featuredFor(new Date(2026, 0, 5 + w * 7));
      expect(f.level).toBeGreaterThanOrEqual(600);
      expect(f.level).toBeLessThanOrEqual(levelCountOf(f.track));
    }
  });

  it('rotates through every game', () => {
    const games = new Set(Array.from({ length: 10 }, (_, w) => featuredFor(new Date(2026, 0, 5 + w * 7)).game));
    expect(games.size).toBe(5);
  });
});
