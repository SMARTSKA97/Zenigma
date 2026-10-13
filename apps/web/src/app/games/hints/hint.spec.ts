import { describe, expect, it } from 'vitest';
import { LEVELS as QUEENS } from '../queens/levels.data';
import { LEVELS as TANGO } from '../tango/levels.data';
import { LEVELS as SUDOKU } from '../sudoku/levels-classic.data';
import { LEVELS as MINI } from '../sudoku/levels-mini.data';
import { LEVELS as ZIP } from '../zip/levels.data';
import { LEVELS as PATCHES } from '../patches/levels.data';
import * as queens from '../queens/engine';
import * as tango from '../tango/engine';
import * as sudoku from '../sudoku/engine';
import * as zip from '../zip/engine';
import * as patches from '../patches/engine';
import { hintFor } from './hint';
import { solvePatches, solveQueens, solveSudoku, solveTango, solveZip } from './solvers';

const pick = <T>(levels: T[]): T[] => [0, 4, 9, 14, 99, 500, 999].map((i) => levels[i]).filter(Boolean);

describe('hints coach without giving the answer', () => {
  it('queens', () => {
    for (const p of pick(QUEENS as queens.QueensPuzzle[])) {
      const sol = solveQueens(p)!;
      const board = queens.emptyBoard(p);
      expect(hintFor('queens', p, board).kind).toBe('nudge');
      expect(hintFor('queens', p, board).cells.length).toBeGreaterThan(0);
      sol.forEach((c, r) => (board[r * p.size + c] = queens.QUEEN));
      expect(hintFor('queens', p, board).kind).toBe('done');
      // Move one queen to a wrong cell in its row.
      const wrong = [...board];
      const c0 = sol[0];
      const other = (c0 + 2) % p.size;
      if (!queens.isGiven(p, c0)) {
        wrong[c0] = queens.EMPTY;
        wrong[other] = queens.QUEEN;
        expect(hintFor('queens', p, wrong).kind).toBe('mistake');
      }
    }
  });

  it('tango', () => {
    for (const p of pick(TANGO as tango.TangoPuzzle[])) {
      const sol = solveTango(p)!;
      const board = tango.boardFrom(p);
      expect(['nudge']).toContain(hintFor('tango', p, board).kind);
      expect(hintFor('tango', p, [...sol] as tango.TangoCell[]).kind).toBe('done');
      const i = [...p.givens].findIndex((ch) => ch === '.');
      const wrong = [...board];
      wrong[i] = sol[i] === 's' ? 'm' : 's';
      expect(hintFor('tango', p, wrong).kind).toBe('mistake');
    }
  });

  it('sudoku (classic and mini)', () => {
    for (const p of [...pick(SUDOKU as sudoku.SudokuPuzzle[]), ...pick(MINI as sudoku.SudokuPuzzle[])]) {
      const sol = solveSudoku([...p.givens].map(Number))!;
      const board = sudoku.boardFrom(p);
      expect(hintFor('sudoku', p, board).kind).toBe('nudge');
      expect(hintFor('sudoku', p, [...sol].map(Number)).kind).toBe('done');
      const i = [...p.givens].findIndex((ch) => ch === '0');
      const wrong = [...board];
      wrong[i] = (Number(sol[i]) % sudoku.sizeOf(board.length)) + 1;
      expect(hintFor('sudoku', p, wrong).kind).toBe('mistake');
    }
  });

  it('zip', () => {
    for (const p of pick(ZIP as zip.ZipPuzzle[])) {
      const sol = solveZip(p)!;
      expect(hintFor('zip', p, zip.blankPath(p)).kind).toBe('nudge');
      expect(hintFor('zip', p, sol).kind).toBe('done');
      // A path that turns away from the solution.
      const start = zip.startCell(p);
      const options = [start + 1, start - 1, start + p.size, start - p.size].filter((c) => c >= 0 && c < p.size * p.size && c !== sol[1] && zip.canStep(p, [start], c));
      if (options.length) expect(hintFor('zip', p, [start, options[0]]).kind).toBe('mistake');
      expect(hintFor('zip', p, sol.slice(0, 3)).kind).toBe('nudge');
    }
  });

  it('patches', () => {
    for (const p of pick(PATCHES as patches.PatchesPuzzle[])) {
      const sol = solvePatches(p)!;
      expect(hintFor('patches', p, []).kind).toBe('nudge');
      expect(hintFor('patches', p, sol).kind).toBe('done');
      expect(hintFor('patches', p, [[0, 0, 0, 0]]).kind === 'mistake' || sol.some((r) => r.join() === '0,0,0,0')).toBe(true);
    }
  });
});
