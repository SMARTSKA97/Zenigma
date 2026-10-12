// Writes shared test vectors: puzzles with a valid solution and several broken ones. Both the TypeScript engines and
// the C# verifier must accept and reject exactly the same cases.
import { mkdirSync, writeFileSync } from 'node:fs';
import { rngFrom } from './rng.mjs';
import { generateQueens, solveQueens } from './queens.mjs';
import { generateTango, solveTango } from './tango.mjs';
import { generateZip, solveZip } from './zip.mjs';
import { generateSudoku, solveSudoku } from './sudoku.mjs';

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
// The first levels of every game with their solutions: proves the API accepts the exact levels shipped in the app.
{
  const { practiceLevel, solve } = await import('./games.mjs');
  const cases = [];
  for (const game of ['queens', 'tango', 'sudoku', 'zip']) {
    for (const level of [1, 2, 3, 150, 200]) {
      cases.push({ game, level, solution: solve(game, practiceLevel(game, level)).solution });
    }
  }
  write('practice-levels', cases);
}
console.log('vectors written');
