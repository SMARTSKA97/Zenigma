// Zip: draw one path through every cell of the grid, passing the numbered cells in order (1, 2, 3 ...), starting at 1 and ending on the highest number.

const neighbours = (n, i) => {
  const r = Math.floor(i / n);
  const c = i % n;
  const out = [];
  if (r > 0) out.push(i - n);
  if (c > 0) out.push(i - 1);
  if (c < n - 1) out.push(i + 1);
  if (r < n - 1) out.push(i + n);
  return out;
};

/**
 * Optional extras make a puzzle harder: `walls` are pairs of side-by-side cells [a, b] the path may not cross between, and
 * `holes` are cells that are blocked (the path skips them, so it covers size x size minus the holes).
 */
export const wallKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

/** The neighbours each cell can step to, once walls and holes are taken into account. */
export function openNeighbours(puzzle) {
  const { size: n, walls = [], holes = [] } = puzzle;
  const blocked = new Set(walls.map(([a, b]) => wallKey(a, b)));
  const gone = new Set(holes);
  return Array.from({ length: n * n }, (_, i) => (gone.has(i) ? [] : neighbours(n, i).filter((v) => !gone.has(v) && !blocked.has(wallKey(i, v)))));
}

/** Counts the solutions (stops at `limit`). A solution is the list of cells in the order the path visits them. */
export function solveZip(puzzle, limit = 2) {
  const { size: n, numbers } = puzzle;
  const total = n * n - (puzzle.holes?.length ?? 0);
  const top = Math.max(...numbers);
  const start = numbers.indexOf(1);
  const nbrs = openNeighbours(puzzle);
  const seen = new Array(n * n).fill(false);
  const path = [];
  let count = 0;
  let first = null;

  /** An unvisited cell with fewer than two ways in or out (other than the cell we stand on) can never be part of the path. */
  const stranded = (at) => {
    for (const v of nbrs[at]) {
      if (seen[v]) continue;
      let free = 0;
      for (const w of nbrs[v]) if (!seen[w] || w === at) free++;
      if (free < 2 && numbers[v] !== top) return true;
    }
    return false;
  };

  const walk = (at, next) => {
    if (count >= limit) return;
    if (path.length === total) {
      if (next > top) {
        count++;
        first ??= [...path];
      }
      return;
    }
    for (const v of nbrs[at]) {
      if (seen[v]) continue;
      const num = numbers[v];
      if (num !== 0) {
        if (num !== next) continue; // numbers must be reached in order
      } 
      if (num === top && path.length + 1 !== total) continue; // the highest number is where the path ends
      seen[v] = true;
      path.push(v);
      if (!stranded(v)) walk(v, num === next ? next + 1 : next);
      path.pop();
      seen[v] = false;
    }
  };

  seen[start] = true;
  path.push(start);
  walk(start, 2);
  return { count, solution: first };
}

/** A random path through every cell, made by "backbiting" a snake: reconnect one end to a neighbouring cell and flip the stretch between. */
function randomPath(n, rng) {
  let path = [];
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) path.push(r * n + (r % 2 === 0 ? k : n - 1 - k));
  for (let step = 0; step < n * n * 12; step++) {
    const atHead = rng.int(2) === 0;
    if (!atHead) path.reverse();
    const head = path[0];
    const options = neighbours(n, head).filter((v) => v !== path[1]);
    const v = rng.pick(options);
    const j = path.indexOf(v);
    path = [...path.slice(0, j).reverse(), ...path.slice(j)];
    if (!atHead) path.reverse();
  }
  return path;
}

const numberCells = (n, path, marks) => {
  const numbers = new Array(n * n).fill(0);
  [...marks].sort((a, b) => a - b).forEach((index, k) => (numbers[path[index]] = k + 1));
  return numbers;
};

