import { generateQueens, solveQueens } from './queens.mjs';
import { generateSudoku, solveSudoku } from './sudoku.mjs';
import { generateTango, solveTango } from './tango.mjs';
import { rngFrom } from './rng.mjs';

export const GAMES = ['queens', 'tango', 'sudoku'];
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
    case 'sudoku':
      return generateSudoku(rng, Math.max(27, 46 - Math.floor((level - 1) / 10)));
    default:
      throw new Error(`Unknown game ${game}`);
  }
}

/**
 * Daily puzzles get harder through the week: Monday is the gentlest, Sunday the hardest.
 * `weekday` is 0 for Monday to 6 for Sunday (the day the puzzle is for, in India Standard Time).
 */
export const DAILY_RAMP = {
  queens: [6, 6, 7, 7, 8, 8, 9], // board size
  tango: [6, 5, 4, 3, 2, 1, 0], // extra clues left in (fewer is harder)
  sudoku: [42, 38, 34, 31, 29, 27, 26], // numbers left in the grid (fewer is harder)
};

export const weekdayOf = (date) => (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

export function dailyPuzzle(game, seed, weekday = 3) {
  const rng = rngFrom(`daily:${seed}`);
  const level = DAILY_RAMP[game]?.[weekday];
  if (level === undefined) throw new Error(`Unknown game ${game}`);
  switch (game) {
    case 'queens':
      return generateQueens(level, rng);
    case 'tango':
      return generateTango(rng, level);
    case 'sudoku':
      return generateSudoku(rng, level);
  }
}

/** The one solution of a puzzle, in the format the API and the apps accept. */
export function solve(game, puzzle) {
  switch (game) {
    case 'queens':
      return solveQueens(puzzle, 2);
    case 'tango':
      return solveTango(puzzle, 2);
    case 'sudoku':
      return solveSudoku(puzzle, 2);
    default:
      throw new Error(`Unknown game ${game}`);
  }
}
