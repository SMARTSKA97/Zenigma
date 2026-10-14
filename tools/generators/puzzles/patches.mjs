// Patches: split the grid into rectangles. Every rectangle holds exactly one clue cell and has the clue's area
// (the number of cells), and when the clue shows a shape the rectangle must match it: wide, tall or square.
//
// A puzzle is { size, clues: [[cell, area, shape], ...] } with shape 0 = any, 1 = wide (more columns than rows),
// 2 = tall (more rows than columns), 3 = square. A solution is a list of rectangles [row0, col0, row1, col1] (inclusive).

export const SHAPE_ANY = 0;
export const SHAPE_WIDE = 1;
export const SHAPE_TALL = 2;
export const SHAPE_SQUARE = 3;

export const shapeOf = (w, h) => (w === h ? SHAPE_SQUARE : w > h ? SHAPE_WIDE : SHAPE_TALL);

/** Counts the ways to cut the grid (stops at `limit`). Solutions are rectangles, sorted by top-left corner. */
export function solvePatches(puzzle, limit = 2) {
  const { size: n, clues } = puzzle;
  const clueAt = new Array(n * n).fill(-1);
  clues.forEach(([cell], k) => (clueAt[cell] = k));
  const covered = new Array(n * n).fill(false);
  const rects = [];
  let count = 0;
  let first = null;

  const walk = (from) => {
    if (count >= limit) return;
    let at = from;
    while (at < n * n && covered[at]) at++;
    if (at === n * n) {
      count++;
      first ??= rects.map((r) => [...r]);
      return;
    }
    const r0 = Math.floor(at / n);
    const c0 = at % n;
    let maxW = 0;
    while (c0 + maxW < n && !covered[r0 * n + c0 + maxW]) maxW++;
    for (let h = 1; r0 + h <= n; h++) {
      // The rows must stay free over the widest width we can still use.
      let rowFree = 0;
      while (rowFree < maxW && !covered[(r0 + h - 1) * n + c0 + rowFree]) rowFree++;
      maxW = rowFree;
      if (maxW === 0) break;
      for (let w = 1; w <= maxW; w++) {
        // Exactly one clue inside, with this area and shape.
        let found = -1;
        let many = false;
        for (let r = r0; r < r0 + h && !many; r++) {
          for (let c = c0; c < c0 + w; c++) {
            const k = clueAt[r * n + c];
            if (k < 0) continue;
            if (found >= 0) {
              many = true;
              break;
            }
            found = k;
          }
        }
        if (many || found < 0) continue;
        const [, area, shape] = clues[found];
        if (area !== 0 && area !== w * h) continue; // area 0: the number is hidden, any size will do
        if (shape !== SHAPE_ANY && shape !== shapeOf(w, h)) continue;
        for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) covered[r * n + c] = true;
        rects.push([r0, c0, r0 + h - 1, c0 + w - 1]);
        walk(at + 1);
        rects.pop();
        for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) covered[r * n + c] = false;
      }
    }
  };
  walk(0);
  return { count, solution: first };
}

/** A random way to cut the grid into rectangles (no clues yet). */
function randomCut(n, rng, cap, maxArea) {
  const covered = new Array(n * n).fill(false);
  const rects = [];
  for (let at = 0; at < n * n; at++) {
    if (covered[at]) continue;
    const r0 = Math.floor(at / n);
    const c0 = at % n;
    let maxW = 0;
    while (c0 + maxW < n && !covered[r0 * n + c0 + maxW]) maxW++;
    let w = 1 + rng.int(Math.min(maxW, cap));
    // How tall can it grow over this width?
    let room = 1;
    while (r0 + room < n && Array.from({ length: w }, (_, k) => covered[(r0 + room) * n + c0 + k]).every((x) => !x)) room++;
    let h = 1 + rng.int(Math.min(room, cap));
    if (w * h === 1 && rng.next() < 0.7 && maxW >= 2) w = 2; // fewer single cells
    while (w * h > maxArea) (w >= h ? w-- : h--);
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) covered[r * n + c] = true;
    rects.push([r0, c0, r0 + h - 1, c0 + w - 1]);
  }
  return rects;
}

