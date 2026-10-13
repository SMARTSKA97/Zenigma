/**
 * Sudoku kinds that carry extra data besides the givens (all on the classic 9x9 grid). The generator's sudoku-kinds.mjs
 * documents the formats; this is the player's side: who sees whom, what each cell may hold, and the checks.
 */

export type KindRule = 'even-odd' | 'consecutive' | 'thermo' | 'killer' | 'jigsaw' | 'arrow' | 'sandwich' | 'renban';
export const KIND_RULES: KindRule[] = ['even-odd', 'consecutive', 'thermo', 'killer', 'jigsaw', 'arrow', 'sandwich', 'renban'];
export const isKindRule = (rule: string | undefined): rule is KindRule => !!rule && (KIND_RULES as string[]).includes(rule);

/** The extra data of a kind (what comes with the givens). */
export interface KindData {
  rule?: string;
  parity?: string;
  bars?: [number, number][];
  thermos?: number[][];
  lines?: number[][];
  cages?: number[][];
  regions?: string;
  arrows?: number[][];
  rows?: number[];
  cols?: number[];
}

const N = 9;
const ALL = 0x3fe;
const range = (lo: number, hi: number): number => (hi < lo ? 0 : ((1 << (hi + 1)) - 1) & ~((1 << lo) - 1));
const rowOf = (i: number) => Math.floor(i / N);
const colOf = (i: number) => i % N;
const boxIndex = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
const orth = (i: number): number[] => {
  const out: number[] = [];
  if (rowOf(i) > 0) out.push(i - N);
  if (rowOf(i) < N - 1) out.push(i + N);
  if (colOf(i) > 0) out.push(i - 1);
  if (colOf(i) < N - 1) out.push(i + 1);
  return out;
};

const comboCache = new Map<string, number>();
/** Digits that can appear in some set of `size` different digits adding up to `sum`. */
function comboDigits(size: number, sum: number): number {
  const key = `${size}:${sum}`;
  const hit = comboCache.get(key);
  if (hit !== undefined) return hit;
  let mask = 0;
  const walk = (from: number, left: number, remaining: number, used: number): void => {
    if (left === 0) {
      if (remaining === 0) mask |= used;
      return;
    }
    for (let d = from; d <= 9 && d <= remaining; d++) walk(d + 1, left - 1, remaining - d, used | (1 << d));
  };
  walk(1, size, sum, 0);
  comboCache.set(key, mask);
  return mask;
}

type Cells = ArrayLike<number>;
export interface KindModel {
  region: number[];
  peers: number[][];
  /** Starting options of every cell, as a bit mask over 1..9. */
  dom: number[];
  /** False when the digit in cell i breaks one of the kind's own rules (given what else is filled). */
  check: (cells: Cells, i: number) => boolean;
}

const models = new WeakMap<object, KindModel>();

export function modelOf(puzzle: KindData): KindModel {
  const cached = models.get(puzzle);
  if (cached) return cached;
  const rule = puzzle.rule;
  const region = Array.from({ length: 81 }, (_, i) => (rule === 'jigsaw' ? Number(puzzle.regions![i]) : boxIndex(i)));
  const peerSets = Array.from({ length: 81 }, () => new Set<number>());
  for (let i = 0; i < 81; i++) for (let j = 0; j < 81; j++) if (i !== j && (rowOf(i) === rowOf(j) || colOf(i) === colOf(j) || region[i] === region[j])) peerSets[i].add(j);
  const dom = new Array<number>(81).fill(ALL);
  const checks: ((cells: Cells) => boolean)[][] = Array.from({ length: 81 }, () => []);

  if (rule === 'even-odd') {
    for (let i = 0; i < 81; i++) {
      if (puzzle.parity![i] === 'e') dom[i] = 0x154;
      else if (puzzle.parity![i] === 'o') dom[i] = 0x2aa;
    }
  } else if (rule === 'consecutive') {
    const bar = new Set(puzzle.bars!.map(([a, b]) => `${Math.min(a, b)}:${Math.max(a, b)}`));
    for (let i = 0; i < 81; i++) {
      const near = orth(i).map((j) => [j, bar.has(`${Math.min(i, j)}:${Math.max(i, j)}`)] as const);
      checks[i].push((cells) => {
        for (const [j, isBar] of near) if (cells[j] && (Math.abs(cells[i] - cells[j]) === 1) !== isBar) return false;
        return true;
      });
    }
  } else if (rule === 'thermo') {
    for (const t of puzzle.thermos!) {
      t.forEach((cell, p) => {
        dom[cell] &= range(p + 1, 9 - (t.length - 1 - p));
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
    for (const line of puzzle.lines!) {
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
    for (const [sum, ...cs] of puzzle.cages!) {
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
    for (const [circle, ...path] of puzzle.arrows!) {
      dom[circle] &= range(Math.max(2, path.length), 9);
      for (const c of path) dom[c] &= range(1, 10 - path.length);
      for (const a of [circle, ...path]) {
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
      const lines: [number[], number][] = [
        [Array.from({ length: N }, (_, k) => rowOf(i) * N + k), puzzle.rows![rowOf(i)]],
        [Array.from({ length: N }, (_, k) => k * N + colOf(i)), puzzle.cols![colOf(i)]],
      ];
      for (const [line, clue] of lines) {
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
  const model: KindModel = {
    region,
    peers: peerSets.map((s) => [...s]),
    dom,
    check: (cells, i) => checks[i].every((f) => f(cells)),
  };
  models.set(puzzle, model);
  return model;
}

/** Digits cell i may still hold: its starting options minus what its peers hold, and none that break the kind's own rule. */
export function kindCandidates(puzzle: KindData, cells: number[], i: number): number[] {
  const m = modelOf(puzzle);
  const out: number[] = [];
  const used = new Set(m.peers[i].map((j) => cells[j]));
  const keep = cells[i];
  for (let d = 1; d <= 9; d++) {
    if (!(m.dom[i] & (1 << d)) || used.has(d)) continue;
    cells[i] = d;
    if (m.check(cells, i)) out.push(d);
  }
  cells[i] = keep;
  return out;
}

/** The solution (kinds from the generator have exactly one), or null. */
export function solveKind(puzzle: KindData & { givens: string }, budget = 600000): string | null {
  const m = modelOf(puzzle);
  const cells = [...puzzle.givens].map(Number);
  let nodes = 0;
  const bitCount = (x: number) => {
    let n = 0;
    for (; x; x &= x - 1) n++;
    return n;
  };
  const dfs = (): boolean => {
    if (++nodes > budget) return false;
    let best = -1;
    let bestMask = 0;
    let bestCount = 99;
    for (let i = 0; i < 81; i++) {
      if (cells[i]) continue;
      let used = 0;
      for (const j of m.peers[i]) if (cells[j]) used |= 1 << cells[j];
      const mask = m.dom[i] & ~used;
      const k = bitCount(mask);
      if (k < bestCount) {
        best = i;
        bestMask = mask;
        bestCount = k;
        if (k <= 1) break;
      }
    }
    if (best === -1) return true;
    if (bestCount === 0) return false;
    for (let v = 1; v <= 9; v++) {
      if (!(bestMask & (1 << v))) continue;
      cells[best] = v;
      if (m.check(cells, best) && dfs()) return true;
      cells[best] = 0;
    }
    return false;
  };
  for (let i = 0; i < 81; i++) if (cells[i] && !m.check(cells, i)) return null;
  return dfs() ? cells.join('') : null;
}
