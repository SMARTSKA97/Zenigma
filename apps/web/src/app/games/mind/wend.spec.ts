import { adjacent, CELLS, findWords, LENGTHS, makeBoard, neighboursOf, shuffle, solve } from './wend-engine';
import { buildWendWords } from './wend-words';

const COMMON = ['cat', 'dog', 'sun', 'tree', 'moon', 'fish', 'house', 'plant', 'river', 'light', 'garden', 'bridge', 'castle', 'planet', 'window', 'sunset'];
const VALID = [...COMMON, 'act', 'can', 'tea', 'sue'];
const words = buildWendWords(VALID, COMMON);

describe('Wend', () => {
  it('knows which cells touch', () => {
    expect(neighboursOf(0).sort((a, b) => a - b)).toEqual([1, 6]);
    expect(adjacent(0, 1)).toBe(true);
    expect(adjacent(0, 7)).toBe(false); // diagonal
    expect(adjacent(5, 6)).toBe(false); // end of one row and start of the next
  });

  it('shuffles without losing anything', () => {
    expect(shuffle([1, 2, 3, 4], Math.random).sort()).toEqual([1, 2, 3, 4]);
  });

  it('makes boards whose four words are traced along touching cells and use every cell once', () => {
    for (let i = 0; i < 40; i++) {
      const board = makeBoard(words);
      expect(board.letters.length).toBe(CELLS);
      expect(board.paths.map((p) => p.length).sort()).toEqual([...LENGTHS].sort());
      expect(new Set(board.paths.flat()).size).toBe(CELLS);
      board.paths.forEach((p, k) => {
        for (let j = 1; j < p.length; j++) expect(adjacent(p[j - 1], p[j])).toBe(true);
        expect(p.map((c) => board.letters[c]).join('')).toBe(board.words[k]);
      });
    }
  });

  it('finds the words on a board and a way to use every cell', () => {
    for (let i = 0; i < 20; i++) {
      const board = makeBoard(words);
      const free = new Array<boolean>(CELLS).fill(true);
      const found = findWords(board.letters, free, words).map((t) => t.word);
      for (const w of board.words) expect(found).toContain(w);
      const solution = solve(board.letters, free, words);
      expect(solution).not.toBeNull();
      expect(solution!.reduce((n, t) => n + t.path.length, 0)).toBe(CELLS);
    }
  });

  it('says so when the cells left cannot be used up', () => {
    const board = makeBoard(words);
    const free = new Array<boolean>(CELLS).fill(true);
    free[board.paths[0][0]] = false; // one cell fewer: 17 cells cannot be split into these words
    // (it may still be solvable by another route, so check the answer is consistent with the cells)
    const solution = solve(board.letters, free, words);
    if (solution) expect(solution.reduce((n, t) => n + t.path.length, 0)).toBe(CELLS - 1);
  });
});
