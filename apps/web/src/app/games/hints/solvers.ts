/**
 * Small solvers used only to coach the player: every level has exactly one solution, so the solution tells
 * whether something on the board is wrong. They are never used to hand over an answer.
 */
import { boxShape, peersOf, Rules, sizeOf } from '../sudoku/engine';
import { isKindRule, kindCandidates, KindData, solveKind } from '../sudoku/kinds';
import { TangoPuzzle, SIZE as TANGO } from '../tango/engine';
import { QueensPuzzle } from '../queens/engine';
import { ZipPuzzle } from '../zip/engine';
import { PatchesPuzzle, Rect } from '../patches/engine';

export function solveQueens(puzzle: QueensPuzzle): number[] | null {
  const n = puzzle.size;
  const cols = new Array<number>(n).fill(-1);
  const usedCol = new Array<boolean>(n).fill(false);
  const usedRegion = new Array<boolean>(n + 1).fill(false);
  const must = new Set(puzzle.givens ?? []);
  const place = (row: number): boolean => {
    if (row === n) return true;
    for (let c = 0; c < n; c++) {
      if (usedCol[c]) continue;
      const region = puzzle.regions[row * n + c];
      if (usedRegion[region]) continue;
      if (row > 0 && Math.abs(cols[row - 1] - c) < 2) continue;
      // A given queen in this row has to be the one used.
      const given = [...must].find((g) => Math.floor(g / n) === row);
      if (given !== undefined && given !== row * n + c) continue;
      cols[row] = c;
      usedCol[c] = usedRegion[region] = true;
      if (place(row + 1)) return true;
      usedCol[c] = usedRegion[region] = false;
      cols[row] = -1;
    }
    return false;
  };
  return place(0) ? cols : null;
}

export function solveTango(puzzle: TangoPuzzle): string | null {
  const N = TANGO;
  const cells: (string | null)[] = [...puzzle.givens].map((ch) => (ch === '.' ? null : ch));
  const links: [number, '=' | 'x'][][] = Array.from({ length: N * N }, () => []);
  for (const [a, b, kind] of puzzle.edges) {
    links[a].push([b, kind]);
    links[b].push([a, kind]);
  }
  const ok = (i: number): boolean => {
    const r = Math.floor(i / N);
    const c = i % N;
    const v = cells[i];
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      for (let k = -2; k <= 0; k++) {
        const vals: (string | null)[] = [];
        for (let t = 0; t < 3; t++) {
          const rr = r + dr * (k + t);
          const cc = c + dc * (k + t);
          if (rr < 0 || rr >= N || cc < 0 || cc >= N) break;
          vals.push(cells[rr * N + cc]);
        }
        if (vals.length === 3 && vals.every((x) => x === v)) return false;
      }
    }
    let rowCount = 0;
    let colCount = 0;
    for (let k = 0; k < N; k++) {
      if (cells[r * N + k] === v) rowCount++;
      if (cells[k * N + c] === v) colCount++;
    }
    if (rowCount > N / 2 || colCount > N / 2) return false;
    for (const [j, kind] of links[i]) {
      const other = cells[j];
      if (other === null) continue;
      if (kind === '=' ? other !== v : other === v) return false;
    }
    return true;
  };
  const place = (i: number): boolean => {
    if (i === N * N) return true;
    if (cells[i] !== null) return ok(i) && place(i + 1);
    for (const v of ['s', 'm']) {
      cells[i] = v;
      if (ok(i) && place(i + 1)) return true;
      cells[i] = null;
    }
    return false;
  };
  return place(0) ? cells.join('') : null;
}

/** Digits that can still go in an empty cell, as a list. */
export function sudokuCandidates(board: number[], i: number, rules?: Rules): number[] {
  const n = sizeOf(board.length);
  if (rules && typeof rules === 'object' && isKindRule(rules.rule)) return kindCandidates(rules as KindData, board, i);
  const taken = new Set(peersOf(i, n, rules).map((j) => board[j]));
  const out: number[] = [];
  if (rules === 'nonconsec' || (rules && typeof rules === 'object' && rules.rule === 'nonconsec')) {
    const r = Math.floor(i / n);
    const c = i % n;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const rr = r + dr;
      const cc = c + dc;
      const v = rr >= 0 && rr < n && cc >= 0 && cc < n ? board[rr * n + cc] : 0;
      if (v) {
        taken.add(v - 1);
        taken.add(v + 1);
      }
    }
  }
  for (let d = 1; d <= n; d++) if (!taken.has(d)) out.push(d);
  return out;
}

