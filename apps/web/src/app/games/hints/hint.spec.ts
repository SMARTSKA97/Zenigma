import { describe, expect, it } from 'vitest';
import QUEENS from '../../../../public/levels/queens-classic-hard-0.json';
import TANGO from '../../../../public/levels/tango-classic-hard-0.json';
import SUDOKU from '../../../../public/levels/sudoku-classic-insane-0.json';
import MINI from '../../../../public/levels/sudoku-mini-insane-0.json';
import ZIP from '../../../../public/levels/zip-classic-hard-0.json';
import HOLES from '../../../../public/levels/zip-holes-0.json';
import WALLS from '../../../../public/levels/zip-walls-0.json';
import PATCHES from '../../../../public/levels/patches-classic-hard-0.json';
import * as queens from '../queens/engine';
import * as tango from '../tango/engine';
import * as sudoku from '../sudoku/engine';
import * as zip from '../zip/engine';
import * as patches from '../patches/engine';
import { hintFor, revealFor } from './hint';
import { solvePatches, solveQueens, solveSudoku, solveTango, solveZip } from './solvers';

const pick = <T>(levels: T[]): T[] => [0, 4, 9, 14, 99, 500, 999].map((i) => levels[i]).filter(Boolean);

describe('hints coach without giving the answer', () => {
  it('queens', () => {
    for (const p of pick(QUEENS as unknown as queens.QueensPuzzle[])) {
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
    for (const p of pick(TANGO as unknown as tango.TangoPuzzle[])) {
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
    for (const p of [...pick(SUDOKU as unknown as sudoku.SudokuPuzzle[]), ...pick(MINI as unknown as sudoku.SudokuPuzzle[])]) {
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
    for (const p of pick(ZIP as unknown as zip.ZipPuzzle[])) {
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

  it('zip with blocked cells and walls', () => {
    for (const p of [...pick(HOLES as unknown as zip.ZipPuzzle[]), ...pick(WALLS as unknown as zip.ZipPuzzle[])]) {
      const sol = solveZip(p)!;
      expect(sol.length).toBe(zip.cellsToCover(p));
      expect(zip.isSolved(p, sol)).toBe(true);
      expect(hintFor('zip', p, zip.blankPath(p)).kind).toBe('nudge');
      expect(hintFor('zip', p, sol).kind).toBe('done');
    }
  });

  it('patches', () => {
    for (const p of pick(PATCHES as unknown as patches.PatchesPuzzle[])) {
      const sol = solvePatches(p)!;
      expect(hintFor('patches', p, []).kind).toBe('nudge');
      expect(hintFor('patches', p, sol).kind).toBe('done');
      expect(hintFor('patches', p, [[0, 0, 0, 0]]).kind === 'mistake' || sol.some((r) => r.join() === '0,0,0,0')).toBe(true);
    }
  });
});

describe('a hint is one concrete step', () => {
  it('names the exact cell, and a right one', () => {
    for (const p of pick(QUEENS as unknown as queens.QueensPuzzle[])) {
      const sol = solveQueens(p)!;
      const h = revealFor('queens', p, queens.emptyBoard(p))!;
      expect(h.focus).toBeDefined();
      expect(sol[Math.floor(h.focus! / p.size)]).toBe(h.focus! % p.size);
      expect(h.text.length).toBeGreaterThan(30);
    }
    for (const p of pick(SUDOKU as unknown as sudoku.SudokuPuzzle[])) {
      const board = [...p.givens].map(Number);
      const h = revealFor('sudoku', p, board)!;
      expect(board[h.focus!]).toBe(0);
      expect(h.mark).toBe(solveSudoku(board, p)![h.focus!]);
    }
    for (const p of pick(TANGO as unknown as tango.TangoPuzzle[])) {
      const sol = solveTango(p)!;
      const h = revealFor('tango', p, tango.boardFrom(p))!;
      expect(h.focus).toBeDefined();
      expect(h.mark).toBe(sol[h.focus!] === 's' ? '☀️' : '🌙');
    }
    for (const p of pick(ZIP as unknown as zip.ZipPuzzle[])) {
      const h = revealFor('zip', p, zip.blankPath(p))!;
      expect(h.focus).toBe(solveZip(p)![1]);
    }
    for (const p of pick(PATCHES as unknown as patches.PatchesPuzzle[])) {
      expect(revealFor("patches", p, patches.blankBoard())!.cells.length).toBeGreaterThan(0);
    }
  });

  it('every forced move it gives is a move of the real solution, all the way through a Tango board', () => {
    for (const p of pick(TANGO as unknown as tango.TangoPuzzle[])) {
      const sol = solveTango(p)!;
      let board = tango.boardFrom(p);
      for (let step = 0; step < 40 && board.includes('.'); step++) {
        const h = revealFor('tango', p, board)!;
        expect(h.kind).toBe('nudge');
        const want = sol[h.focus!] as tango.TangoCell;
        expect(h.mark).toBe(want === 's' ? '☀️' : '🌙');
        board = board.map((c, i) => (i === h.focus ? want : c));
      }
      expect(board.includes('.')).toBe(false);
    }
  });
});
