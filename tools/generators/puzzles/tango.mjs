// Tango: fill a 6x6 grid with suns (s) and moons (m). No more than two of the same in a row or column, each row and
// column has three of each, and "=" / "x" signs between neighbours say whether the two cells match or differ.

export const TANGO_SIZE = 6;
const N = TANGO_SIZE;

/** Counts solutions (stops at `limit`) for a puzzle { givens, edges }. */
export function solveTango(puzzle, limit = 2) {
  const cells = [...puzzle.givens].map((ch) => (ch === '.' ? null : ch));
  const links = Array.from({ length: N * N }, () => []);
  for (const [a, b, kind] of puzzle.edges) {
    links[a].push([b, kind]);
    links[b].push([a, kind]);
  }
  let count = 0;
  let first = null;

  const ok = (i) => {
    const r = Math.floor(i / N);
    const c = i % N;
    const v = cells[i];
    // No three in a row, in any direction around this cell.
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      for (let k = -2; k <= 0; k++) {
        const vals = [];
        for (let t = 0; t < 3; t++) {
          const rr = r + dr * (k + t);
          const cc = c + dc * (k + t);
          if (rr < 0 || rr >= N || cc < 0 || cc >= N) break;
          vals.push(cells[rr * N + cc]);
        }
        if (vals.length === 3 && vals.every((x) => x === v)) return false;
      }
    }
    // At most three of each symbol per row and column.
    let rowCount = 0;
    let colCount = 0;
    for (let k = 0; k < N; k++) {
      if (cells[r * N + k] === v) rowCount++;
      if (cells[k * N + c] === v) colCount++;
    }
    if (rowCount > N / 2 || colCount > N / 2) return false;
    // Signs between this cell and an already-filled neighbour.
    for (const [j, kind] of links[i]) {
      const other = cells[j];
      if (other === null) continue;
      if (kind === '=' ? other !== v : other === v) return false;
    }
    return true;
  };

  const place = (i) => {
    if (count >= limit) return;
    if (i === N * N) {
      count++;
      first ??= cells.join('');
      return;
    }
    if (cells[i] !== null) {
      // A given: it must itself obey the rules.
      if (ok(i)) place(i + 1);
      return;
    }
    for (const v of ['s', 'm']) {
      cells[i] = v;
      if (ok(i)) place(i + 1);
      cells[i] = null;
    }
  };
  place(0);
  return { count, solution: first };
}

function randomFullGrid(rng) {
  // Walk the solver with random symbol order to get one random valid grid.
  const cells = new Array(N * N).fill(null);
  const fill = (i) => {
    if (i === N * N) return true;
    for (const v of rng.shuffle(['s', 'm'])) {
      cells[i] = v;
      const r = Math.floor(i / N);
      const c = i % N;
      let good = true;
      if (c >= 2 && cells[i - 1] === v && cells[i - 2] === v) good = false;
      if (r >= 2 && cells[i - N] === v && cells[i - 2 * N] === v) good = false;
      let rowCount = 0;
      let colCount = 0;
      for (let k = 0; k < N; k++) {
        if (cells[r * N + k] === v) rowCount++;
        if (cells[k * N + c] === v) colCount++;
      }
      if (rowCount > N / 2 || colCount > N / 2) good = false;
      if (good && fill(i + 1)) return true;
    }
    cells[i] = null;
    return false;
  };
  return fill(0) ? cells.join('') : null;
}

/** `extra` is how many clues to leave in beyond the minimum: more clues, easier puzzle. */
export function generateTango(rng, extra = 0) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const grid = randomFullGrid(rng);
    if (!grid) continue;

    const allEdges = [];
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const i = r * N + c;
        if (c < N - 1) allEdges.push([i, i + 1, grid[i] === grid[i + 1] ? '=' : 'x']);
        if (r < N - 1) allEdges.push([i, i + N, grid[i] === grid[i + N] ? '=' : 'x']);
      }
    }
    // Start with every clue, then remove them in random order while the solution stays unique.
    const clues = [
      ...allEdges.map((e) => ({ type: 'edge', e })),
      ...grid.split('').map((v, i) => ({ type: 'cell', i, v })),
    ];
    const build = (list) => {
      const givens = new Array(N * N).fill('.');
      const edges = [];
      for (const c of list) {
        if (c.type === 'cell') givens[c.i] = c.v;
        else edges.push(c.e);
      }
      return { givens: givens.join(''), edges };
    };
    let kept = [...clues];
    const removed = [];
    for (const clue of rng.shuffle(clues)) {
      const trial = kept.filter((c) => c !== clue);
      if (solveTango(build(trial), 2).count === 1) {
        kept = trial;
        removed.push(clue);
      }
    }
    // Put some clues back for gentler levels.
    for (const clue of rng.shuffle(removed).slice(0, extra)) kept.push(clue);
    const puzzle = build(kept);
    const check = solveTango(puzzle, 2);
    if (check.count === 1 && check.solution === grid) return puzzle;
  }
  throw new Error('Could not generate a Tango puzzle');
}
