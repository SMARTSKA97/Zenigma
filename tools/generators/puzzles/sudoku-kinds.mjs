// Sudoku kinds that carry extra data besides the givens. All are on the classic 9x9 grid.
//   even-odd     { givens, rule, parity }   parity: 81 chars, 'e' (even digit), 'o' (odd digit) or '.' (free)
//   consecutive  { givens, rule, bars }     bars: [a, b] pairs of side-by-side cells whose digits differ by 1; no other side-by-side pair does
//   kropki       { givens, rule, dots }     dots: [a, b, t] for side-by-side cells; t = 1 white (digits differ by 1) or 2 black (one is double the other, which wins for 1 and 2); no dot means neither
//   little       { givens, rule, littles }  littles: [sum, start, dr, dc]; the digits on the diagonal from the edge cell `start` going (dr, dc) add up to sum (repeats are fine)
//   thermo       { givens, rule, thermos }  thermos: lists of cells, bulb first; digits strictly increase along each
//   renban       { givens, rule, lines }    lines: lists of cells; each line holds different digits that form a run of consecutive numbers, in any order
//   killer       { givens, rule, cages }    cages: [sum, cell, cell, ...]; digits in a cage differ and add up to the sum
//   jigsaw       { givens, rule, regions }  regions: 81 chars '0'..'8': the nine irregular regions that replace the 3x3 boxes
//   arrow        { givens, rule, arrows }   arrows: [circle, cell, cell, ...]; the digits on the arrow add up to the circle's digit
//   sandwich     { givens, rule, rows, cols }  rows/cols: nine sums; the digits between the 1 and the 9 of that line add up to it
// Every row and column holds 1 to 9 once, and so does every box (every region, for jigsaw).

export const KIND_RULES = ['even-odd', 'consecutive', 'thermo', 'killer', 'jigsaw', 'arrow', 'sandwich', 'renban', 'kropki', 'little'];
export const isKindRule = (rule) => KIND_RULES.includes(rule);

const N = 9;
/** The cells of a Little Killer diagonal: from the edge cell `start` in direction (dr, dc) until the edge. */
export function rayCells(start, dr, dc) {
  const out = [];
  let r = rowOf(start);
  let c = colOf(start);
  while (r >= 0 && r < N && c >= 0 && c < N) {
    out.push(r * N + c);
    r += dr;
    c += dc;
  }
  return out;
}
/** The Kropki dot two digits would need: 2 black (one is double the other), 1 white (they differ by 1), 0 none. */
export const dotOf = (x, y) => (x === 2 * y || y === 2 * x ? 2 : Math.abs(x - y) === 1 ? 1 : 0);
const ALL = 0x3fe; // bits 1..9
/** The digits lo to hi as a bit mask. */
const range = (lo, hi) => (hi < lo ? 0 : ((1 << (hi + 1)) - 1) & ~((1 << lo) - 1));
const bits = (x) => {
  let n = 0;
  for (; x; x &= x - 1) n++;
  return n;
};
const rowOf = (i) => Math.floor(i / N);
const colOf = (i) => i % N;
const boxIndex = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
const orth = (i) => {
  const r = rowOf(i);
  const c = colOf(i);
  const out = [];
  if (r > 0) out.push(i - N);
  if (r < N - 1) out.push(i + N);
  if (c > 0) out.push(i - 1);
  if (c < N - 1) out.push(i + 1);
  return out;
};
const king = (i) => {
  const r = rowOf(i);
  const c = colOf(i);
  const out = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < N && cc >= 0 && cc < N) out.push(rr * N + cc);
    }
  return out;
};

/** Digits that can appear in some set of `size` different digits adding up to `sum` (for killer cages). */
const comboCache = new Map();
function comboDigits(size, sum) {
  const key = `${size}:${sum}`;
  if (comboCache.has(key)) return comboCache.get(key);
  let mask = 0;
  const walk = (from, left, remaining, used) => {
    if (left === 0) {
      if (remaining === 0) mask |= used;
      return;
    }
    for (let d = from; d <= 9; d++) {
      if (d > remaining) break;
      walk(d + 1, left - 1, remaining - d, used | (1 << d));
    }
  };
  walk(1, size, sum, 0);
  comboCache.set(key, mask);
  return mask;
}