/** A random path through every open cell when some cells are holes: a randomised walk with backtracking (null if it gives up). */
function randomPathAround(n, holes, rng) {
  const gone = new Set(holes);
  const open = n * n - gone.size;
  const nbrs = Array.from({ length: n * n }, (_, i) => neighbours(n, i).filter((v) => !gone.has(v)));
  const seen = new Array(n * n).fill(false);
  const path = [];
  let budget = 20000;
  const walk = (at) => {
    if (path.length === open) return true;
    if (--budget < 0) return false;
    const next = rng.shuffle(nbrs[at].filter((v) => !seen[v]));
    // Visit cells with the fewest free neighbours first, so corners and dead ends are not left for last.
    next.sort((a, b) => nbrs[a].filter((v) => !seen[v]).length - nbrs[b].filter((v) => !seen[v]).length);
    for (const v of next) {
      seen[v] = true;
      path.push(v);
      if (walk(v)) return true;
      path.pop();
      seen[v] = false;
    }
    return false;
  };
  const starts = rng.shuffle(Array.from({ length: n * n }, (_, i) => i).filter((i) => !gone.has(i)));
  for (const s of starts.slice(0, 6)) {
    path.length = 0;
    seen.fill(false);
    seen[s] = true;
    path.push(s);
    if (walk(s)) return [...path];
    if (budget < 0) return null;
  }
  return null;
}

/** Walls between side-by-side cells that are not neighbours on the path, so they actually forbid a way through. */
function pickWalls(n, path, holes, count, rng) {
  const gone = new Set(holes);
  const next = new Map();
  path.forEach((c, i) => {
    if (i > 0) {
      next.set(wallKey(path[i - 1], c), true);
    }
  });
  const options = [];
  for (let i = 0; i < n * n; i++) {
    if (gone.has(i)) continue;
    for (const v of neighbours(n, i)) if (v > i && !gone.has(v) && !next.has(wallKey(i, v))) options.push([i, v]);
  }
  return rng.shuffle(options).slice(0, count);
}

/**
 * `target` is how many numbers the player gets to see; fewer is harder (the puzzle may need more to stay unique).
 * `extras.walls` and `extras.holes` say how many walls and blocked cells to add.
 */
export function generateZip(size, rng, target = 6, extras = {}) {
  const wantWalls = extras.walls ?? 0;
  const wantHoles = extras.holes ?? 0;
  for (let attempt = 0; attempt < 400; attempt++) {
    let holes = [];
    let path;
    if (wantHoles > 0) {
      holes = rng.shuffle(Array.from({ length: size * size }, (_, i) => i)).slice(0, wantHoles).sort((a, b) => a - b);
      path = randomPathAround(size, holes, rng);
      if (!path) continue;
    } else {
      path = randomPath(size, rng);
    }
    const walls = wantWalls > 0 ? pickWalls(size, path, holes, wantWalls, rng) : [];
    const extra = {};
    if (walls.length) extra.walls = walls;
    if (holes.length) extra.holes = holes;
    const last = path.length - 1;
    const marks = new Set([0, last]);
    while (marks.size < Math.min(target, path.length)) marks.add(rng.int(path.length));

    const build = () => ({ size, numbers: numberCells(size, path, marks), ...extra });
    let puzzle = build();
    let guard = 0;
    while (solveZip(puzzle, 2).count !== 1) {
      if (++guard > path.length) break;
      let add;
      do add = rng.int(path.length);
      while (marks.has(add));
      marks.add(add);
      puzzle = build();
    }
    if (solveZip(puzzle, 2).count !== 1) continue;

    // Take numbers away again while the path stays the only answer.
    for (const index of rng.shuffle([...marks])) {
      if (marks.size <= target) break;
      if (index === 0 || index === last) continue;
      marks.delete(index);
      const trial = build();
      if (solveZip(trial, 2).count === 1) puzzle = trial;
      else marks.add(index);
    }
    return puzzle;
  }
  throw new Error(`Could not generate a ${size}x${size} Zip puzzle`);
}
