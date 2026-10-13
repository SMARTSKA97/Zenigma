import { isKindRule, KindData, KindRule, modelOf } from './kinds';

/**
 * Sudoku in two sizes: the classic 9x9 grid (3x3 boxes) and a mini 6x6 grid (boxes 2 rows by 3 columns).
 * Every row, column and box holds 1 to n once. The size follows from the puzzle: 36 cells is mini, 81 is classic.
 */

/** One more rule on the classic grid: both long diagonals hold 1 to 9 once ('diagonal'), or no digit repeats a chess knight's move away ('knight'). */
export type SudokuRule = 'diagonal' | 'knight' | 'king' | 'nonconsec' | 'windoku' | 'disjoint' | KindRule;

/** What the rule functions take: a plain rule name, or the puzzle itself (the kinds that carry data need it). */
export type Rules = SudokuRule | (KindData & { rule?: SudokuRule }) | undefined;
const ruleName = (rules: Rules): SudokuRule | undefined => (typeof rules === 'string' ? rules : (rules?.rule as SudokuRule | undefined));
const kindOf = (rules: Rules): KindData | undefined => (rules && typeof rules === 'object' && isKindRule(rules.rule) ? rules : undefined);

/** Which extra group (window or box position) a cell is in under 'windoku' or 'disjoint', or -1. */
export function extraGroup(rule: SudokuRule | undefined, i: number, n = 9): number {
  const r = Math.floor(i / n);
  const c = i % n;
  if (rule === 'disjoint') return (r % 3) * 3 + (c % 3);
  if (rule === 'windoku') {
    const win = (x: number) => (x >= 1 && x <= 3 ? 0 : x >= 5 && x <= 7 ? 1 : -1);
    const a = win(r);
    const b = win(c);
    return a < 0 || b < 0 ? -1 : a * 2 + b;
  }
  return -1;
}

export interface SudokuPuzzle extends KindData {
  /** One digit per cell, row by row, '0' for an empty cell. */
  givens: string;
  rule?: SudokuRule;
}

const KING: [number, number][] = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const KNIGHT: [number, number][] = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const peerCache = new Map<string, number[]>();

/** Every other cell that may not hold the same digit as cell `i`: its row, column and box, plus the rule's extras. */
export function peersOf(i: number, n: number, rules?: Rules): number[] {
  const kind = kindOf(rules);
  if (kind) return modelOf(kind).peers[i];
  const rule = ruleName(rules);
  const key = `${n}:${rule ?? ''}:${i}`;
  let found = peerCache.get(key);
  if (found) return found;
  const r = Math.floor(i / n);
  const c = i % n;
  const out = new Set<number>();
  for (let j = 0; j < n * n; j++) {
    if (j === i) continue;
    const rj = Math.floor(j / n);
    const cj = j % n;
    if (rj === r || cj === c || boxOf(j, n) === boxOf(i, n)) out.add(j);
    if ((rule === 'windoku' || rule === 'disjoint') && extraGroup(rule, i, n) >= 0 && extraGroup(rule, i, n) === extraGroup(rule, j, n)) out.add(j);
    if (rule === 'diagonal' && ((r === c && rj === cj) || (r + c === n - 1 && rj + cj === n - 1))) out.add(j);
  }
  if (rule === 'knight' || rule === 'king') {
    for (const [dr, dc] of rule === 'king' ? KING : KNIGHT) {
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < n && cc >= 0 && cc < n) out.add(rr * n + cc);
    }
  }
  found = [...out];
  peerCache.set(key, found);
  return found;
}

/** The cells on the two long diagonals (for drawing them and for the diagonal rule). */
export const onDiagonal = (i: number, n: number): boolean => Math.floor(i / n) === i % n || Math.floor(i / n) + (i % n) === n - 1;

/** Side of the grid for a number of cells (6 for 36, 9 for 81). */
export const sizeOf = (cells: number): number => Math.round(Math.sqrt(cells));

/** Box height and width for a grid of side n. */
export const boxShape = (n: number): [number, number] => (n === 6 ? [2, 3] : [3, 3]);

export const boardFrom = (puzzle: SudokuPuzzle): number[] => [...puzzle.givens].map(Number);

/** Which box a cell is in, for a grid of side n. */
export function boxOf(index: number, n: number): number {
  const [bh, bw] = boxShape(n);
  return Math.floor(Math.floor(index / n) / bh) * (n / bw) + Math.floor((index % n) / bw);
}

/** Filled cells that repeat a number in their row, column or box (and, with a rule, on the diagonals or a knight's move apart). */
export function conflicts(board: number[], rules?: Rules): Set<number> {
  const n = sizeOf(board.length);
  const bad = new Set<number>();
  const kind = kindOf(rules);
  if (kind) {
    const m = modelOf(kind);
    for (let i = 0; i < board.length; i++) if (board[i] && (!(m.dom[i] & (1 << board[i])) || !m.check(board, i))) bad.add(i);
  }
  for (let i = 0; i < board.length; i++) {
    if (!board[i]) continue;
    for (const j of peersOf(i, n, rules)) {
      if (j > i && board[j] === board[i]) {
        bad.add(i);
        bad.add(j);
      }
    }
  }
  if (ruleName(rules) === 'nonconsec') {
    for (let i = 0; i < board.length; i++) {
      for (const j of [i + 1, i + n]) {
        if (j >= board.length || (j === i + 1 && (i + 1) % n === 0)) continue;
        if (board[i] && board[j] && Math.abs(board[i] - board[j]) === 1) {
          bad.add(i);
          bad.add(j);
        }
      }
    }
  }
  return bad;
}

export const solutionOf = (board: number[]): string | null => (board.includes(0) ? null : board.join(''));

/** The same rules the server applies to a submitted solution (one digit per cell). */
export function verify(puzzle: SudokuPuzzle, solution: unknown): boolean {
  const total = puzzle.givens.length;
  if (total !== 36 && total !== 81) return false;
  const n = sizeOf(total);
  if (typeof solution !== 'string' || solution.length !== total) return false;
  if (![...solution].every((c) => c >= '1' && c <= String(n))) return false;
  for (let i = 0; i < total; i++) if (puzzle.givens[i] !== '0' && puzzle.givens[i] !== solution[i]) return false;
  if (puzzle.rule && total !== 81) return false;
  return conflicts([...solution].map(Number), puzzle).size === 0;
}

export function isSolved(puzzle: SudokuPuzzle, board: number[]): boolean {
  const solution = solutionOf(board);
  return solution !== null && verify(puzzle, solution);
}
