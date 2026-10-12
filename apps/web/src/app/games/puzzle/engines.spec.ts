import sudoku from '../../../../../../tests/vectors/puzzles/sudoku.json';
import queens from '../../../../../../tests/vectors/puzzles/queens.json';
import tango from '../../../../../../tests/vectors/puzzles/tango.json';
import zip from '../../../../../../tests/vectors/puzzles/zip.json';
import { verify as verifyZip, step as zipStep, blankPath, fits as zipFits } from '../zip/engine';
import { verify as verifyQueens } from '../queens/engine';
import { verify as verifySudoku } from '../sudoku/engine';
import { verify as verifyTango } from '../tango/engine';

interface Case {
  name: string;
  puzzle: any;
  solution: unknown;
  valid: boolean;
}

describe('puzzle rules (shared vectors, also run by the API)', () => {
  const suites: [string, Case[], (p: any, s: unknown) => boolean][] = [
    ['queens', queens as Case[], verifyQueens],
    ['tango', tango as Case[], verifyTango],
    ['sudoku', sudoku as Case[], verifySudoku],
    ['zip', zip as Case[], verifyZip],
  ];
  for (const [game, cases, verify] of suites) {
    for (const c of cases) {
      it(`${game}: ${c.name}`, () => {
        expect(verify(c.puzzle, c.solution)).toBe(c.valid);
      });
    }
  }
});

import { emptyBoard, isGiven } from '../queens/engine';
import { fitsPuzzle } from './puzzle-page';

describe('queens givens and saved boards', () => {
  const puzzle = { size: 5, regions: Array.from({ length: 25 }, (_, i) => Math.floor(i / 5)), givens: [7] };

  it('starts with the given queens in place', () => {
    const board = emptyBoard(puzzle);
    expect(board[7]).toBe(2);
    expect(board.filter((c) => c !== 0)).toHaveLength(1);
    expect(isGiven(puzzle, 7)).toBe(true);
    expect(isGiven(puzzle, 8)).toBe(false);
  });

  it('only reuses a saved board that fits the puzzle', () => {
    const fresh = emptyBoard(puzzle);
    expect(fitsPuzzle(fresh, [...fresh])).toBe(true);
    expect(fitsPuzzle(fresh, [0, 1, 2])).toBe(false);
    expect(fitsPuzzle(fresh, new Array(25).fill(0))).toBe(false); // lost the given queen
    expect(fitsPuzzle(fresh, undefined)).toBe(false);
    expect(fitsPuzzle(['.', '.'], ['s', 'm'])).toBe(true);
    expect(fitsPuzzle(['.', '.'], [0, 0])).toBe(false);
  });
});

describe('zip moves', () => {
  const valid = (zip as Case[])[0];
  const puzzle = valid.puzzle;
  const path = valid.solution as number[];

  it('replays the whole solution one legal step at a time', () => {
    let built = blankPath(puzzle);
    expect(built).toEqual([path[0]]);
    for (const cell of path.slice(1)) {
      const next = zipStep(puzzle, built, cell);
      expect(next).not.toBeNull();
      built = next!;
    }
    expect(verifyZip(puzzle, built)).toBe(true);
    expect(zipFits(puzzle, built)).toBe(true);
  });

  it('refuses a step onto a visited cell, a far cell or a number out of order, and steps back', () => {
    const start = blankPath(puzzle);
    expect(zipStep(puzzle, start, start[0])).toBeNull();
    expect(zipStep(puzzle, start, path[5])).toBeNull();
    const two = zipStep(puzzle, start, path[1])!;
    expect(zipStep(puzzle, two, path[0])).toEqual(start);
    expect(zipFits(puzzle, [path[1]])).toBe(false);
  });
});

import { difficultyOf, starsFor, parMs } from './par';

describe('level difficulty labels and stars', () => {
  it('climbs from easy to very hard within every ten levels', () => {
    expect([1, 3, 4, 6, 7, 9, 10].map(difficultyOf)).toEqual(['Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Hard', 'Very hard']);
    expect(difficultyOf(11)).toBe('Easy');
    expect(difficultyOf(20)).toBe('Very hard');
  });

  it('gives stars from the time against par', () => {
    expect(starsFor(null, 30_000)).toBe(0);
    expect(starsFor(29_000, 30_000)).toBe(3);
    expect(starsFor(50_000, 30_000)).toBe(2);
    expect(starsFor(90_000, 30_000)).toBe(1);
    expect(parMs('queens', { size: 5, regions: [] })).toBe(30_000);
  });
});
