// Sudoku in two sizes: the classic 9x9 grid (3x3 boxes) and a mini 6x6 grid (boxes 2 rows by 3 columns).
// Every row, column and box holds 1 to n once. A puzzle is its `givens` string; 36 characters means mini, 81 classic.
// A classic puzzle can also carry a `rule` with one more constraint: 'diagonal' (both long diagonals hold 1 to 9 once too)
// 'knight' (no digit repeats a chess knight's move away), 'windoku' (four extra 3x3 windows) or 'disjoint'
// (cells in the same spot of their box, such as every top-left cell, hold 1 to 9 once).

/** The extra group a cell belongs to under a 'windoku' or 'disjoint' rule, or -1. */
export function extraGroup(rule, r, c) {
  if (rule === 'disjoint') return (r % 3) * 3 + (c % 3);
  if (rule === 'windoku') {
    const win = (x) => (x >= 1 && x <= 3 ? 0 : x >= 5 && x <= 7 ? 1 : -1);
    const a = win(r);
    const b = win(c);
    return a < 0 || b < 0 ? -1 : a * 2 + b;
  }
  return -1;
}

import { isKindRule, solveKind } from './sudoku-kinds.mjs';

export const sizeOf = (givens) => Math.round(Math.sqrt(givens.length));
/** Box height and width for a grid of side n. */
const boxShape = (n) => (n === 6 ? [2, 3] : [3, 3]);
const bitCount = (x) => {
  let n = 0;
  for (; x; x &= x - 1) n++;
  return n;
};

/** Counts solutions (up to `limit`) with bitmasks and "fewest options first" search. `order` randomises digit order. */
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];

function search(cells, limit, order, rule = null) {
  const N = Math.round(Math.sqrt(cells.length));
  const ALL = ((1 << (N + 1)) - 1) & ~1; // bits 1..N
  const [bh, bw] = boxShape(N);
  const boxOf = (r, c) => Math.floor(r / bh) * (N / bw) + Math.floor(c / bw);
  const rows = new Array(N).fill(0);
  const cols = new Array(N).fill(0);
  const boxes = new Array(N).fill(0);
  const groups = rule === 'windoku' || rule === 'disjoint' ? new Array(9).fill(0) : null;
  const groupOf = (r, c) => (groups ? extraGroup(rule, r, c) : -1);
  const groupBits = (r, c) => {
    const g = groupOf(r, c);
    return g < 0 ? 0 : groups[g];
  };
  const diag = rule === 'diagonal' ? [0, 0] : null; // digits on the main and the anti diagonal
  const diagBits = (r, c) => (diag ? (r === c ? diag[0] : 0) | (r + c === N - 1 ? diag[1] : 0) : 0);
  /** Digits already used a knight's move away from a cell (knight rule). */
  const knightBits = (r, c) => {
    if (rule !== 'knight') return 0;
    let m = 0;
    for (const [dr, dc] of KNIGHT) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N && cells[rr * N + cc]) m |= 1 << cells[rr * N + cc];
    }
    return m;
  };
  const place = (r, c, bit) => {
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[boxOf(r, c)] |= bit;
    if (groups && groupOf(r, c) >= 0) groups[groupOf(r, c)] |= bit;
    if (diag) {
      if (r === c) diag[0] |= bit;
      if (r + c === N - 1) diag[1] |= bit;
    }
  };
  const lift = (r, c, bit) => {
    rows[r] &= ~bit;
    cols[c] &= ~bit;
    boxes[boxOf(r, c)] &= ~bit;
    if (groups && groupOf(r, c) >= 0) groups[groupOf(r, c)] &= ~bit;
    if (diag) {
      if (r === c) diag[0] &= ~bit;
      if (r + c === N - 1) diag[1] &= ~bit;
    }
  };
  for (let i = 0; i < N * N; i++) {
    const v = cells[i];
    if (!v) continue;
    const bit = 1 << v;
    const r = Math.floor(i / N);
    const c = i % N;
    if (rows[r] & bit || cols[c] & bit || boxes[boxOf(r, c)] & bit || diagBits(r, c) & bit || groupBits(r, c) & bit) return { count: 0, solution: null };
    if (rule === 'knight') {
      cells[i] = 0; // look at the others only
      const clash = knightBits(r, c) & bit;
      cells[i] = v;
      if (clash) return { count: 0, solution: null };
    }
    place(r, c, bit);
  }
  let count = 0;
  let first = null;
  const solve = () => {
    if (count >= limit) return;
    let best = -1;
    let bestMask = 0;
    let bestCount = 99;
    for (let i = 0; i < N * N; i++) {
      if (cells[i]) continue;
      const r = Math.floor(i / N);
      const c = i % N;
      const mask = ALL & ~(rows[r] | cols[c] | boxes[boxOf(r, c)] | diagBits(r, c) | knightBits(r, c) | groupBits(r, c));
      const k = bitCount(mask);
      if (k < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = k;
        if (k <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      first ??= cells.join('');
      return;
    }
    if (bestCount === 0) return;
    const r = Math.floor(best / N);
    const c = best % N;
    for (const v of order) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      cells[best] = v;
      place(r, c, bit);
      solve();
      lift(r, c, bit);
      cells[best] = 0;
      if (count >= limit) return;
    }
  };
  solve();
  return { count, solution: first };
}

const digits = (n) => Array.from({ length: n }, (_, i) => i + 1);

export function solveSudoku(puzzle, limit = 2) {
  if (isKindRule(puzzle.rule)) return solveKind(puzzle, limit);
  return search([...puzzle.givens].map(Number), limit, digits(sizeOf(puzzle.givens)), puzzle.rule ?? null);
}

function randomFullGrid(rng, N, rule = null) {
  const order = rng.shuffle(digits(N));
  const cells = new Array(N * N).fill(0);
  // Seeding the first row randomly gives every seed a different grid; the search then completes it.
  rng.shuffle(digits(N)).forEach((v, i) => (cells[i] = v));
  return search(cells, 1, order, rule).solution;
}

/** `clues` is how many numbers to leave in the grid: fewer is harder (about 24 is the practical floor for random removal). */
export function generateSudoku(rng, clues, N = 9, rule = null) {
  const cells = randomFullGrid(rng, N, rule).split('');
  let remaining = N * N;
  for (const i of rng.shuffle([...Array(N * N).keys()])) {
    if (remaining <= clues) break;
    const saved = cells[i];
    cells[i] = '0';
    if (solveSudoku({ givens: cells.join(''), rule }, 2).count === 1) remaining--;
    else cells[i] = saved;
  }
  return rule ? { givens: cells.join(''), rule } : { givens: cells.join('') };
}
