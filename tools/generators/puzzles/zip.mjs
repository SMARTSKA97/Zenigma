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

/** Counts the solutions (stops at `limit`). A solution is the list of cells in the order the path visits them. */
export function solveZip(puzzle, limit = 2) {
  const { size: n, numbers } = puzzle;
  const total = n * n;
  const top = Math.max(...numbers);
  const start = numbers.indexOf(1);
  const nbrs = Array.from({ length: total }, (_, i) => neighbours(n, i));
  const seen = new Array(total).fill(false);
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

/** `target` is how many numbers the player gets to see; fewer is harder (the puzzle may need more to stay unique). */
export function generateZip(size, rng, target = 6) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const path = randomPath(size, rng);
    const last = path.length - 1;
    const marks = new Set([0, last]);
    while (marks.size < Math.min(target, path.length)) marks.add(rng.int(path.length));

    let puzzle = { size, numbers: numberCells(size, path, marks) };
    let guard = 0;
    while (solveZip(puzzle, 2).count !== 1) {
      if (++guard > path.length) break;
      let add;
      do add = rng.int(path.length);
      while (marks.has(add));
      marks.add(add);
      puzzle = { size, numbers: numberCells(size, path, marks) };
    }
    if (solveZip(puzzle, 2).count !== 1) continue;

    // Take numbers away again while the path stays the only answer.
    for (const index of rng.shuffle([...marks])) {
      if (marks.size <= target) break;
      if (index === 0 || index === last) continue;
      marks.delete(index);
      const trial = { size, numbers: numberCells(size, path, marks) };
      if (solveZip(trial, 2).count === 1) puzzle = trial;
      else marks.add(index);
    }
    return puzzle;
  }
  throw new Error(`Could not generate a ${size}x${size} Zip puzzle`);
}
