// Writes shared test vectors: puzzles with a valid solution and several broken ones. Both the TypeScript engines and
// the C# verifier must accept and reject exactly the same cases.
import { mkdirSync, writeFileSync } from 'node:fs';
import { rngFrom } from './rng.mjs';
import { generateQueens, solveQueens } from './queens.mjs';
import { generateTango, solveTango } from './tango.mjs';
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

// Mini Sudoku: solution is 36 digits.
{
  const cases = [];
  for (const clues of [20, 13]) {
    const puzzle = generateSudoku(rngFrom(`vector-sudoku-${clues}`), clues);
    const solution = solveSudoku(puzzle).solution;
    cases.push({ name: `${clues} clues valid`, puzzle, solution, valid: true });
    const changed = [...solution];
    changed[0] = String((Number(changed[0]) % 6) + 1);
    cases.push({ name: `${clues} clues changed digit`, puzzle, solution: changed.join(''), valid: false });
    const given = puzzle.givens.split('').findIndex((c) => c !== '0');
    const swapped = [...solution];
    const other = (given + 1) % 36;
    [swapped[given], swapped[other]] = [swapped[other], swapped[given]];
    cases.push({ name: `${clues} clues swapped cells`, puzzle, solution: swapped.join(''), valid: false });
    cases.push({ name: `${clues} clues zero`, puzzle, solution: solution.slice(1) + '0', valid: false });
    cases.push({ name: `${clues} clues wrong length`, puzzle, solution: solution.slice(1), valid: false });
  }
  write('mini-sudoku', cases);
}
// The first levels of every game with their solutions: proves the API accepts the exact levels shipped in the app.
{
  const { practiceLevel, solve } = await import('./games.mjs');
  const cases = [];
  for (const game of ['queens', 'tango', 'mini-sudoku']) {
    for (const level of [1, 2, 3, 150, 200]) {
      cases.push({ game, level, solution: solve(game, practiceLevel(game, level)).solution });
    }
  }
  write('practice-levels', cases);
}
console.log('vectors written');
