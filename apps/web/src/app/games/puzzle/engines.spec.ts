import sudoku from '../../../../../../tests/vectors/puzzles/sudoku.json';
import queens from '../../../../../../tests/vectors/puzzles/queens.json';
import tango from '../../../../../../tests/vectors/puzzles/tango.json';
import zip from '../../../../../../tests/vectors/puzzles/zip.json';
import patches from '../../../../../../tests/vectors/puzzles/patches.json';
import { verify as verifyPatches, place as patchPlace, fits as patchFits } from '../patches/engine';
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
    ['patches', patches as Case[], verifyPatches],
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

describe('patches moves', () => {
  const valid = (patches as Case[])[0];

  it('replaces the rectangles a new one overlaps', () => {
    const next = patchPlace([[0, 0, 1, 1], [3, 3, 3, 3]], [1, 1, 2, 2]);
    expect(next).toEqual([[3, 3, 3, 3], [1, 1, 2, 2]]);
  });

  it('accepts the answer as a saved board and rejects one from a bigger grid', () => {
    expect(patchFits(valid.puzzle, valid.solution)).toBe(true);
    expect(patchFits(valid.puzzle, [[0, 0, 9, 9]])).toBe(false);
    expect(patchFits(valid.puzzle, [[0, 0, 1, 1], [1, 1, 2, 2]])).toBe(false);
  });
});

describe('zip walls and blocked cells', () => {
  // 3 by 3: the path 1 → 9 snakes through every open cell. A wall between cells 0 and 1 and a hole at 4.
  const base = { size: 3, numbers: [1, 0, 0, 0, 0, 0, 0, 0, 2] };

  it('refuses a step across a wall or onto a blocked cell', async () => {
    const zip = await import('../zip/engine');
    const walled = { ...base, walls: [[0, 1]] as [number, number][] };
    expect(zip.canStep(walled, [0], 1)).toBe(false);
    expect(zip.canStep(walled, [0], 3)).toBe(true);
    const holed = { ...base, holes: [4] };
    expect(zip.canStep(holed, [3], 4)).toBe(false);
  });

  it('needs the path to cover every open cell and respect the walls', async () => {
    const zip = await import('../zip/engine');
    const holed = { ...base, holes: [4], numbers: [1, 0, 0, 0, 0, 0, 0, 0, 2] };
    // 8 open cells around the ring: 0,1,2,5,8 ... ends on 8 only if it goes all the way round.
    expect(zip.verify(holed, [0, 3, 6, 7, 8])).toBe(false);
    expect(zip.verify(holed, [0, 1, 2, 5, 8, 7, 6, 3])).toBe(false); // ends on cell 3, not on the highest number
    expect(zip.cellsToCover(holed)).toBe(8);
  });
});
