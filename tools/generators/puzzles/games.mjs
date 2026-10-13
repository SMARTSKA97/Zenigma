import { generateQueens, solveQueens } from './queens.mjs';
import { generateSudoku, solveSudoku } from './sudoku.mjs';
import { generateKind, isKindRule, KIND_RULES } from './sudoku-kinds.mjs';
import { generateZip, solveZip } from './zip.mjs';
import { generatePatches, generatePatchesHidden, solvePatches } from './patches.mjs';
import { generateTango, solveTango } from './tango.mjs';
import { readFileSync } from 'node:fs';
import { rngFrom } from './rng.mjs';

export const GAMES = ['queens', 'tango', 'sudoku', 'zip', 'patches'];
/** Practice tracks: each has its own 1000 levels. A game can have several (Sudoku: classic 9x9 and mini 6x6), and more can be added. */
export const SUDOKU_TIERS = ['easy', 'medium', 'hard', 'challenging', 'insane'];
/** Queens, Tango, Zip and Patches have the same five difficulty tiers as Sudoku. */
export const TIERED_GAMES = ['queens', 'tango', 'zip', 'patches'];
export const TRACKS = [
  ...['queens', 'tango'].flatMap((game) => SUDOKU_TIERS.map((tier) => `${game}-classic-${tier}`)),
  ...['classic', 'mini'].flatMap((kind) => SUDOKU_TIERS.map((tier) => `sudoku-${kind}-${tier}`)),
  'sudoku-diagonal',
  'sudoku-knight',
  ...KIND_RULES.map((k) => `sudoku-${k}`),
  'sudoku-windoku',
  'sudoku-disjoint',
  ...['zip', 'patches'].flatMap((game) => SUDOKU_TIERS.map((tier) => `${game}-classic-${tier}`)),
  'zip-walls',
  'zip-holes',
  'patches-shapes',
];
export const gameOfTrack = (track) => track.split('-')[0];
/** The first 200 levels of a Sudoku tier climb through its clue range; later levels stay near the hard end. */
export const LEVELS_PER_TIER = 200;
/** Levels are shipped in packs of this many, so apps and the API load only the packs a player reaches. */
export const PACK_SIZE = 1000;
/** How many levels each track has now: level-counts.json is the one place to change it (grow-levels.mjs adds a week's worth). */
export const LEVEL_COUNTS = JSON.parse(readFileSync(new URL('./level-counts.json', import.meta.url), 'utf8'));
export const levelsOf = (track) => LEVEL_COUNTS[track];

/** Numbers left in the grid at the start and end of each tier (the end of a tier is a touch harder than its start). */
const SUDOKU_CLUES = {
  classic: { easy: [42, 36], medium: [35, 31], hard: [30, 27], challenging: [26, 24], insane: [23, 22] },
  mini: { easy: [20, 17], medium: [16, 15], hard: [14, 13], challenging: [12, 12], insane: [11, 10] },
};
function sudokuTierLevel(track, level, rng) {
  const [, kind, tier] = track.split('-');
  const [from, to] = SUDOKU_CLUES[kind][tier];
  const along = 0.5 * Math.min(1, (level - 1) / (LEVELS_PER_TIER - 1)) + 0.5 * (((level - 1) % LEVELS_PER_ZONE) / (LEVELS_PER_ZONE - 1));
  return generateSudoku(rng, Math.round(from - (from - to) * along), kind === 'mini' ? 6 : 9);
}

export const LEVELS_PER_ZONE = 10;

/** The slice of the 0 to 1 hardness scale each tier covers (the slices overlap a little, so neighbouring tiers feel connected). */
const TIER_RANGE = { easy: [0, 0.25], medium: [0.2, 0.45], hard: [0.4, 0.65], challenging: [0.6, 0.85], insane: [0.8, 1] };

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
  let game = track;
  const rng = rngFrom(`zenigma-practice:${track}:${level}`);
  let h = hardness(level);
  // Tiered games (queens-classic-hard...): the tier picks a slice of the hardness scale, the level climbs within it.
  const tiered = /^(queens|tango|zip|patches)-classic-(easy|medium|hard|challenging|insane)$/.exec(track);
  if (tiered) {
    const [lo, hi] = TIER_RANGE[tiered[2]];
    h = lo + (hi - lo) * h;
    game = tiered[1];
  }
  // Sudoku with one more rule: a single track each that climbs from many clues to few.
  if (game === 'sudoku-diagonal') return generateSudoku(rng, Math.round(38 - 16 * h), 9, 'diagonal');
  if (isKindRule(game.slice(7))) return generateKind(rng, game.slice(7), h);
  if (game === 'sudoku-windoku') return generateSudoku(rng, Math.round(38 - 14 * h), 9, 'windoku');
  if (game === 'sudoku-disjoint') return generateSudoku(rng, Math.round(38 - 14 * h), 9, 'disjoint');
  if (game === 'sudoku-knight') return generateSudoku(rng, Math.round(36 - 12 * h), 9, 'knight');
  if (game.startsWith('sudoku-')) return sudokuTierLevel(track, level, rng);
  // Zip with walls the path may not cross, or blocked cells it must go around: one track each, climbing from a few to many.
  if (game === 'zip-walls') return generateZip(h < 0.5 ? 5 : h < 0.8 ? 6 : 7, rng, Math.max(4, Math.round(7 - 3 * h)), { walls: Math.round(3 + 7 * h) });
  if (game === 'patches-shapes') return generatePatchesHidden(h < 0.3 ? 5 : h < 0.6 ? 6 : h < 0.85 ? 7 : 8, rng, 0.35 + 0.65 * h);
  if (game === 'zip-holes') return generateZip(h < 0.35 ? 5 : h < 0.7 ? 6 : 7, rng, Math.max(4, Math.round(7 - 3 * h)), { holes: Math.round(2 + 3 * h) });
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
