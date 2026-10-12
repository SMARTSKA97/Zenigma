import { generateQueens, solveQueens } from './queens.mjs';
import { generateSudoku, solveSudoku } from './sudoku.mjs';
import { generateZip, solveZip } from './zip.mjs';
import { generateTango, solveTango } from './tango.mjs';
import { rngFrom } from './rng.mjs';

export const GAMES = ['queens', 'tango', 'sudoku', 'zip'];
export const LEVELS_PER_GAME = 200;

/** Difficulty ramps with the level number; level 1 is the gentlest. */
export function practiceLevel(game, level) {
  const rng = rngFrom(`zenigma-practice:${game}:${level}`);
  switch (game) {
    case 'queens': {
      const size = level <= 25 ? 5 : level <= 60 ? 6 : level <= 100 ? 7 : level <= 150 ? 8 : 9;
      return generateQueens(size, rng, Math.max(1, 3 - Math.floor((level - 1) / 50)));
    }
    case 'tango':
      return generateTango(rng, Math.max(0, 6 - Math.floor((level - 1) / 30)));
    case 'sudoku':
      return generateSudoku(rng, Math.max(27, 46 - Math.floor((level - 1) / 10)));
    case 'zip': {
      const size = level <= 40 ? 5 : level <= 100 ? 6 : 7;
      const target = Math.max(5, (size === 7 ? 10 : 8) - Math.floor((level - 1) / 25) % 4);
      return generateZip(size, rng, target);
    }
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
  queensGivens: [2, 2, 1, 1, 1, 0, 0], // queens already placed (fewer is harder)
  zip: [[5, 8], [5, 6], [6, 8], [6, 6], [6, 5], [7, 8], [7, 6]], // [board size, numbers shown] (fewer numbers is harder)
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
      return generateQueens(level, rng, DAILY_RAMP.queensGivens[weekday]);
    case 'tango':
      return generateTango(rng, level);
    case 'sudoku':
      return generateSudoku(rng, level);
    case 'zip':
      return generateZip(level[0], rng, level[1]);
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
    case 'zip':
      return solveZip(puzzle, 2);
    default:
      throw new Error(`Unknown game ${game}`);
  }
}
