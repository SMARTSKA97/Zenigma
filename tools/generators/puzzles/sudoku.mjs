// Mini Sudoku: a 6x6 grid with 2-row by 3-column boxes. Every row, column and box holds 1 to 6 once.

export const SUDOKU_SIZE = 6;
const N = 6;
const BOX_ROWS = 2;
const BOX_COLS = 3;

const boxOf = (r, c) => Math.floor(r / BOX_ROWS) * (N / BOX_COLS) + Math.floor(c / BOX_COLS);

export function solveSudoku(puzzle, limit = 2) {
  const cells = [...puzzle.givens].map(Number);
  const rows = Array.from({ length: N }, () => new Set());
  const cols = Array.from({ length: N }, () => new Set());
  const boxes = Array.from({ length: N }, () => new Set());
  for (let i = 0; i < N * N; i++) {
    if (!cells[i]) continue;
    const r = Math.floor(i / N);
    const c = i % N;
    const v = cells[i];
    if (rows[r].has(v) || cols[c].has(v) || boxes[boxOf(r, c)].has(v)) return { count: 0, solution: null };
    rows[r].add(v);
    cols[c].add(v);
    boxes[boxOf(r, c)].add(v);
  }
  let count = 0;
  let first = null;
  const solve = () => {
    if (count >= limit) return;
    // Pick the empty cell with the fewest options.
    let best = -1;
    let bestOptions = null;
    for (let i = 0; i < N * N; i++) {
      if (cells[i]) continue;
      const r = Math.floor(i / N);
      const c = i % N;
      const options = [];
      for (let v = 1; v <= N; v++) if (!rows[r].has(v) && !cols[c].has(v) && !boxes[boxOf(r, c)].has(v)) options.push(v);
      if (best === -1 || options.length < bestOptions.length) {
        best = i;
        bestOptions = options;
        if (options.length <= 1) break;
      }
    }
    if (best === -1) {
      count++;
      first ??= cells.join('');
      return;
    }
    const r = Math.floor(best / N);
    const c = best % N;
    for (const v of bestOptions) {
      cells[best] = v;
      rows[r].add(v);
      cols[c].add(v);
      boxes[boxOf(r, c)].add(v);
      solve();
      rows[r].delete(v);
      cols[c].delete(v);
      boxes[boxOf(r, c)].delete(v);
      cells[best] = 0;
    }
  };
  solve();
  return { count, solution: first };
}

function randomFullGrid(rng) {
  for (;;) {
    // Randomise by pre-filling the first row, then solving.
    const row = rng.shuffle([1, 2, 3, 4, 5, 6]);
    const puzzle = { givens: row.join('') + '0'.repeat(N * N - N) };
    const { solution } = solveSudoku(puzzle, 1);
      if (solution) return solution;
  }
}

/** `clues` is how many numbers to leave in the grid; fewer clues is harder (the minimum that stays unique is about 8). */
export function generateSudoku(rng, clues) {
  const full = randomFullGrid(rng);
  const cells = full.split('');
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
