import { WendWords } from './wend-words';

export const COLS = 5;
export const ROWS = 5;
/** Grey blocks no word can enter. 25 cells less these leave the 18 letters of the four words. */
export const WALLS = 7;
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
function layout(random: () => number, walls: readonly boolean[]): number[][] | null {
  const used = [...walls];
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
  /** The letter in each cell ('' for a wall). */
  letters: string[];
  /** Which cells are grey blocks. */
  walls: boolean[];
  /** The four words, shortest first, and the cells that spell each one. The board has no other way to use every letter. */
  words: string[];
  paths: number[][];
}

/** Whether the cells that are not walls form one connected area. */
function connected(walls: readonly boolean[]): boolean {
  const open = walls.map((w, i) => (w ? -1 : i)).filter((i) => i >= 0);
  const seen = new Set<number>([open[0]]);
  const stack = [open[0]];
  while (stack.length) {
    for (const n of neighboursOf(stack.pop()!)) if (!walls[n] && !seen.has(n)) (seen.add(n), stack.push(n));
  }
  return seen.size === open.length;
}

/**
 * A new board: seven grey blocks, and four everyday words laid along paths that fill every other cell. The board is only kept
 * when those four words are the one and only way to use every letter, as in LinkedIn's Wend.
 */
export function makeBoard(words: WendWords, random: () => number = Math.random): Board {
  for (let attempt = 0; attempt < 4000; attempt++) {
    const walls = new Array<boolean>(CELLS).fill(false);
    for (const c of shuffle(Array.from({ length: CELLS }, (_, i) => i), random).slice(0, WALLS)) walls[c] = true;
    if (!connected(walls)) continue;
    const paths = layout(random, walls);
    if (!paths) continue;
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
    const open = walls.map((w) => !w);
    if (countSolutions(letters, open, words, 2) !== 1) continue;
    const order = [0, 1, 2, 3].sort((a, b) => list[a].length - list[b].length);
    return { letters, walls, words: order.map((k) => list[k]), paths: order.map((k) => paths[k]) };
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
      const key = `${path.reduce((m, c) => m | (1 << c), 0)}:${word}`;
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

/** How many different ways the free cells can be used up by real words (counting stops at `limit`). */
export function countSolutions(letters: readonly string[], free: readonly boolean[], words: WendWords, limit = 2): number {
  const candidates = findWords(letters, free, words);
  const target = free.reduce((m, f, i) => (f ? m | (1 << i) : m), 0);
  const byCell = new Map<number, Trace[]>();
  for (const t of candidates) for (const c of t.path) (byCell.get(c) ?? byCell.set(c, []).get(c)!).push(t);
  const count = (left: number, usedLengths: number): number => {
    if (left === 0) return 1;
    const lowest = 31 - Math.clz32(left & -left);
    let n = 0;
    for (const t of byCell.get(lowest) ?? []) {
      if ((t.mask & ~left) !== 0) continue;
      const bit = 1 << (t.path.length - 3);
      if (usedLengths & bit) continue; // one word of each length: 3, 4, 5 and 6
      n += count(left & ~t.mask, usedLengths | bit);
      if (n >= limit) return n;
    }
    return n;
  };
  return count(target, 0);
}
