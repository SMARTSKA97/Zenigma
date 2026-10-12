/** Mini Sudoku: a 6x6 grid with boxes two rows tall and three columns wide. Every row, column and box holds 1 to 6 once. */

export const SIZE = 6;
const BOX_ROWS = 2;
const BOX_COLS = 3;

export interface SudokuPuzzle {
  /** 36 digits, '0' for an empty cell. */
  givens: string;
}

export const boardFrom = (puzzle: SudokuPuzzle): number[] => [...puzzle.givens].map(Number);

export const boxOf = (index: number): number => Math.floor(Math.floor(index / SIZE) / BOX_ROWS) * (SIZE / BOX_COLS) + Math.floor((index % SIZE) / BOX_COLS);

/** Filled cells that repeat a number in their row, column or box. */
export function conflicts(board: number[]): Set<number> {
  const bad = new Set<number>();
  for (let i = 0; i < board.length; i++) {
    if (!board[i]) continue;
    for (let j = i + 1; j < board.length; j++) {
      if (board[j] !== board[i]) continue;
      const sameRow = Math.floor(i / SIZE) === Math.floor(j / SIZE);
      const sameCol = i % SIZE === j % SIZE;
      if (sameRow || sameCol || boxOf(i) === boxOf(j)) {
        bad.add(i);
        bad.add(j);
      }
    }
  }
  return bad;
}

export const solutionOf = (board: number[]): string | null => (board.includes(0) ? null : board.join(''));

/** The same rules the server applies to a submitted solution (36 digits). */
export function verify(puzzle: SudokuPuzzle, solution: unknown): boolean {
  if (typeof solution !== 'string' || solution.length !== SIZE * SIZE || puzzle.givens.length !== SIZE * SIZE) return false;
  if (![...solution].every((c) => c >= '1' && c <= '6')) return false;
  for (let i = 0; i < solution.length; i++) if (puzzle.givens[i] !== '0' && puzzle.givens[i] !== solution[i]) return false;
  return conflicts([...solution].map(Number)).size === 0;
}

export function isSolved(puzzle: SudokuPuzzle, board: number[]): boolean {
  const solution = solutionOf(board);
  return solution !== null && verify(puzzle, solution);
}
