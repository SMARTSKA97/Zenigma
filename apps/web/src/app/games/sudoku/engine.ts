/**
 * Sudoku in two sizes: the classic 9x9 grid (3x3 boxes) and a mini 6x6 grid (boxes 2 rows by 3 columns).
 * Every row, column and box holds 1 to n once. The size follows from the puzzle: 36 cells is mini, 81 is classic.
 */

export interface SudokuPuzzle {
  /** One digit per cell, row by row, '0' for an empty cell. */
  givens: string;
}

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

/** Filled cells that repeat a number in their row, column or box. */
export function conflicts(board: number[]): Set<number> {
  const n = sizeOf(board.length);
  const bad = new Set<number>();
  for (let i = 0; i < board.length; i++) {
    if (!board[i]) continue;
    for (let j = i + 1; j < board.length; j++) {
      if (board[j] !== board[i]) continue;
      const sameRow = Math.floor(i / n) === Math.floor(j / n);
      const sameCol = i % n === j % n;
      if (sameRow || sameCol || boxOf(i, n) === boxOf(j, n)) {
        bad.add(i);
        bad.add(j);
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
  return conflicts([...solution].map(Number)).size === 0;
}

export function isSolved(puzzle: SudokuPuzzle, board: number[]): boolean {
  const solution = solutionOf(board);
  return solution !== null && verify(puzzle, solution);
}
