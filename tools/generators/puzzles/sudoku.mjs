// Sudoku in two sizes: the classic 9x9 grid (3x3 boxes) and a mini 6x6 grid (boxes 2 rows by 3 columns).
// Every row, column and box holds 1 to n once. A puzzle is its `givens` string; 36 characters means mini, 81 classic.

export const sizeOf = (givens) => Math.round(Math.sqrt(givens.length));
/** Box height and width for a grid of side n. */
const boxShape = (n) => (n === 6 ? [2, 3] : [3, 3]);
const bitCount = (x) => {
  let n = 0;
  for (; x; x &= x - 1) n++;
  return n;
};

/** Counts solutions (up to `limit`) with bitmasks and "fewest options first" search. `order` randomises digit order. */
function search(cells, limit, order) {
  const N = Math.round(Math.sqrt(cells.length));
  const ALL = ((1 << (N + 1)) - 1) & ~1; // bits 1..N
  const [bh, bw] = boxShape(N);
  const boxOf = (r, c) => Math.floor(r / bh) * (N / bw) + Math.floor(c / bw);
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

const digits = (n) => Array.from({ length: n }, (_, i) => i + 1);

export function solveSudoku(puzzle, limit = 2) {
  return search([...puzzle.givens].map(Number), limit, digits(sizeOf(puzzle.givens)));
}

function randomFullGrid(rng, N) {
  const order = rng.shuffle(digits(N));
  const cells = new Array(N * N).fill(0);
  // Seeding the first row randomly gives every seed a different grid; the search then completes it.
  rng.shuffle(digits(N)).forEach((v, i) => (cells[i] = v));
  return search(cells, 1, order).solution;
}

/** `clues` is how many numbers to leave in the grid: fewer is harder (about 24 is the practical floor for random removal). */
export function generateSudoku(rng, clues, N = 9) {
  const cells = randomFullGrid(rng, N).split('');
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
