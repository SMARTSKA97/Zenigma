import { WendWords } from './wend-words';

/** A board's shape: the grid is `size` by `size`, and the words' lengths fill every cell that is not a grey block. */
export interface Spec {
  size: number;
  /** Shortest first. */
  lengths: number[];
}

/**
 * Like LinkedIn's Wend, the board grows through the week: a small 5 by 5 with four words on Monday, up to a 7 by 7 with six long
 * words (some of them 10 letters) on Sunday. Indexed by the day of the week, 0 for Sunday.
 */
export const WEEK: Spec[] = [
  { size: 7, lengths: [4, 5, 6, 8, 9, 10] }, // Sunday, 42 letters
  { size: 5, lengths: [3, 4, 5, 6] }, // Monday, 18
  { size: 6, lengths: [3, 5, 6, 7] }, // Tuesday, 21
  { size: 6, lengths: [4, 5, 7, 8] }, // Wednesday, 24
  { size: 7, lengths: [4, 6, 8, 10] }, // Thursday, 28
  { size: 7, lengths: [3, 5, 6, 7, 9] }, // Friday, 30
  { size: 7, lengths: [5, 6, 7, 9, 11] }, // Saturday, 38
];

/** The board of an India date like "2026-10-19". */
export function specForDate(date: string): Spec {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return WEEK[Number.isNaN(day) ? 1 : day];
}

/** Practice starts small and grows with every board solved: Monday's size, then Tuesday's, up to Sunday's. */
export const PRACTICE_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const practiceSpec = (boardsSolved: number): Spec => WEEK[PRACTICE_ORDER[Math.min(boardsSolved, PRACTICE_ORDER.length - 1)]];

export const cellsOf = (spec: Spec): number => spec.size * spec.size;
export const lettersOf = (spec: Spec): number => spec.lengths.reduce((a, b) => a + b, 0);

/** Cells that share an edge with cell `i` (up, down, left, right: not diagonals). */
export function neighboursOf(i: number, size: number): number[] {
  const r = Math.floor(i / size);
  const c = i % size;
  const out: number[] = [];
  if (r > 0) out.push(i - size);
  if (r < size - 1) out.push(i + size);
  if (c > 0) out.push(i - 1);
  if (c < size - 1) out.push(i + 1);
  return out;
}

export const adjacent = (a: number, b: number, size: number): boolean => neighboursOf(a, size).includes(b);

export function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isStraight = (path: number[]): boolean => path.every((p, k) => k < 2 || path[k] - path[k - 1] === path[k - 1] - path[k - 2]);

/** Random self-avoiding walks of `length` cells that start at `start` and only use free cells (at most `limit` of them). */
function walks(start: number, length: number, used: boolean[], size: number, random: () => number, limit = 24): number[][] {
  const out: number[][] = [];
  const path = [start];
  const mark = used.slice();
  mark[start] = true;
  let steps = 0;
  const go = (): void => {
    if (out.length >= limit || steps++ > 4000) return;
    if (path.length === length) {
      out.push([...path]);
      return;
    }
    for (const n of shuffle(neighboursOf(path[path.length - 1], size), random)) {
      if (mark[n]) continue;
      mark[n] = true;
      path.push(n);
      go();
      path.pop();
      mark[n] = false;
    }
  };
  go();
  return out;
}

/** Cuts the open cells into paths of the given lengths, each a chain of touching cells. Null if this try finds no way. */
function layout(spec: Spec, walls: readonly boolean[], random: () => number): number[][] | null {
  const used = [...walls];
  const paths: number[][] = [];
  const remaining = [...spec.lengths];
  let budget = 3000;
  const fill = (): boolean => {
    if (budget-- <= 0) return false;
    const start = used.indexOf(false);
    if (start < 0) return remaining.length === 0;
    for (const length of shuffle([...new Set(remaining)], random)) {
      const at = remaining.indexOf(length);
      remaining.splice(at, 1);
      for (const w of walks(start, length, used, spec.size, random)) {
        w.forEach((c) => (used[c] = true));
        paths.push(w);
        if (fill()) return true;
        paths.pop();
        w.forEach((c) => (used[c] = false));
      }
      remaining.splice(at, 0, length);
    }
    return false;
  };
  return fill() ? paths : null;
}

/** Whether the cells that are not walls form one connected area. */
function connected(walls: readonly boolean[], size: number): boolean {
  const open = walls.map((w, i) => (w ? -1 : i)).filter((i) => i >= 0);
  const seen = new Set<number>([open[0]]);
  const stack = [open[0]];
  while (stack.length) {
    for (const n of neighboursOf(stack.pop()!, size)) if (!walls[n] && !seen.has(n)) (seen.add(n), stack.push(n));
  }
  return seen.size === open.length;
}

