import { adjacent, CELLS, countSolutions, findWords, LENGTHS, makeBoard, neighboursOf, shuffle, WALLS } from './wend-engine';
import { loadWendWords, WendWords } from './wend-words';
import { seeded } from './mind-util';

describe('Wend', () => {
  let words: WendWords;
  beforeAll(async () => (words = await loadWendWords()));

  it('knows which cells touch', () => {
    expect(neighboursOf(0).sort((a, b) => a - b)).toEqual([1, 5]);
    expect(adjacent(0, 1)).toBe(true);
    expect(adjacent(0, 6)).toBe(false); // diagonal
    expect(adjacent(4, 5)).toBe(false); // end of one row and start of the next
  });

  it('shuffles without losing anything', () => {
    expect(shuffle([1, 2, 3, 4], Math.random).sort()).toEqual([1, 2, 3, 4]);
  });

  it('makes a 5 by 5 board with seven grey blocks and 18 letters in four words', () => {
    for (let i = 0; i < 20; i++) {
      const board = makeBoard(words);
      expect(board.letters.length).toBe(CELLS);
      expect(board.walls.filter(Boolean).length).toBe(WALLS);
      expect(board.paths.map((p) => p.length)).toEqual(LENGTHS);
      const cells = board.paths.flat();
      expect(new Set(cells).size).toBe(CELLS - WALLS);
      expect(cells.every((c) => !board.walls[c])).toBe(true);
      board.paths.forEach((p, k) => {
        for (let j = 1; j < p.length; j++) expect(adjacent(p[j - 1], p[j])).toBe(true);
        expect(p.map((c) => board.letters[c]).join('')).toBe(board.words[k]);
      });
    }
  });

  it('has exactly one way to use every letter, so the answer is the four words it was made from', () => {
    for (let i = 0; i < 10; i++) {
      const board = makeBoard(words);
      const open = board.walls.map((w) => !w);
      expect(countSolutions(board.letters, open, words, 5)).toBe(1);
      const found = findWords(board.letters, open, words).map((t) => t.word);
      for (const w of board.words) expect(found).toContain(w);
    }
  });

  it('makes the same board for the same seed', () => {
    const a = makeBoard(words, seeded('wdaily:wend:2026-10-18'));
    const b = makeBoard(words, seeded('wdaily:wend:2026-10-18'));
    expect(a.letters).toEqual(b.letters);
  });
});
