import { generateQueens, solveQueens } from './queens.mjs';
import { generateSudoku, solveSudoku } from './sudoku.mjs';
import { generateZip, solveZip } from './zip.mjs';
import { generatePatches, solvePatches } from './patches.mjs';
import { generateTango, solveTango } from './tango.mjs';
import { rngFrom } from './rng.mjs';

export const GAMES = ['queens', 'tango', 'sudoku', 'zip', 'patches'];
/** Practice tracks: each has its own 1000 levels. A game can have several (Sudoku: classic 9x9 and mini 6x6), and more can be added. */
export const SUDOKU_TIERS = ['easy', 'medium', 'hard', 'challenging', 'insane'];
export const TRACKS = [
  'queens',
  'tango',
  ...['classic', 'mini'].flatMap((kind) => SUDOKU_TIERS.map((tier) => `sudoku-${kind}-${tier}`)),
  'zip',
  'patches',
];
export const gameOfTrack = (track) => track.split('-')[0];
export const LEVELS_PER_GAME = 1000;
/** Sudoku kinds are split into difficulty tiers, each its own track of this many levels. */
export const LEVELS_PER_TIER = 200;
export const levelsOf = (track) => (track.startsWith('sudoku-') ? LEVELS_PER_TIER : LEVELS_PER_GAME);

/** Numbers left in the grid at the start and end of each tier (the end of a tier is a touch harder than its start). */
const SUDOKU_CLUES = {
  classic: { easy: [42, 36], medium: [35, 31], hard: [30, 27], challenging: [26, 24], insane: [23, 22] },
  mini: { easy: [20, 17], medium: [16, 15], hard: [14, 13], challenging: [12, 12], insane: [11, 10] },
};
function sudokuTierLevel(track, level, rng) {
  const [, kind, tier] = track.split('-');
  const [from, to] = SUDOKU_CLUES[kind][tier];
  const along = 0.5 * ((level - 1) / (LEVELS_PER_TIER - 1)) + 0.5 * (((level - 1) % LEVELS_PER_ZONE) / (LEVELS_PER_ZONE - 1));
  return generateSudoku(rng, Math.round(from - (from - to) * along), kind === 'mini' ? 6 : 9);
}

export const LEVELS_PER_ZONE = 10;

/**
 * How hard a practice level is, from 0 (gentlest) to 1 (hardest). Levels come in zones of ten: every zone climbs from
 * easy (its first level) to hard (its tenth), and each zone starts a little above the one before and tops out a little higher,
 * so level 11 is easier than level 10 but harder than level 1, and level 20 is harder than level 10.
 */
export function hardness(level) {
  const zone = Math.floor((level - 1) / LEVELS_PER_ZONE);
  const position = ((level - 1) % LEVELS_PER_ZONE) / (LEVELS_PER_ZONE - 1);
  const climb = Math.min(1, zone / 50);
  const floor = 0.5 * climb;
  const ceiling = 0.35 + 0.65 * climb;
  return floor + (ceiling - floor) * position;
}

/** Difficulty ramps with the level number; level 1 is the gentlest. */
export function practiceLevel(track, level) {
  const game = track;
  const rng = rngFrom(`zenigma-practice:${track}:${level}`);
  const h = hardness(level);
  if (game.startsWith('sudoku-')) return sudokuTierLevel(track, level, rng);
  switch (game) {
    case 'queens': {
      const size = h < 0.2 ? 5 : h < 0.4 ? 6 : h < 0.6 ? 7 : h < 0.8 ? 8 : 9;
      return generateQueens(size, rng, Math.max(0, Math.round(3 - 3.4 * h))); // queens already placed
    }
    case 'tango':
      return generateTango(rng, Math.round(6 * (1 - h))); // extra clues left in
    case 'zip': {
      const size = h < 0.35 ? 5 : h < 0.7 ? 6 : 7;
      return generateZip(size, rng, Math.max(5, Math.round(9 - 4 * h))); // numbers shown
    }
    case 'patches': {
      const size = h < 0.25 ? 5 : h < 0.5 ? 6 : h < 0.75 ? 7 : 8;
      return generatePatches(size, rng, Math.round(3 * (1 - h))); // shape hints shown beyond the needed ones
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
  sudoku: [20, 18, 16, 15, 14, 13, 12], // numbers left in the mini 6x6 grid (fewer is harder)
  patches: [[5, 3], [5, 2], [6, 2], [6, 1], [7, 1], [7, 0], [8, 0]], // [board size, extra shape hints] (fewer is harder)
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
      return generateSudoku(rng, level, 6); // the daily is the mini 6x6 grid
    case 'zip':
      return generateZip(level[0], rng, level[1]);
    case 'patches':
      return generatePatches(level[0], rng, level[1]);
  }
}

/** The one solution of a puzzle, in the format the API and the apps accept. */
export function solve(track, puzzle) {
  const game = gameOfTrack(track);
  switch (game) {
    case 'queens':
      return solveQueens(puzzle, 2);
    case 'tango':
      return solveTango(puzzle, 2);
    case 'sudoku':
      return solveSudoku(puzzle, 2);
    case 'zip':
      return solveZip(puzzle, 2);
    case 'patches':
      return solvePatches(puzzle, 2);
    default:
      throw new Error(`Unknown game ${game}`);
  }
}