export interface Board {
  size: number;
  /** The letter in each cell ('' for a wall). */
  letters: string[];
  /** Which cells are grey blocks. */
  walls: boolean[];
  /** The words, shortest first, and the cells that spell each one. The board has no other way to use every letter. */
  words: string[];
  paths: number[][];
}

/**
 * A new board for `spec`: grey blocks, and everyday words laid along paths that fill every other cell. The board is only kept
 * when those words are the one and only way to use every letter, as in LinkedIn's Wend.
 */
export function makeBoard(words: WendWords, random: () => number, spec: Spec): Board {
  const cells = cellsOf(spec);
  const wallCount = cells - lettersOf(spec);
  for (let attempt = 0; attempt < 6000; attempt++) {
    const walls = new Array<boolean>(cells).fill(false);
    for (const c of shuffle(Array.from({ length: cells }, (_, i) => i), random).slice(0, wallCount)) walls[c] = true;
    if (!connected(walls, spec.size)) continue;
    const paths = layout(spec, walls, random);
    if (!paths || paths.filter(isStraight).length > Math.ceil(paths.length / 3)) continue;
    const chosen = new Set<string>();
    const list = paths.map((p) => {
      const pool = words.common[p.length];
      let w = pool[Math.floor(random() * pool.length)];
      for (let tries = 0; chosen.has(w) && tries < 50; tries++) w = pool[Math.floor(random() * pool.length)];
      chosen.add(w);
      return w;
    });
    if (chosen.size !== list.length) continue;
    const letters = new Array<string>(cells).fill('');
    paths.forEach((p, k) => p.forEach((cell, i) => (letters[cell] = list[k][i])));
    if (countSolutions(letters, walls, words, spec, 2) !== 1) continue;
    const order = list.map((_, k) => k).sort((a, b) => list[a].length - list[b].length);
    return { size: spec.size, letters, walls, words: order.map((k) => list[k]), paths: order.map((k) => paths[k]) };
  }
  throw new Error('No Wend board could be made');
}

export interface Trace {
  word: string;
  path: number[];
}

/** Every word that can be traced through touching open cells (3 letters up to the longest in `maxLength`). */
export function findWords(letters: readonly string[], walls: readonly boolean[], size: number, words: WendWords, maxLength: number): Trace[] {
  const found: Trace[] = [];
  const seen = new Set<string>();
  const path: number[] = [];
  const mark = new Array<boolean>(letters.length).fill(false);
  const go = (word: string): void => {
    if (word.length >= 3 && words.valid.has(word)) {
      const key = `${[...path].sort((a, b) => a - b).join(',')}:${word}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ word, path: [...path] });
      }
    }
    if (word.length === maxLength) return;
    for (const n of neighboursOf(path[path.length - 1], size)) {
      if (walls[n] || mark[n]) continue;
      const next = word + letters[n];
      if (!words.prefixes.has(next)) continue;
      mark[n] = true;
      path.push(n);
      go(next);
      path.pop();
      mark[n] = false;
    }
  };
  for (let c = 0; c < letters.length; c++) {
    if (walls[c] || !words.prefixes.has(letters[c])) continue;
    mark[c] = true;
    path.push(c);
    go(letters[c]);
    path.pop();
    mark[c] = false;
  }
  return found;
}

/** How many different ways the open cells can be used up by words of exactly the board's lengths (counting stops at `limit`). */
export function countSolutions(letters: readonly string[], walls: readonly boolean[], words: WendWords, spec: Spec, limit = 2): number {
  const candidates = findWords(letters, walls, spec.size, words, Math.max(...spec.lengths)).filter((t) => spec.lengths.includes(t.path.length));
  const byCell = new Map<number, Trace[]>();
  for (const t of candidates) for (const c of t.path) (byCell.get(c) ?? byCell.set(c, []).get(c)!).push(t);
  const free = walls.map((w) => !w);
  const left = new Map<number, number>();
  for (const l of spec.lengths) left.set(l, (left.get(l) ?? 0) + 1);
  const count = (): number => {
    const lowest = free.indexOf(true);
    if (lowest < 0) return 1;
    let n = 0;
    for (const t of byCell.get(lowest) ?? []) {
      const need = left.get(t.path.length) ?? 0;
      if (need <= 0 || !t.path.every((c) => free[c])) continue;
      t.path.forEach((c) => (free[c] = false));
      left.set(t.path.length, need - 1);
      n += count();
      left.set(t.path.length, need);
      t.path.forEach((c) => (free[c] = true));
      if (n >= limit) return n;
    }
    return n;
  };
  return count();
}
