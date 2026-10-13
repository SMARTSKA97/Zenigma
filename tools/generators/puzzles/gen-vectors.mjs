// Writes shared test vectors: puzzles with a valid solution and several broken ones. Both the TypeScript engines and
// the C# verifier must accept and reject exactly the same cases.
import { mkdirSync, writeFileSync } from 'node:fs';
import { rngFrom } from './rng.mjs';
import { generateQueens, solveQueens } from './queens.mjs';
import { generateTango, solveTango } from './tango.mjs';
import { generateZip, solveZip } from './zip.mjs';
import { generateSudoku, solveSudoku } from './sudoku.mjs';
import { generatePatches, solvePatches } from './patches.mjs';

const out = new URL('../../../tests/vectors/puzzles/', import.meta.url);
mkdirSync(out, { recursive: true });
const write = (name, cases) => writeFileSync(new URL(`${name}.json`, out), JSON.stringify(cases, null, 1) + '\n');

// Queens: solution is the column of each row's queen.
{
  const cases = [];
  for (const size of [5, 6, 8]) {
    const puzzle = generateQueens(size, rngFrom(`vector-queens-${size}`));
    const solution = solveQueens(puzzle).solution;
    cases.push({ name: `${size}x${size} valid`, puzzle, solution, valid: true });
    const swapped = [...solution];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    cases.push({ name: `${size}x${size} two rows swapped`, puzzle, solution: swapped, valid: false });
    cases.push({ name: `${size}x${size} touching queens`, puzzle, solution: solution.map((_, r) => Math.min(r, size - 1)), valid: false });
    cases.push({ name: `${size}x${size} too short`, puzzle, solution: solution.slice(1), valid: false });
    cases.push({ name: `${size}x${size} column out of range`, puzzle, solution: solution.map((c, r) => (r === 0 ? size : c)), valid: false });
  }
  write('queens', cases);
}

// Tango: solution is 36 characters of s and m.
{
  const cases = [];
  for (const extra of [0, 3]) {
    const puzzle = generateTango(rngFrom(`vector-tango-${extra}`), extra);
    const solution = solveTango(puzzle).solution;
    cases.push({ name: `extra ${extra} valid`, puzzle, solution, valid: true });
    cases.push({ name: `extra ${extra} flipped cell`, puzzle, solution: (solution[0] === 's' ? 'm' : 's') + solution.slice(1), valid: false });
    cases.push({ name: `extra ${extra} all suns`, puzzle, solution: 's'.repeat(36), valid: false });
    cases.push({ name: `extra ${extra} unfinished`, puzzle, solution: solution.slice(0, 35) + '.', valid: false });
    cases.push({ name: `extra ${extra} wrong length`, puzzle, solution: solution + 's', valid: false });
  }
  write('tango', cases);
}

// Sudoku: solution is 36 digits (mini 6x6) or 81 digits (classic 9x9).
{
  const cases = [];
  for (const [n, clues] of [[9, 40], [9, 28], [6, 18], [6, 13]]) {
    const total = n * n;
    const tag = `${n}x${n} ${clues} clues`;
    const puzzle = generateSudoku(rngFrom(`vector-sudoku-${n}-${clues}`), clues, n);
    const solution = solveSudoku(puzzle).solution;
    cases.push({ name: `${tag} valid`, puzzle, solution, valid: true });
    const changed = [...solution];
    changed[0] = String((Number(changed[0]) % n) + 1);
    cases.push({ name: `${tag} changed digit`, puzzle, solution: changed.join(''), valid: false });
    const given = puzzle.givens.split('').findIndex((c) => c !== '0');
    const swapped = [...solution];
    const other = (given + 1) % total;
    [swapped[given], swapped[other]] = [swapped[other], swapped[given]];
    cases.push({ name: `${tag} swapped cells`, puzzle, solution: swapped.join(''), valid: false });
    cases.push({ name: `${tag} zero`, puzzle, solution: solution.slice(1) + '0', valid: false });
    cases.push({ name: `${tag} wrong length`, puzzle, solution: solution.slice(1), valid: false });
    cases.push({ name: `${tag} digit out of range`, puzzle, solution: String(n + 1) + solution.slice(1), valid: false });
  }
  // Extra rules on the classic grid: 'diagonal' and 'knight'.
  const breaks = {
    diagonal: (sol) => {
      const main = new Set(); const anti = new Set();
      for (let k = 0; k < 9; k++) { main.add(sol[k * 9 + k]); anti.add(sol[k * 9 + 8 - k]); }
      return main.size < 9 || anti.size < 9;
    },
    knight: (sol) => {
      const moves = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (let i = 0; i < 81; i++) for (const [dr, dc] of moves) {
        const r = Math.floor(i / 9) + dr; const c = (i % 9) + dc;
        if (r >= 0 && r < 9 && c >= 0 && c < 9 && sol[r * 9 + c] === sol[i]) return true;
      }
      return false;
    },
  };
  const plain = generateSudoku(rngFrom('vector-sudoku-plain-for-rules'), 40, 9);
  const plainSolution = solveSudoku(plain).solution;
  for (const rule of ['diagonal', 'knight']) {
    const puzzle = generateSudoku(rngFrom(`vector-sudoku-${rule}`), 30, 9, rule);
    const solution = solveSudoku(puzzle).solution;
    cases.push({ name: `9x9 ${rule} valid`, puzzle, solution, valid: true });
    // A solution of the plain puzzle with the same givens is only fine if it happens to satisfy the rule too.
    cases.push({ name: `9x9 ${rule} plain solution`, puzzle: { givens: plain.givens, rule }, solution: plainSolution, valid: !breaks[rule](plainSolution) });
    const changed = [...solution];
    changed[0] = String((Number(changed[0]) % 9) + 1);
    cases.push({ name: `9x9 ${rule} changed digit`, puzzle, solution: changed.join(''), valid: false });
  }
  write('sudoku', cases);
}