/** Everything the solver needs to know about a puzzle: which cells see each other, the starting options of each cell, and a check. */
export function modelOf(puzzle) {
  const { rule } = puzzle;
  const region = Array.from({ length: 81 }, (_, i) => (rule === 'jigsaw' ? Number(puzzle.regions[i]) : boxIndex(i)));
  const peerSets = Array.from({ length: 81 }, () => new Set());
  for (let i = 0; i < 81; i++)
    for (let j = 0; j < 81; j++) if (i !== j && (rowOf(i) === rowOf(j) || colOf(i) === colOf(j) || region[i] === region[j])) peerSets[i].add(j);
  const dom = new Array(81).fill(ALL);
  const checks = Array.from({ length: 81 }, () => []);

  if (rule === 'even-odd') {
    for (let i = 0; i < 81; i++) {
      if (puzzle.parity[i] === 'e') dom[i] = 0x154; // 2 4 6 8
      else if (puzzle.parity[i] === 'o') dom[i] = 0x2aa; // 1 3 5 7 9
    }
  } else if (rule === 'consecutive') {
    const bar = new Set(puzzle.bars.map(([a, b]) => `${Math.min(a, b)}:${Math.max(a, b)}`));
    for (let i = 0; i < 81; i++) {
      const near = orth(i).map((j) => [j, bar.has(`${Math.min(i, j)}:${Math.max(i, j)}`)]);
      checks[i].push((cells) => {
        for (const [j, isBar] of near) if (cells[j]) if ((Math.abs(cells[i] - cells[j]) === 1) !== isBar) return false;
        return true;
      });
    }
  } else if (rule === 'little') {
    for (const [sum, start, dr, dc] of puzzle.littles) {
      const line = rayCells(start, dr, dc);
      for (const a of line) {
        checks[a].push((cells) => {
          let s = 0;
          let open = 0;
          for (const c of line) (cells[c] ? (s += cells[c]) : open++);
          return open === 0 ? s === sum : s + open <= sum && s + 9 * open >= sum;
        });
      }
    }
  } else if (rule === 'kropki') {
    const dot = new Map(puzzle.dots.map(([a, b, t]) => [`${Math.min(a, b)}:${Math.max(a, b)}`, t]));
    for (let i = 0; i < 81; i++) {
      const near = orth(i).map((j) => [j, dot.get(`${Math.min(i, j)}:${Math.max(i, j)}`) ?? 0]);
      checks[i].push((cells) => {
        for (const [j, t] of near) if (cells[j]) if (dotOf(cells[i], cells[j]) !== t) return false;
        return true;
      });
    }
  } else if (rule === 'thermo') {
    for (const t of puzzle.thermos) {
      t.forEach((cell, p) => {
        dom[cell] &= range(p + 1, 9 - (t.length - 1 - p)); // digits p+1 .. 9-(L-1-p)
        checks[cell].push((cells) => {
          for (let q = 0; q < t.length; q++) {
            if (q === p || !cells[t[q]]) continue;
            if (q < p ? cells[cell] - cells[t[q]] < p - q : cells[t[q]] - cells[cell] < q - p) return false;
          }
          return true;
        });
      });
    }
  } else if (rule === 'renban') {
    for (const line of puzzle.lines) {
      const L = line.length;
      for (const a of line) {
        for (const b of line) if (a !== b) peerSets[a].add(b);
        checks[a].push((cells) => {
          let lo = 10;
          let hi = 0;
          for (const c of line) {
            if (!cells[c]) continue;
            lo = Math.min(lo, cells[c]);
            hi = Math.max(hi, cells[c]);
          }
          return hi - lo < L;
        });
      }
    }
  } else if (rule === 'killer') {
    for (const [sum, ...cs] of puzzle.cages) {
      const mask = comboDigits(cs.length, sum);
      for (const a of cs) {
        dom[a] &= mask;
        for (const b of cs) if (a !== b) peerSets[a].add(b);
        checks[a].push((cells) => {
          let s = 0;
          let used = 0;
          let open = 0;
          for (const c of cs) {
            if (cells[c]) {
              s += cells[c];
              used |= 1 << cells[c];
            } else open++;
          }
          const need = sum - s;
          if (open === 0) return need === 0;
          if (need < open) return false;
          let lo = 0;
          let hi = 0;
          let k = 0;
          for (let d = 1; d <= 9 && k < open; d++) if (!(used & (1 << d))) (lo += d), k++;
          k = 0;
          for (let d = 9; d >= 1 && k < open; d--) if (!(used & (1 << d))) (hi += d), k++;
          return need >= lo && need <= hi;
        });
      }
    }
  } else if (rule === 'arrow') {
    for (const [circle, ...path] of puzzle.arrows) {
      dom[circle] &= range(Math.max(2, path.length), 9); // the circle holds at least the number of arrow cells
      for (const c of path) dom[c] &= range(1, 10 - path.length); // each arrow cell is at most 9 minus the others (each at least 1)
      const cellsOf = [circle, ...path];
      for (const a of cellsOf) {
        checks[a].push((cells) => {
          let s = 0;
          let open = 0;
          for (const c of path) (cells[c] ? (s += cells[c]) : open++);
          if (cells[circle]) {
            const v = cells[circle];
            return open === 0 ? s === v : s + open <= v && s + 9 * open >= v;
          }
          return s + open <= 9;
        });
      }
    }
  } else if (rule === 'sandwich') {
    for (let i = 0; i < 81; i++) {
      for (const [line, clue] of [[Array.from({ length: N }, (_, k) => rowOf(i) * N + k), puzzle.rows[rowOf(i)]], [Array.from({ length: N }, (_, k) => k * N + colOf(i)), puzzle.cols[colOf(i)]]]) {
        checks[i].push((cells) => {
          const one = line.findIndex((c) => cells[c] === 1);
          const nine = line.findIndex((c) => cells[c] === 9);
          if (one < 0 || nine < 0) return true;
          const [a, b] = one < nine ? [one, nine] : [nine, one];
          let s = 0;
          let open = 0;
          for (let k = a + 1; k < b; k++) (cells[line[k]] ? (s += cells[line[k]]) : open++);
          return open === 0 ? s === clue : s <= clue && s + 9 * open >= clue;
        });
      }
    }
  }
  const peers = peerSets.map((s) => [...s]);
  const check = (cells, i) => {
    for (const f of checks[i]) if (!f(cells)) return false;
    return true;
  };
  return { region, peers, dom, check };
}

