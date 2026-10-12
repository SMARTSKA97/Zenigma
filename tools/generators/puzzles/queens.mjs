// Queens: place one queen in every row, column and colour region, with no two queens touching (even diagonally).

const NEIGHBOURS = (n, i) => {
  const r = Math.floor(i / n);
  const c = i % n;
  const out = [];
  if (r > 0) out.push(i - n);
  if (r < n - 1) out.push(i + n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  return out;
};

/** True if region `region` is still one connected piece after `cell` leaves it. */
function staysConnected(regions, size, cell, region) {
  const members = [];
  for (let i = 0; i < regions.length; i++) if (regions[i] === region && i !== cell) members.push(i);
  if (members.length === 0) return false;
  const seen = new Set([members[0]]);
  const stack = [members[0]];
  while (stack.length) {
    const i = stack.pop();
    for (const j of NEIGHBOURS(size, i)) {
      if (j !== cell && regions[j] === region && !seen.has(j)) {
        seen.add(j);
        stack.push(j);
      }
    }
  }
  return seen.size === members.length;
}

/** Counts solutions (stops at `limit`). Returns the columns of the first one found, too. */
export function solveQueens(puzzle, limit = 2) {
  const { size: n, regions } = puzzle;
  const cols = new Array(n).fill(-1);
  const usedCol = new Array(n).fill(false);
  const usedRegion = new Array(n).fill(false);
  let count = 0;
  let first = null;
  const place = (row) => {
    if (count >= limit) return;
    if (row === n) {
      count++;
      first ??= [...cols];
      return;
    }
    for (let c = 0; c < n; c++) {
      if (usedCol[c]) continue;
      const region = regions[row * n + c];
      if (usedRegion[region]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) < 2) continue;
      cols[row] = c;
      usedCol[c] = usedRegion[region] = true;
      place(row + 1);
      usedCol[c] = usedRegion[region] = false;
      cols[row] = -1;
    }
  };
  place(0);
  return { count, solution: first };
}

/** Pre-placed queens: `count` cells of the one solution are given, drawn after the layout so the layout itself never changes. */
export function withGivens(puzzle, rng, count) {
  if (!count) return puzzle;
  const { solution } = solveQueens(puzzle, 2);
  const rows = rng.shuffle([...Array(puzzle.size).keys()]).slice(0, Math.min(count, puzzle.size - 1)).sort((a, b) => a - b);
  return { ...puzzle, givens: rows.map((r) => r * puzzle.size + solution[r]) };
}

export function generateQueens(size, rng, givens = 0) {
  for (let attempt = 0; attempt < 2000; attempt++) {
    // 1. A random valid queen layout.
    const queens = [];
    const usedCol = new Set();
    const lay = (row) => {
      if (row === size) return true;
      for (const c of rng.shuffle([...Array(size).keys()])) {
        if (usedCol.has(c)) continue;
        if (row > 0 && Math.abs(queens[row - 1] - c) < 2) continue;
        queens[row] = c;
        usedCol.add(c);
        if (lay(row + 1)) return true;
        usedCol.delete(c);
      }
      return false;
    };
    if (!lay(0)) continue;

    // 2. Grow one region around each queen until the board is full.
    const regions = new Array(size * size).fill(-1);
    queens.forEach((c, r) => (regions[r * size + c] = r));
    let free = size * size - size;
    while (free > 0) {
      const frontier = [];
      for (let i = 0; i < regions.length; i++) {
        if (regions[i] === -1) continue;
        for (const j of NEIGHBOURS(size, i)) if (regions[j] === -1) frontier.push([j, regions[i]]);
      }
      const [cell, region] = rng.pick(frontier);
      regions[cell] = region;
      free--;
    }

    // 3. Nudge region borders (keeping every region in one piece) until exactly one solution is left.
    const puzzle = { size, regions };
    let count = solveQueens(puzzle, 40).count;
    for (let move = 0; move < 400 && count > 1; move++) {
      const cell = rng.int(size * size);
      const from = regions[cell];
      if (queens[from] === cell % size && from === Math.floor(cell / size)) continue; // never move a queen's own cell
      const targets = [...new Set(NEIGHBOURS(size, cell).map((j) => regions[j]).filter((r) => r !== from))];
      if (targets.length === 0 || !staysConnected(regions, size, cell, from)) continue;
      const to = rng.pick(targets);
      regions[cell] = to;
      const next = solveQueens(puzzle, 40).count;
      if (next === 0 || next > count) regions[cell] = from; // worse: undo
      else count = next;
    }
    if (count === 1) return withGivens(puzzle, rng, givens);
  }
  throw new Error(`Could not generate a ${size}x${size} Queens puzzle`);
}
