import { generateQueens, solveQueens } from './queens.mjs';
import { generateSudoku, solveSudoku } from './sudoku.mjs';
import { generateTango, solveTango } from './tango.mjs';
import { rngFrom } from './rng.mjs';

export const GAMES = ['queens', 'tango', 'mini-sudoku'];
export const LEVELS_PER_GAME = 200;

/** Difficulty ramps with the level number; level 1 is the gentlest. */
export function practiceLevel(game, level) {
  const rng = rngFrom(`zenigma-practice:${game}:${level}`);
  switch (game) {
    case 'queens': {
      const size = level <= 25 ? 5 : level <= 60 ? 6 : level <= 100 ? 7 : level <= 150 ? 8 : 9;
      return generateQueens(size, rng);
    }
    case 'tango':
      return generateTango(rng, Math.max(0, 6 - Math.floor((level - 1) / 30)));
    case 'mini-sudoku':
      return generateSudoku(rng, Math.max(13, 22 - Math.floor((level - 1) / 22)));
    default:
      throw new Error(`Unknown game ${game}`);
  }
}

/** Daily puzzles are the same difficulty every day, a notch above the middle of practice. */
export function dailyPuzzle(game, seed) {
  const rng = rngFrom(`daily:${seed}`);
  switch (game) {
    case 'queens':
      return generateQueens(8, rng);
    case 'tango':
      return generateTango(rng, 4);
    case 'mini-sudoku':
      return generateSudoku(rng, 14);
    default:
      throw new Error(`Unknown game ${game}`);
  }
}

/** The one solution of a puzzle, in the format the API and the apps accept. */
export function solve(game, puzzle) {
  switch (game) {
    case 'queens':
      return solveQueens(puzzle, 2);
    case 'tango':
      return solveTango(puzzle, 2);
    case 'mini-sudoku':
      return solveSudoku(puzzle, 2);
    default:
      throw new Error(`Unknown game ${game}`);
  }
}