/** Counts solutions (up to `limit`). `budget` caps the search (a puzzle that cannot be settled within it counts as not unique). */
export function solveKind(puzzle, limit = 2, order = [1, 2, 3, 4, 5, 6, 7, 8, 9], budget = 400000) {
  const m = modelOf(puzzle);
  const cells = [...puzzle.givens].map(Number);
  for (let i = 0; i < 81; i++) {
    const v = cells[i];
    if (!v) continue;
    if (!(m.dom[i] & (1 << v))) return { count: 0, solution: null };
    for (const j of m.peers[i]) if (cells[j] === v) return { count: 0, solution: null };
  }
  for (let i = 0; i < 81; i++) if (cells[i] && !m.check(cells, i)) return { count: 0, solution: null };
  let count = 0;
  let first = null;
  let nodes = 0;
  const dfs = () => {
    if (count >= limit || nodes > budget) return;
    nodes++;
    let best = -1;
    let bestMask = 0;
    let bestCount = 99;
    for (let i = 0; i < 81; i++) {
      if (cells[i]) continue;
      let used = 0;
      for (const j of m.peers[i]) if (cells[j]) used |= 1 << cells[j];
      const mask = m.dom[i] & ~used;
      const k = bits(mask);
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
    for (const v of order) {
      if (!(bestMask & (1 << v))) continue;
      cells[best] = v;
      if (m.check(cells, best)) dfs();
      cells[best] = 0;
      if (count >= limit || nodes > budget) return;
    }
  };
  dfs();
  // A search that ran out of budget did not finish: report it as more than one solution so such a puzzle is never kept.
  if (nodes > budget && count < limit) return { count: limit, solution: first };
  return { count, solution: first };
}

// ---------------------------------------------------------------- building the extras from a finished grid

/** Splits the grid into nine connected regions of nine cells by swapping cells between neighbouring regions, starting from the boxes. */
function makeRegions(rng) {
  const region = Array.from({ length: 81 }, (_, i) => boxIndex(i));
  const connected = (id, skip, extra) => {
    const cellsIn = [];
    for (let i = 0; i < 81; i++) if ((region[i] === id && i !== skip) || i === extra) cellsIn.push(i);
    const seen = new Set([cellsIn[0]]);
    const stack = [cellsIn[0]];
    while (stack.length) {
      const c = stack.pop();
      for (const n of orth(c)) if (!seen.has(n) && cellsIn.includes(n)) (seen.add(n), stack.push(n));
    }
    return seen.size === cellsIn.length;
  };
  for (let step = 0; step < 3000; step++) {
    // Region ra gives a cell to its neighbour rb, and takes one back from rb, so both keep nine cells.
    const a = rng.int(81);
    const near = orth(a).filter((n) => region[n] !== region[a]);
    if (!near.length) continue;
    const ra = region[a];
    const rb = region[rng.pick(near)];
    const back = [];
    for (let c = 0; c < 81; c++) if (region[c] === rb && c !== a && orth(c).some((n) => region[n] === ra && n !== a)) back.push(c);
    if (!back.length) continue;
    const c = rng.pick(back);
    region[a] = rb;
    region[c] = ra;
    if (!(connected(ra, -1, -1) && connected(rb, -1, -1))) {
      region[a] = ra;
      region[c] = rb;
    }
  }
  return region.join('');
}

function randomGrid(rng, base) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const givens = new Array(81).fill(0);
    rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).forEach((v, i) => (givens[i] = v));
    const out = solveKind({ ...base, givens: givens.join('') }, 1, rng.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]), 200000);
    if (out.count === 1 && out.solution) return out.solution.split('').map(Number);
  }
  return null;
}

