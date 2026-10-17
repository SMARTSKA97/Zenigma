import { accepts, blanksForRound, buildIndex, distancesTo, makeLadder, neighbours, oneApart } from './crossclimb-engine';

const WORDS = ['cold', 'cord', 'card', 'ward', 'warm', 'worm', 'word', 'core', 'care', 'dare', 'bare', 'bore', 'more', 'mare'];
const index = buildIndex(WORDS);

describe('Crossclimb', () => {
  it('knows when two words are one letter apart', () => {
    expect(oneApart('cold', 'cord')).toBe(true);
    expect(oneApart('cold', 'card')).toBe(false);
    expect(oneApart('cold', 'cold')).toBe(false);
    expect(oneApart('cold', 'colds')).toBe(false);
  });

  it('finds neighbours and distances', () => {
    expect(neighbours('cord', index).sort()).toEqual(['card', 'cold', 'core', 'word']);
    const d = distancesTo('warm', index);
    expect(d.get('warm')).toBe(0);
    expect(d.get('worm')).toBe(1);
    expect(d.get('cold')).toBeGreaterThan(1);
  });

  it('builds ladders whose neighbours are one letter apart and whose ends are not neighbours', () => {
    for (let i = 0; i < 100; i++) {
      const ladder = makeLadder(2, WORDS, index);
      expect(ladder).not.toBeNull();
      const w = ladder!.words;
      expect(w.length).toBe(4);
      for (let k = 1; k < w.length; k++) expect(oneApart(w[k - 1], w[k])).toBe(true);
      expect(oneApart(w[0], w[3])).toBe(false);
      expect(new Set(w).size).toBe(4);
    }
  });

  it('accepts a different valid word as long as the end can still be reached', () => {
    const valid = new Set(WORDS);
    const dist = distancesTo('warm', index);
    // cold -> cord -> word -> worm -> warm: after "cord", two rows remain and "warm" is 3 steps away, so it is in time with 2 left but not with 1.
    expect(accepts('cord', 'cold', [], 'warm', 2, valid, dist)).toBe(true);
    expect(accepts('cord', 'cold', [], 'warm', 1, valid, dist)).toBe(false);
    expect(accepts('card', 'cold', [], 'warm', 1, valid, dist)).toBe(false); // not one letter apart
    expect(accepts('zzzz', 'cold', [], 'warm', 1, valid, dist)).toBe(false); // not a word
    expect(accepts('cord', 'cold', ['cord'], 'warm', 1, valid, dist)).toBe(false); // already used
    expect(accepts('word', 'cord', [], 'warm', 0, valid, dist)).toBe(false); // last row must touch the end
    expect(accepts('worm', 'word', [], 'warm', 0, valid, dist)).toBe(true);
  });

  it('asks for 2 to 5 blanks, then stays at 5', () => {
    expect([1, 2, 3, 4, 8].map(blanksForRound)).toEqual([2, 3, 4, 5, 5]);
  });
});
