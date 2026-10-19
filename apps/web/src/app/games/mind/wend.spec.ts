import { adjacent, cellsOf, countSolutions, findWords, lettersOf, makeBoard, neighboursOf, practiceSpec, shuffle, specForDate, WEEK } from './wend-engine';
import { seeded } from './mind-util';
import { loadWendWords, WendWords } from './wend-words';

describe('Wend', () => {
  let words: WendWords;
  beforeAll(async () => (words = await loadWendWords()));

  it('knows which cells touch', () => {
    expect(neighboursOf(0, 5).sort((a, b) => a - b)).toEqual([1, 5]);
    expect(adjacent(0, 1, 5)).toBe(true);
    expect(adjacent(0, 6, 5)).toBe(false); // diagonal
    expect(adjacent(4, 5, 5)).toBe(false); // end of one row and start of the next
    expect(adjacent(6, 7, 7)).toBe(false);
  });

  it('shuffles without losing anything', () => {
    expect(shuffle([1, 2, 3, 4], Math.random).sort()).toEqual([1, 2, 3, 4]);
  });

  it('grows through the week like LinkedIn: Monday is the small board, Sunday the biggest', () => {
    expect(specForDate('2026-10-19')).toEqual(WEEK[1]); // a Monday
    expect(specForDate('2026-10-25')).toEqual(WEEK[0]); // a Sunday
    expect(WEEK[1].size).toBe(5);
    expect(lettersOf(WEEK[1])).toBe(18);
    const letters = [1, 2, 3, 4, 5, 6, 0].map((d) => lettersOf(WEEK[d]));
    expect(letters).toEqual([...letters].sort((a, b) => a - b));
    expect(WEEK[0].lengths.length).toBeGreaterThan(WEEK[1].lengths.length);
    expect(Math.max(...WEEK[6].lengths)).toBeGreaterThan(9);
    for (const s of WEEK) expect(lettersOf(s)).toBeLessThan(cellsOf(s));
  });

  it('starts practice small and grows with every board', () => {
    expect(practiceSpec(0)).toEqual(WEEK[1]);
    expect(lettersOf(practiceSpec(3))).toBeGreaterThan(lettersOf(practiceSpec(0)));
    expect(practiceSpec(50)).toEqual(WEEK[0]);
  });

  it('makes a board for each day with grey blocks and words traced through touching cells that use every letter once', () => {
    for (let d = 0; d < 7; d++) {
      const spec = WEEK[d];
      const board = makeBoard(words, seeded(`wend-test-${d}`), spec);
      expect(board.letters.length).toBe(cellsOf(spec));
      expect(board.walls.filter(Boolean).length).toBe(cellsOf(spec) - lettersOf(spec));
      expect(board.paths.map((p) => p.length)).toEqual(spec.lengths);
      const cells = board.paths.flat();
      expect(new Set(cells).size).toBe(lettersOf(spec));
      expect(cells.every((c) => !board.walls[c])).toBe(true);
      board.paths.forEach((p, k) => {
        for (let j = 1; j < p.length; j++) expect(adjacent(p[j - 1], p[j], spec.size)).toBe(true);
        expect(p.map((c) => board.letters[c]).join('')).toBe(board.words[k]);
      });
    }
  });

  it('has exactly one way to use every letter, so the answer is the words it was made from', () => {
    for (const d of [1, 3, 5, 0]) {
      const spec = WEEK[d];
      const board = makeBoard(words, seeded(`wend-unique-${d}`), spec);
      expect(countSolutions(board.letters, board.walls, words, spec, 5)).toBe(1);
      const found = findWords(board.letters, board.walls, spec.size, words, Math.max(...spec.lengths)).map((t) => t.word);
      for (const w of board.words) expect(found).toContain(w);
    }
  });

  it('makes the same board for the same seed', () => {
    const a = makeBoard(words, seeded('wdaily:wend:2026-10-19'), WEEK[1]);
    const b = makeBoard(words, seeded('wdaily:wend:2026-10-19'), WEEK[1]);
    expect(a.letters).toEqual(b.letters);
  });
});
