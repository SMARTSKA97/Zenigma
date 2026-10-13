import * as queens from '../queens/engine';
import * as tango from '../tango/engine';
import * as sudoku from '../sudoku/engine';
import * as zip from '../zip/engine';
import * as patches from '../patches/engine';
import { PuzzleGameId } from '../catalog';

/** What the generic puzzle page needs from each game; boards and rules stay in the game's own engine. */
export interface PuzzleAdapter {
  levels(variant?: string | null): Promise<unknown[]>;
  blank(puzzle: unknown): unknown;
  conflicts(puzzle: unknown, state: unknown): Set<number>;
  isSolved(puzzle: unknown, state: unknown): boolean;
  /** The value sent to the server (and checked there against the rules). */
  solution(puzzle: unknown, state: unknown): unknown;
  /** True when the player has put anything on the board (for the clear button). */
  touched(puzzle: unknown, state: unknown): boolean;
  /** Own rule for whether a saved board still fits (otherwise: same shape as a fresh board with fixed cells kept). */
  fits?(puzzle: unknown, state: unknown): boolean;
  help: string;
}

/** Sudoku levels, one file per kind and difficulty tier, loaded only when played. */
const SUDOKU_LEVELS: Record<string, () => Promise<unknown[]>> = {
  'classic-easy': () => import('../sudoku/levels-classic-easy.data').then((m) => m.LEVELS),
  'classic-medium': () => import('../sudoku/levels-classic-medium.data').then((m) => m.LEVELS),
  'classic-hard': () => import('../sudoku/levels-classic-hard.data').then((m) => m.LEVELS),
  'classic-challenging': () => import('../sudoku/levels-classic-challenging.data').then((m) => m.LEVELS),
  'classic-insane': () => import('../sudoku/levels-classic-insane.data').then((m) => m.LEVELS),
  'mini-easy': () => import('../sudoku/levels-mini-easy.data').then((m) => m.LEVELS),
  'mini-medium': () => import('../sudoku/levels-mini-medium.data').then((m) => m.LEVELS),
  'mini-hard': () => import('../sudoku/levels-mini-hard.data').then((m) => m.LEVELS),
  'mini-challenging': () => import('../sudoku/levels-mini-challenging.data').then((m) => m.LEVELS),
  'mini-insane': () => import('../sudoku/levels-mini-insane.data').then((m) => m.LEVELS),
};

export const ADAPTERS: Record<PuzzleGameId, PuzzleAdapter> = {
  queens: {
    levels: () => import('../queens/levels.data').then((m) => m.LEVELS),
    blank: (p) => queens.emptyBoard(p as queens.QueensPuzzle),
    conflicts: (p, s) => queens.conflicts(p as queens.QueensPuzzle, s as queens.QueensCell[]),
    isSolved: (p, s) => queens.isSolved(p as queens.QueensPuzzle, s as queens.QueensCell[]),
    solution: (p, s) => queens.solutionOf(p as queens.QueensPuzzle, s as queens.QueensCell[]),
    touched: (p, s) => (s as queens.QueensCell[]).join('') !== queens.emptyBoard(p as queens.QueensPuzzle).join(''),
    help: 'Place one queen in every row, column and colour. Queens cannot touch, not even diagonally. Tap once to mark a cell with ✕ (no queen can go here), twice to place a queen, three times to clear it.',
  },
  tango: {
    levels: () => import('../tango/levels.data').then((m) => m.LEVELS),
    blank: (p) => tango.boardFrom(p as tango.TangoPuzzle),
    conflicts: (p, s) => tango.conflicts(p as tango.TangoPuzzle, s as tango.TangoCell[]),
    isSolved: (p, s) => tango.isSolved(p as tango.TangoPuzzle, s as tango.TangoCell[]),
    solution: (_, s) => tango.solutionOf(s as tango.TangoCell[]),
    touched: (p, s) => (s as string[]).join('') !== (p as tango.TangoPuzzle).givens,
    help: 'Fill the grid with suns and moons. No more than two of a kind in a row, three of each in every row and column. = means the same, × means different.',
  },
  'sudoku': {
    levels: (variant) => {
      const load = SUDOKU_LEVELS[variant ?? ''] ?? SUDOKU_LEVELS['classic-easy'];
      return load();
    },
    blank: (p) => sudoku.boardFrom(p as sudoku.SudokuPuzzle),
    conflicts: (_, s) => sudoku.conflicts(s as number[]),
    isSolved: (p, s) => sudoku.isSolved(p as sudoku.SudokuPuzzle, s as number[]),
    solution: (_, s) => sudoku.solutionOf(s as number[]),
    touched: (p, s) => (s as number[]).join('') !== (p as sudoku.SudokuPuzzle).givens,
    help: 'Fill the grid so every row, column and box holds each number once: 1 to 9 in the classic grid (3 by 3 boxes), 1 to 6 in the mini grid (boxes 2 by 3). Use Notes to jot down candidates.',
  },
  zip: {
    levels: () => import('../zip/levels.data').then((m) => m.LEVELS),
    blank: (p) => zip.blankPath(p as zip.ZipPuzzle),
    conflicts: () => zip.conflicts(),
    isSolved: (p, s) => zip.isSolved(p as zip.ZipPuzzle, s as zip.ZipPath),
    solution: (p, s) => zip.solutionOf(p as zip.ZipPuzzle, s as zip.ZipPath),
    touched: (_, s) => (s as zip.ZipPath).length > 1,
    fits: (p, s) => zip.fits(p as zip.ZipPuzzle, s),
    help: 'Draw one path through every cell. Start on 1 and reach the numbers in order; the path ends on the highest number. Drag to draw, drag back to undo a step, or press a cell on the path to cut it back there.',
  },
  patches: {
    levels: () => import('../patches/levels.data').then((m) => m.LEVELS),
    blank: () => patches.blankBoard(),
    conflicts: (p, s) => patches.conflicts(p as patches.PatchesPuzzle, s as patches.Rect[]),
    isSolved: (p, s) => patches.isSolved(p as patches.PatchesPuzzle, s as patches.Rect[]),
    solution: (p, s) => patches.solutionOf(p as patches.PatchesPuzzle, s as patches.Rect[]),
    touched: (_, s) => (s as patches.Rect[]).length > 0,
    fits: (p, s) => patches.fits(p as patches.PatchesPuzzle, s),
    help: 'Cut the grid into rectangles. Every rectangle holds exactly one number, and its area (number of cells) must equal that number. A shape beside the number means the rectangle is wide, tall or square. Drag across cells to draw one; tap a rectangle to remove it.',
  },
};
