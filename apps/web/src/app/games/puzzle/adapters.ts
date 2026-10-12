import * as queens from '../queens/engine';
import * as tango from '../tango/engine';
import * as sudoku from '../sudoku/engine';
import { PuzzleGameId } from '../catalog';

/** What the generic puzzle page needs from each game; boards and rules stay in the game's own engine. */
export interface PuzzleAdapter {
  levels(): Promise<unknown[]>;
  blank(puzzle: unknown): unknown;
  conflicts(puzzle: unknown, state: unknown): Set<number>;
  isSolved(puzzle: unknown, state: unknown): boolean;
  /** The value sent to the server (and checked there against the rules). */
  solution(puzzle: unknown, state: unknown): unknown;
  /** True when the player has put anything on the board (for the clear button). */
  touched(puzzle: unknown, state: unknown): boolean;
  help: string;
}

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
    levels: () => import('../sudoku/levels.data').then((m) => m.LEVELS),
    blank: (p) => sudoku.boardFrom(p as sudoku.SudokuPuzzle),
    conflicts: (_, s) => sudoku.conflicts(s as number[]),
    isSolved: (p, s) => sudoku.isSolved(p as sudoku.SudokuPuzzle, s as number[]),
    solution: (_, s) => sudoku.solutionOf(s as number[]),
    touched: (p, s) => (s as number[]).join('') !== (p as sudoku.SudokuPuzzle).givens,
    help: 'Fill the grid so every row, column and 3 by 3 box holds the numbers 1 to 9 once. Use Notes to jot down candidates.',
  },
};
