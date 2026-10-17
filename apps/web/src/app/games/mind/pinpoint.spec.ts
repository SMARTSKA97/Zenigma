import { PINPOINT } from './pinpoint-data';
import { isCorrect, normalise, pointsAt } from './pinpoint-engine';

describe('Pinpoint', () => {
  it('has well-formed categories', () => {
    const names = new Set<string>();
    for (const c of PINPOINT) {
      expect(names.has(c.name), c.name).toBe(false);
      names.add(c.name);
      expect(c.clues.length).toBe(5);
      expect(new Set(c.clues.map((x) => x.toLowerCase())).size, c.name).toBe(5);
      for (const clue of c.clues) {
        expect(clue.trim().length).toBeGreaterThan(1);
        // A clue must not give the category away by being it.
        expect(isCorrect(clue, c), `${c.name}: ${clue}`).toBe(false);
      }
    }
    expect(PINPOINT.length).toBeGreaterThanOrEqual(50);
  });

  it('accepts the name in a few spellings and nothing else', () => {
    const planets = PINPOINT.find((c) => c.name === 'Planets')!;
    for (const ok of ['Planets', 'planet', ' THE planets ', 'solar system planets']) expect(isCorrect(ok, planets), ok).toBe(true);
    for (const bad of ['', 'p', 'moons', 'stars']) expect(isCorrect(bad, planets), bad).toBe(false);
    expect(normalise('Types of Cheese')).toBe('cheese');
  });

  it('pays 5 for the first clue down to 1', () => {
    expect([1, 2, 3, 4, 5].map(pointsAt)).toEqual([5, 4, 3, 2, 1]);
  });
});