function thermosFrom(sol, rng, want) {
  const used = new Set();
  const out = [];
  for (let attempt = 0; attempt < 400 && out.length < want; attempt++) {
    const start = rng.int(81);
    if (used.has(start)) continue;
    const path = [start];
    const len = 3 + rng.int(5); // 3 to 7 cells
    while (path.length < len) {
      const here = path[path.length - 1];
      const nexts = king(here).filter((n) => !used.has(n) && !path.includes(n) && sol[n] > sol[here]);
      if (!nexts.length) break;
      path.push(rng.pick(nexts));
    }
    if (path.length < 3) continue;
    path.forEach((c) => used.add(c));
    out.push(path);
  }
  return out;
}

/** Lines of side-by-side cells whose digits form a run of consecutive numbers (a purple Renban line). */
function renbanFrom(sol, rng, want) {
  const used = new Set();
  const out = [];
  for (let attempt = 0; attempt < 3000 && out.length < want; attempt++) {
    const start = rng.int(81);
    if (used.has(start)) continue;
    const path = [start];
    const len = 3 + rng.int(3); // 3 to 5 cells
    while (path.length < len) {
      const here = path[path.length - 1];
      const nexts = orth(here).filter((n) => !used.has(n) && !path.includes(n));
      if (!nexts.length) break;
      path.push(rng.pick(nexts));
    }
    if (path.length < 3) continue;
    const ds = path.map((c) => sol[c]);
    if (Math.max(...ds) - Math.min(...ds) !== path.length - 1 || new Set(ds).size !== path.length) continue;
    path.forEach((c) => used.add(c));
    out.push(path);
  }
  return out;
}

function cagesFrom(sol, rng) {
  const caged = new Array(81).fill(false);
  const cages = [];
  for (const start of rng.shuffle([...Array(81).keys()])) {
    if (caged[start]) continue;
    const size = rng.pick([1, 2, 2, 2, 3, 3, 3, 4, 4]);
    const cs = [start];
    caged[start] = true;
    while (cs.length < size) {
      const near = [...new Set(cs.flatMap(orth))].filter((n) => !caged[n] && !cs.some((c) => sol[c] === sol[n]));
      if (!near.length) break;
      const pickN = rng.pick(near);
      cs.push(pickN);
      caged[pickN] = true;
    }
    cages.push([cs.reduce((s, c) => s + sol[c], 0), ...cs.sort((a, b) => a - b)]);
  }
  return cages;
}

function arrowsFrom(sol, rng, want) {
  const used = new Set();
  const out = [];
  for (let attempt = 0; attempt < 600 && out.length < want; attempt++) {
    const circle = rng.int(81);
    if (used.has(circle) || sol[circle] < 3) continue;
    const path = [];
    let here = circle;
    let sum = 0;
    const target = sol[circle];
    while (sum < target) {
      const nexts = king(here).filter((n) => !used.has(n) && n !== circle && !path.includes(n) && sum + sol[n] <= target);
      if (!nexts.length) break;
      here = rng.pick(nexts);
      path.push(here);
      sum += sol[here];
    }
    if (sum !== target || path.length < 2 || path.length > 4) continue;
    [circle, ...path].forEach((c) => used.add(c));
    out.push([circle, ...path]);
  }
  return out;
}

