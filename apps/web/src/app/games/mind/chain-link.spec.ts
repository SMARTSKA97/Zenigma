import { COMPOUNDS } from './chain-link-data';
import { accepts, joins, linksForRound, makeChain, written } from './chain-link-engine';

describe('Chain Link words', () => {
  it('only holds plain lowercase words and never pairs a word with itself', () => {
    for (const [first, seconds] of COMPOUNDS) {
      expect(first).toMatch(/^[a-z]{2,12}$/);
      for (const second of seconds.keys()) {
        expect(second).toMatch(/^[a-z]{2,12}$/);
        expect(second).not.toBe(first);
      }
    }
  });

  it('can build a chain for every length a round asks for', () => {
    for (const links of [2, 3, 4, 5, 6]) {
      for (let i = 0; i < 150; i++) {
        const chain = makeChain(links);
        expect(chain, `${links} links`).not.toBeNull();
        expect(chain!.words.length).toBe(links + 1);
        expect(new Set(chain!.words).size).toBe(links + 1);
        for (let k = 1; k < chain!.words.length; k++) expect(joins(chain!.words[k - 1], chain!.words[k])).toBe(true);
      }
    }
  });

  it('asks for 2 to 6 words, then stays at 6', () => {
    expect([1, 2, 3, 4, 5, 6, 9].map(linksForRound)).toEqual([2, 3, 4, 5, 6, 6, 6]);
  });

  it('knows man and made go together, and writes the pair', () => {
    expect(joins('man', 'made')).toBe(true);
    expect(written('man', 'made')).toBe('man-made');
    expect(written('sun', 'flower')).toBe('sunflower');
    expect(joins('made', 'man')).toBe(false);
  });

  it('accepts another valid word only if the rest of the chain still joins', () => {
    // sun + light + house: "flower" joins sun but not house, so it is not an answer after sun when house comes next.
    expect(accepts('sun', 'light', 'house')).toBe(true);
    expect(accepts('sun', 'flower', 'house')).toBe(false);
    expect(accepts('sun', 'flower', undefined)).toBe(true);
    expect(accepts('sun', 'table', undefined)).toBe(false);
  });
});