/**
 * `extra` is how many shape hints to show beyond the ones the puzzle needs to have a single answer
 * (more is easier). The clue sits in a random cell of each rectangle.
 */
export function generatePatches(size, rng, extra = 0) {
  const cap = Math.max(3, Math.ceil(size / 2) + 1);
  for (let attempt = 0; attempt < 400; attempt++) {
    const rects = randomCut(size, rng, cap, size + 1);
    if (rects.length < size - 1 || rects.length > size * 2) continue;
    const clues = rects.map(([r0, c0, r1, c1]) => {
      const r = r0 + rng.int(r1 - r0 + 1);
      const c = c0 + rng.int(c1 - c0 + 1);
      return [r * size + c, (r1 - r0 + 1) * (c1 - c0 + 1), SHAPE_ANY];
    });
    const truth = rects.map(([r0, c0, r1, c1]) => shapeOf(c1 - c0 + 1, r1 - r0 + 1));
    const puzzle = { size, clues };
    // Show shapes one at a time, on a random rectangle, until the answer is unique.
    const order = rng.shuffle(clues.map((_, k) => k).filter((k) => clues[k][1] > 1));
    let used = 0;
    while (solvePatches(puzzle, 2).count !== 1 && used < order.length) {
      const k = order[used++];
      clues[k][2] = truth[k];
    }
    if (solvePatches(puzzle, 2).count !== 1) continue;
    for (let more = 0; more < extra && used < order.length; more++) clues[order[used++]][2] = truth[order[used - 1]];
    return { size, clues: clues.sort((a, b) => a[0] - b[0]) };
  }
  throw new Error(`Could not generate a ${size}x${size} Patches puzzle`);
}

/**
 * A Patches puzzle with numbers only: no clue shows a shape, so the player works out wide, tall or square from the numbers alone.
 * Many random cuts are tried until one has a single answer without any shape hints.
 */
export function generatePatchesNumbers(size, rng) {
  const cap = Math.max(3, Math.ceil(size / 2) + 1);
  for (let attempt = 0; attempt < 20000; attempt++) {
    const rects = randomCut(size, rng, cap, size + 1);
    if (rects.length < size - 1 || rects.length > size * 2) continue;
    const clues = rects.map(([r0, c0, r1, c1]) => {
      const r = r0 + rng.int(r1 - r0 + 1);
      const c = c0 + rng.int(c1 - c0 + 1);
      return [r * size + c, (r1 - r0 + 1) * (c1 - c0 + 1), SHAPE_ANY];
    });
    const puzzle = { size, clues };
    if (solvePatches(puzzle, 2).count === 1) return { size, clues: clues.sort((a, b) => a[0] - b[0]) };
  }
  throw new Error(`Could not generate a ${size}x${size} numbers-only Patches puzzle`);
}

/**
 * A Patches puzzle where some numbers are hidden: those clues show only their shape (wide, tall or square), and the player works
 * out how big each patch is. `share` (0 to 1) is how many of the numbers to hide, as long as the answer stays unique.
 */
export function generatePatchesHidden(size, rng, share = 0.5) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const base = generatePatches(size, rng, size * size); // every shape shown
    const clues = base.clues.map(([cell, area, shape]) => [cell, area, shape === SHAPE_ANY ? SHAPE_SQUARE : shape]);
    const puzzle = { size, clues };
    const want = Math.max(1, Math.round(clues.length * share));
    let hidden = 0;
    for (const k of rng.shuffle(clues.map((_, i) => i))) {
      if (hidden >= want) break;
      const area = clues[k][1];
      clues[k][1] = 0;
      if (solvePatches(puzzle, 2).count === 1) hidden++;
      else clues[k][1] = area;
    }
    if (hidden > 0) return puzzle;
  }
  throw new Error(`Could not generate a ${size}x${size} hidden-number Patches puzzle`);
}