function sandwichFrom(sol) {
  const sums = (line) => {
    const a = line.indexOf(1);
    const b = line.indexOf(9);
    const [lo, hi] = a < b ? [a, b] : [b, a];
    return line.slice(lo + 1, hi).reduce((s, v) => s + v, 0);
  };
  const rows = Array.from({ length: N }, (_, r) => sums(sol.slice(r * N, r * N + N)));
  const cols = Array.from({ length: N }, (_, c) => sums(Array.from({ length: N }, (_, r) => sol[r * N + c])));
  return { rows, cols };
}

/** How many numbers to leave in the grid for each kind, easiest (h = 0) to hardest (h = 1). */
const CLUES = {
  'even-odd': [30, 16],
  consecutive: [16, 3],
  thermo: [20, 6],
  killer: [12, 0],
  jigsaw: [36, 24],
  arrow: [22, 8],
  sandwich: [26, 14],
  renban: [24, 10],
  kropki: [18, 4],
  little: [24, 8],
};

/** A puzzle of a kind: build the extras from a finished grid, then take numbers away while the solution stays unique. */
export function generateKind(rng, rule, h) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const base = { rule };
    if (rule === 'jigsaw') base.regions = makeRegions(rng);
    // The finished grid only has to obey the plain rules (and the regions, for jigsaw): the extras are read off it afterwards.
    const sol = randomGrid(rng, rule === 'jigsaw' ? base : { rule: 'classic' });
    if (!sol) continue;
    let extras;
    switch (rule) {
      case 'even-odd': {
        const chars = new Array(81).fill('.');
        const count = Math.round(34 + 10 * h);
        for (const i of rng.shuffle([...Array(81).keys()]).slice(0, count)) chars[i] = sol[i] % 2 === 0 ? 'e' : 'o';
        extras = { parity: chars.join('') };
        break;
      }
      case 'consecutive': {
        const bars = [];
        for (let i = 0; i < 81; i++) {
          if (colOf(i) < N - 1 && Math.abs(sol[i] - sol[i + 1]) === 1) bars.push([i, i + 1]);
          if (rowOf(i) < N - 1 && Math.abs(sol[i] - sol[i + N]) === 1) bars.push([i, i + N]);
        }
        extras = { bars };
        break;
      }
      case 'little': {
        // Every diagonal that starts on the edge and has at least two cells; keep a random handful.
        const rays = [];
        for (let i = 0; i < 81; i++) {
          for (const [dr, dc] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
            const r0 = rowOf(i) - dr;
            const c0 = colOf(i) - dc;
            if (r0 >= 0 && r0 < N && c0 >= 0 && c0 < N) continue; // not the edge end of its diagonal
            const line = rayCells(i, dr, dc);
            if (line.length >= 2) rays.push([line.reduce((s, c) => s + sol[c], 0), i, dr, dc]);
          }
        }
        extras = { littles: rng.shuffle(rays).slice(0, 14 + rng.int(4)) };
        break;
      }
      case 'kropki': {
        const dots = [];
        for (let i = 0; i < 81; i++) {
          for (const j of [colOf(i) < N - 1 ? i + 1 : -1, rowOf(i) < N - 1 ? i + N : -1]) {
            const t = j >= 0 ? dotOf(sol[i], sol[j]) : 0;
            if (t) dots.push([i, j, t]);
          }
        }
        extras = { dots };
        break;
      }
      case 'thermo':
        extras = { thermos: thermosFrom(sol, rng, 9 + rng.int(3)) };
        break;
      case 'renban':
        extras = { lines: renbanFrom(sol, rng, 8 + rng.int(3)) };
        break;
      case 'killer':
        extras = { cages: cagesFrom(sol, rng) };
        break;
      case 'jigsaw':
        extras = { regions: base.regions };
        break;
      case 'arrow':
        extras = { arrows: arrowsFrom(sol, rng, 10 + rng.int(3)) };
        break;
      case 'sandwich':
        extras = sandwichFrom(sol);
        break;
      default:
        throw new Error(`Unknown kind ${rule}`);
    }
    const [from, to] = CLUES[rule];
    const target = Math.round(from - (from - to) * h);
    const cells = [...sol];
    let remaining = 81;
    const probe = (g) => solveKind({ givens: g.join(''), rule, ...extras }, 2, [1, 2, 3, 4, 5, 6, 7, 8, 9], 60000);
    // The extras alone may not pin the grid down: check the full grid first, then remove numbers one at a time.
    for (const i of rng.shuffle([...Array(81).keys()])) {
      if (remaining <= target) break;
      const saved = cells[i];
      cells[i] = 0;
      if (probe(cells).count === 1) remaining--;
      else cells[i] = saved;
    }
    const puzzle = { givens: cells.join(''), rule, ...extras };
    if (solveKind(puzzle, 2, [1, 2, 3, 4, 5, 6, 7, 8, 9], 400000).count === 1) return puzzle;
  }
  throw new Error(`Could not build a ${rule} puzzle`);
}