// Zip: solution is the list of cells (row * size + column) in the order the path visits them.
{
  const cases = [];
  for (const [size, target] of [[5, 7], [6, 6]]) {
    const puzzle = generateZip(size, rngFrom(`vector-zip-${size}`), target);
    const solution = solveZip(puzzle).solution;
    const swap = (list, a, b) => list.map((v, i) => (i === a ? list[b] : i === b ? list[a] : v));
    cases.push({ name: `${size}x${size} valid`, puzzle, solution, valid: true });
    cases.push({ name: `${size}x${size} reversed`, puzzle, solution: [...solution].reverse(), valid: false });
    cases.push({ name: `${size}x${size} jumps between cells`, puzzle, solution: swap(solution, 3, 9), valid: false });
    cases.push({ name: `${size}x${size} repeats a cell`, puzzle, solution: solution.map((v, i) => (i === 4 ? solution[2] : v)), valid: false });
    cases.push({ name: `${size}x${size} misses a cell`, puzzle, solution: solution.slice(0, -1), valid: false });
    cases.push({ name: `${size}x${size} cell out of range`, puzzle, solution: solution.map((v, i) => (i === 0 ? size * size : v)), valid: false });
  }
  write('zip', cases);
}
// Patches: solution is the list of rectangles [row0, col0, row1, col1] (inclusive) that cut the grid.
{
  const cases = [];
  for (const [size, extra] of [[5, 1], [7, 0]]) {
    const puzzle = generatePatches(size, rngFrom(`vector-patches-${size}`), extra);
    const solution = solvePatches(puzzle).solution;
    cases.push({ name: `${size}x${size} valid`, puzzle, solution, valid: true });
    cases.push({ name: `${size}x${size} one patch dropped`, puzzle, solution: solution.slice(1), valid: false });
    cases.push({ name: `${size}x${size} patches overlap`, puzzle, solution: solution.map((r, i) => (i === 0 ? [r[0], r[1], Math.min(size - 1, r[2] + 1), r[3]] : r)), valid: false });
    cases.push({ name: `${size}x${size} one big patch`, puzzle, solution: [[0, 0, size - 1, size - 1]], valid: false });
    cases.push({ name: `${size}x${size} patch out of the grid`, puzzle, solution: solution.map((r, i) => (i === 0 ? [r[0], r[1], r[2], size] : r)), valid: false });
  }
  write('patches', cases);
}
// The first levels of every game with their solutions: proves the API accepts the exact levels shipped in the app.
{
  const { practiceLevel, solve } = await import('./games.mjs');
  const cases = [];
  const { TRACKS, levelsOf } = await import('./games.mjs');
  for (const track of TRACKS) {
    const game = track.split('-')[0];
    for (const level of [1, 2, 3, 10, 11, 150, 500, 1000, 1001, 1500].filter((l) => l <= levelsOf(track)).concat(levelsOf(track) < 1000 ? [levelsOf(track)] : [])) {
      cases.push({ game, track, level, solution: solve(track, practiceLevel(track, level)).solution });
    }
  }
  write('practice-levels', cases);
}
console.log('vectors written');
