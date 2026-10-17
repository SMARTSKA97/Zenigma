import { candidatesOf, canFinish, counts, makePuzzle, take } from './wend-engine';

const WORDS = ['crane', 'slate', 'pound', 'light', 'brick', 'melon'];

describe('Wend', () => {
  it('counts letters and takes a word out of a pool', () => {
    const pool = counts('cranepound');
    const rest = take(pool, 'crane')!;
    expect(rest.reduce((a, b) => a + b, 0)).toBe(5);
    expect(take(rest, 'crane')).toBeNull();
    expect(take(rest, 'pound')!.every((n) => n === 0)).toBe(true);
  });

  it('knows when the letters left can still become words', () => {
    const candidates = candidatesOf(WORDS);
    expect(canFinish(counts('cranepoundlight'), 3, 5, candidates)).toBe(true);
    expect(canFinish(counts('cranepoundlighx'), 3, 5, candidates)).toBe(false);
    expect(canFinish(counts(''), 0, 5, candidates)).toBe(true);
  });

  it('makes a puzzle of four distinct words whose letters can be split back into words', () => {
    const candidates = candidatesOf(WORDS);
    for (let i = 0; i < 50; i++) {
      const puzzle = makePuzzle(WORDS, 4);
      expect(new Set(puzzle.words).size).toBe(4);
      expect(puzzle.letters.length).toBe(20);
      expect(canFinish(counts(puzzle.letters.join('')), 4, 5, candidates)).toBe(true);
    }
  });
});