/** The reference check of a finished grid against a puzzle of a kind (the app and the API do the same). */
export function verifyKind(puzzle, solution) {
  if (typeof solution !== 'string' || solution.length !== 81 || ![...solution].every((c) => c >= '1' && c <= '9')) return false;
  for (let i = 0; i < 81; i++) if (puzzle.givens[i] !== '0' && puzzle.givens[i] !== solution[i]) return false;
  const cells = [...solution].map(Number);
  const unique = (list) => new Set(list.map((i) => cells[i])).size === list.length;
  const regionCells = Array.from({ length: 9 }, () => []);
  for (let i = 0; i < 81; i++) regionCells[puzzle.rule === 'jigsaw' ? Number(puzzle.regions[i]) : boxIndex(i)].push(i);
  for (let k = 0; k < 9; k++) {
    if (!unique(Array.from({ length: 9 }, (_, j) => k * 9 + j))) return false;
    if (!unique(Array.from({ length: 9 }, (_, j) => j * 9 + k))) return false;
    if (regionCells[k].length !== 9 || !unique(regionCells[k])) return false;
  }
  switch (puzzle.rule) {
    case 'even-odd':
      return cells.every((v, i) => puzzle.parity[i] === '.' || (puzzle.parity[i] === 'e') === (v % 2 === 0));
    case 'consecutive': {
      const bar = new Set(puzzle.bars.map(([a, b]) => `${Math.min(a, b)}:${Math.max(a, b)}`));
      for (let i = 0; i < 81; i++) for (const j of [colOf(i) < 8 ? i + 1 : -1, rowOf(i) < 8 ? i + 9 : -1]) if (j >= 0 && (Math.abs(cells[i] - cells[j]) === 1) !== bar.has(`${i}:${j}`)) return false;
      return true;
    }
    case 'little':
      return puzzle.littles.every(([sum, start, dr, dc]) => rayCells(start, dr, dc).reduce((s, c) => s + cells[c], 0) === sum);
    case 'kropki': {
      const dot = new Map(puzzle.dots.map(([a, b, t]) => [`${Math.min(a, b)}:${Math.max(a, b)}`, t]));
      for (let i = 0; i < 81; i++) for (const j of [colOf(i) < 8 ? i + 1 : -1, rowOf(i) < 8 ? i + 9 : -1]) if (j >= 0 && dotOf(cells[i], cells[j]) !== (dot.get(`${i}:${j}`) ?? 0)) return false;
      return true;
    }
    case 'thermo':
      return puzzle.thermos.every((t) => t.every((c, p) => p === 0 || cells[c] > cells[t[p - 1]]));
    case 'renban':
      return puzzle.lines.every((t) => new Set(t.map((c) => cells[c])).size === t.length && Math.max(...t.map((c) => cells[c])) - Math.min(...t.map((c) => cells[c])) === t.length - 1);
    case 'killer':
      return puzzle.cages.every(([sum, ...cs]) => unique(cs) && cs.reduce((s, c) => s + cells[c], 0) === sum);
    case 'jigsaw':
      return true;
    case 'arrow':
      return puzzle.arrows.every(([circle, ...path]) => path.reduce((s, c) => s + cells[c], 0) === cells[circle]);
    case 'sandwich': {
      const sums = (line) => {
        const a = line.indexOf(1);
        const b = line.indexOf(9);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        return line.slice(lo + 1, hi).reduce((s, v) => s + v, 0);
      };
      for (let k = 0; k < 9; k++) {
        if (sums(cells.slice(k * 9, k * 9 + 9)) !== puzzle.rows[k]) return false;
        if (sums(Array.from({ length: 9 }, (_, r) => cells[r * 9 + k])) !== puzzle.cols[k]) return false;
      }
      return true;
    }
    default:
      return false;
  }
}
