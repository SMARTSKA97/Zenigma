// Sudoku: the classic 9x9 grid with 3x3 boxes. Every row, column and box holds 1 to 9 once.

export const SUDOKU_SIZE = 9;
const N = 9;
const ALL = 0x3fe; // bits 1..9

const boxOf = (r, c) => Math.floor(r / 3) * 3 + Math.floor(c / 3);
const bitCount = (x) => {
  let n = 0;
  for (; x; x &= x - 1) n++;
  return n;
};

/** Counts solutions (up to `limit`) with bitmasks and "fewest options first" search. `order` randomises digit order. */
function search(cells, limit, order) {
  const rows = new Array(N).fill(0);
  const cols = new Array(N).fill(0);
  const boxes = new Array(N).fill(0);
  for (let i = 0; i < N * N; i++) {
    const v = cells[i];
    if (!v) continue;
    const bit = 1 << v;
    const r = Math.floor(i / N);
    const c = i % N;
    if (rows[r] & bit || cols[c] & bit || boxes[boxOf(r, c)] & bit) return { count: 0, solution: null };
    rows[r] |= bit;
    cols[c] |= bit;
    boxes[boxOf(r, c)] |= bit;
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
      const mask = ALL & ~(rows[r] | cols[c] | boxes[boxOf(r, c)]);
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
    const b = boxOf(r, c);
    for (const v of order) {
      const bit = 1 << v;
      if (!(bestMask & bit)) continue;
      cells[best] = v;
      rows[r] |= bit;
      cols[c] |= bit;
      boxes[b] |= bit;
      solve();
      rows[r] &= ~bit;
      cols[c] &= ~bit;
      boxes[b] &= ~bit;
      cells[best] = 0;
      if (count >= limit) return;
    }
  };
  solve();
  return { count, solution: first };
}

export function solveSudoku(puzzle, limit = 2) {
  return search([...puzzle.givens].map(Number), limit, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
}

function randomFullGrid(rng) {
  const order = rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const cells = new Array(N * N).fill(0);
  // Seeding the first row randomly gives every seed a different grid; the search then completes it.
  rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).forEach((v, i) => (cells[i] = v));
  return search(cells, 1, order).solution;
}

/** `clues` is how many numbers to leave in the grid: fewer is harder (about 24 is the practical floor for random removal). */
export function generateSudoku(rng, clues) {
  const cells = randomFullGrid(rng).split('');
  let remaining = N * N;
  for (const i of rng.shuffle([...Array(N * N).keys()])) {
    if (remaining <= clues) break;
    const saved = cells[i];
    cells[i] = '0';
    if (solveSudoku({ givens: cells.join('') }, 2).count === 1) remaining--;
    else cells[i] = saved;
  }
  return { givens: cells.join('') };
}
