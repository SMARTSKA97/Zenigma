import { WendWords } from './wend-words';

export const COLS = 6;
export const ROWS = 3;
export const CELLS = COLS * ROWS;
/** The four words every board hides: 3, 4, 5 and 6 letters, which together fill all 18 cells. */
export const LENGTHS = [3, 4, 5, 6];

/** Cells that share an edge with cell `i` (up, down, left, right: not diagonals). */
export function neighboursOf(i: number): number[] {
  const r = Math.floor(i / COLS);
  const c = i % COLS;
  const out: number[] = [];
  if (r > 0) out.push(i - COLS);
  if (r < ROWS - 1) out.push(i + COLS);
  if (c > 0) out.push(i - 1);
  if (c < COLS - 1) out.push(i + 1);
  return out;
}

export const adjacent = (a: number, b: number): boolean => neighboursOf(a).includes(b);

export function shuffle<T>(list: readonly T[], random: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random self-avoiding walks of `length` cells that start at `start` and only use free cells (at most `limit` of them). */
function walks(start: number, length: number, used: boolean[], random: () => number, limit = 30): number[][] {
  const out: number[][] = [];
  const path = [start];
  const mark = used.slice();
  mark[start] = true;
  const go = (): void => {
    if (out.length >= limit) return;
    if (path.length === length) {
      out.push([...path]);
      return;
    }
    for (const n of shuffle(neighboursOf(path[path.length - 1]), random)) {
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

const isStraight = (path: number[]): boolean => path.every((p, k) => k < 2 || path[k] - path[k - 1] === path[k - 1] - path[k - 2]);

/** Cuts the grid into four paths (of 3, 4, 5 and 6 cells), each a chain of touching cells. Null if this try finds no way. */
function layout(random: () => number): number[][] | null {
  const used = new Array<boolean>(CELLS).fill(false);
  const paths: number[][] = [];
  const remaining = [...LENGTHS];
  const fill = (): boolean => {
    const start = used.indexOf(false);
    if (start < 0) return remaining.length === 0;
    for (const length of shuffle([...remaining], random)) {
      const at = remaining.indexOf(length);
      remaining.splice(at, 1);
      for (const w of walks(start, length, used, random)) {
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

export interface Board {
  /** The letter in each of the 18 cells. */
  letters: string[];
  /** The words the board was made from, and the cells that spell each one (other solutions may exist). */
  words: string[];
  paths: number[][];
}

/** A new board: four everyday words laid along four paths that fill the grid. */
export function makeBoard(words: WendWords, random: () => number = Math.random): Board {
  for (let attempt = 0; attempt < 500; attempt++) {
    const paths = layout(random);
    if (!paths || paths.filter(isStraight).length > 1) continue;
    const chosen = new Set<string>();
    const list = paths.map((p) => {
      const pool = words.common[p.length];
      let w = pool[Math.floor(random() * pool.length)];
      while (chosen.has(w)) w = pool[Math.floor(random() * pool.length)];
      chosen.add(w);
      return w;
    });
    const letters = new Array<string>(CELLS).fill('');
    paths.forEach((p, k) => p.forEach((cell, i) => (letters[cell] = list[k][i])));
    return { letters, words: list, paths };
  }
  throw new Error('No Wend board could be made');
}

export interface Trace {
  word: string;
  path: number[];
  mask: number;
}

/** Every real word (3 to 6 letters) that can be traced through touching cells of `free`. */
export function findWords(letters: readonly string[], free: readonly boolean[], words: WendWords): Trace[] {
  const found: Trace[] = [];
  const seen = new Set<string>();
  const path: number[] = [];
  const mark = new Array<boolean>(CELLS).fill(false);
  const go = (word: string): void => {
    if (word.length >= 3 && words.valid.has(word)) {
      const key = path.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        found.push({ word, path: [...path], mask: path.reduce((m, c) => m | (1 << c), 0) });
      }
    }
    if (word.length === 6) return;
    for (const n of neighboursOf(path[path.length - 1])) {
      if (!free[n] || mark[n]) continue;
      const next = word + letters[n];
      if (!words.prefixes.has(next)) continue;
      mark[n] = true;
      path.push(n);
      go(next);
      path.pop();
      mark[n] = false;
    }
  };
  for (let c = 0; c < CELLS; c++) {
    if (!free[c] || !words.prefixes.has(letters[c])) continue;
    mark[c] = true;
    path.push(c);
    go(letters[c]);
    path.pop();
    mark[c] = false;
  }
  return found;
}

/** A way to use every free cell exactly once with real words, or null if the free cells cannot be used up. */
export function solve(letters: readonly string[], free: readonly boolean[], words: WendWords): Trace[] | null {
  const candidates = findWords(letters, free, words);
  const target = free.reduce((m, f, i) => (f ? m | (1 << i) : m), 0);
  const byCell = new Map<number, Trace[]>();
  for (const t of candidates) for (const c of t.path) (byCell.get(c) ?? byCell.set(c, []).get(c)!).push(t);
  const dead = new Set<number>();
  const pick = (left: number): Trace[] | null => {
    if (left === 0) return [];
    if (dead.has(left)) return null;
    const lowest = 31 - Math.clz32(left & -left);
    for (const t of byCell.get(lowest) ?? []) {
      if ((t.mask & ~left) !== 0) continue;
      const rest = pick(left & ~t.mask);
      if (rest) return [t, ...rest];
    }
    dead.add(left);
    return null;
  };
  return pick(target);
}