export function solveSudoku(givens: number[], rules?: Rules): string | null {
  if (rules && typeof rules === 'object' && isKindRule(rules.rule)) return solveKind({ ...(rules as KindData), givens: givens.join('') });
  const board = [...givens];
  const search = (): boolean => {
    let best = -1;
    let options: number[] = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i]) continue;
      const cand = sudokuCandidates(board, i, rules);
      if (cand.length === 0) return false;
      if (best < 0 || cand.length < options.length) {
        best = i;
        options = cand;
        if (cand.length === 1) break;
      }
    }
    if (best < 0) return true;
    for (const d of options) {
      board[best] = d;
      if (search()) return true;
    }
    board[best] = 0;
    return false;
  };
  boxShape(sizeOf(board.length));
  return search() ? board.join('') : null;
}

export function solveZip(puzzle: ZipPuzzle): number[] | null {
  const n = puzzle.size;
  const total = n * n - (puzzle.holes?.length ?? 0);
  const top = Math.max(...puzzle.numbers);
  const start = puzzle.numbers.indexOf(1);
  const nbrs = Array.from({ length: n * n }, (_, i) => {
    const r = Math.floor(i / n);
    const c = i % n;
    const out: number[] = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    if (puzzle.holes?.includes(i)) return [];
    return out.filter((v) => !puzzle.holes?.includes(v) && !puzzle.walls?.some(([x, y]) => (x === i && y === v) || (x === v && y === i)));
  });
  const seen = new Array<boolean>(n * n).fill(false);
  const path: number[] = [];
  const stranded = (at: number): boolean => {
    for (const v of nbrs[at]) {
      if (seen[v]) continue;
      let free = 0;
      for (const w of nbrs[v]) if (!seen[w] || w === at) free++;
      if (free < 2 && puzzle.numbers[v] !== top) return true;
    }
    return false;
  };
  const walk = (at: number, next: number): boolean => {
    if (path.length === total) return next > top;
    for (const v of nbrs[at]) {
      if (seen[v]) continue;
      const num = puzzle.numbers[v];
      if (num !== 0 && num !== next) continue;
      if (num === top && path.length + 1 !== total) continue;
      seen[v] = true;
      path.push(v);
      if (!stranded(v) && walk(v, num === next ? next + 1 : next)) return true;
      path.pop();
      seen[v] = false;
    }
    return false;
  };
  seen[start] = true;
  path.push(start);
  return walk(start, 2) ? path : null;
}

/** Every rectangle that could hold clue k on its own (right area and shape, only that clue inside, inside the grid). */
export function patchOptions(puzzle: PatchesPuzzle, k: number): Rect[] {
  const n = puzzle.size;
  const [cell, area, shape] = puzzle.clues[k];
  const clueAt = new Map(puzzle.clues.map(([c], idx) => [c, idx]));
  const out: Rect[] = [];
  const r = Math.floor(cell / n);
  const c = cell % n;
  const sizes: [number, number][] = [];
  for (let h = 1; h <= n; h++) {
    // A hidden number (area 0) could be any width.
    for (let w = 1; w <= n; w++) if (area === 0 || h * w === area) sizes.push([h, w]);
  }
  for (const [h, w] of sizes) {
    if (shape === 1 && !(w > h)) continue;
    if (shape === 2 && !(h > w)) continue;
    if (shape === 3 && w !== h) continue;
    for (let r0 = Math.max(0, r - h + 1); r0 <= Math.min(r, n - h); r0++) {
      for (let c0 = Math.max(0, c - w + 1); c0 <= Math.min(c, n - w); c0++) {
        let clean = true;
        for (let rr = r0; rr < r0 + h && clean; rr++) {
          for (let cc = c0; cc < c0 + w; cc++) {
            const other = clueAt.get(rr * n + cc);
            if (other !== undefined && other !== k) {
              clean = false;
              break;
            }
          }
        }
        if (clean) out.push([r0, c0, r0 + h - 1, c0 + w - 1]);
      }
    }
  }
  return out;
}

export function solvePatches(puzzle: PatchesPuzzle): Rect[] | null {
  const n = puzzle.size;
  const options = puzzle.clues.map((_, k) => patchOptions(puzzle, k));
  const covered = new Array<boolean>(n * n).fill(false);
  const chosen: Rect[] = [];
  const free = (r: Rect) => {
    for (let rr = r[0]; rr <= r[2]; rr++) for (let cc = r[1]; cc <= r[3]; cc++) if (covered[rr * n + cc]) return false;
    return true;
  };
  const mark = (r: Rect, on: boolean) => {
    for (let rr = r[0]; rr <= r[2]; rr++) for (let cc = r[1]; cc <= r[3]; cc++) covered[rr * n + cc] = on;
  };
  const walk = (k: number): boolean => {
    if (k === puzzle.clues.length) return covered.every(Boolean);
    for (const r of options[k]) {
      if (!free(r)) continue;
      mark(r, true);
      chosen.push(r);
      if (walk(k + 1)) return true;
      chosen.pop();
      mark(r, false);
    }
    return false;
  };
  return walk(0) ? chosen : null;
}
