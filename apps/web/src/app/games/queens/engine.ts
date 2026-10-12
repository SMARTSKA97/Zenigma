/** Queens: one queen in every row, column and colour region, and no two queens touching (even diagonally). */

export interface QueensPuzzle {
  size: number;
  /** Region number of every cell, row by row. */
  regions: number[];
}

/** What a cell holds: nothing, a note that no queen can go here, or a queen. */
export type QueensCell = 0 | 1 | 2;
export const EMPTY = 0;
export const MARK = 1;
export const QUEEN = 2;

export const emptyBoard = (puzzle: QueensPuzzle): QueensCell[] => new Array<QueensCell>(puzzle.size * puzzle.size).fill(EMPTY);

/** The cell a tap moves to: empty, then a mark, then a queen, then back to empty. */
export const nextCell = (cell: QueensCell): QueensCell => ((cell + 1) % 3) as QueensCell;

/** Cells holding a queen that breaks a rule (shares a row, column or region with another queen, or touches one). */
export function conflicts(puzzle: QueensPuzzle, board: QueensCell[]): Set<number> {
  const n = puzzle.size;
  const queens: number[] = [];
  board.forEach((c, i) => c === QUEEN && queens.push(i));
  const bad = new Set<number>();
  for (let a = 0; a < queens.length; a++) {
    for (let b = a + 1; b < queens.length; b++) {
      const i = queens[a];
      const j = queens[b];
      const sameRow = Math.floor(i / n) === Math.floor(j / n);
      const sameCol = i % n === j % n;
      const sameRegion = puzzle.regions[i] === puzzle.regions[j];
      const touching = Math.abs(Math.floor(i / n) - Math.floor(j / n)) <= 1 && Math.abs((i % n) - (j % n)) <= 1;
      if (sameRow || sameCol || sameRegion || touching) {
        bad.add(i);
        bad.add(j);
      }
    }
  }
  return bad;
}

/** The queen's column in each row, or null while the board does not hold exactly one queen per row. */
export function solutionOf(puzzle: QueensPuzzle, board: QueensCell[]): number[] | null {
  const n = puzzle.size;
  const cols: number[] = [];
  for (let r = 0; r < n; r++) {
    const inRow: number[] = [];
    for (let c = 0; c < n; c++) if (board[r * n + c] === QUEEN) inRow.push(c);
    if (inRow.length !== 1) return null;
    cols.push(inRow[0]);
  }
  return cols;
}

/** The same rules the server applies to a submitted solution (columns of the queens, one per row). */
export function verify(puzzle: QueensPuzzle, cols: unknown): boolean {
  const n = puzzle.size;
  if (!Array.isArray(cols) || cols.length !== n || puzzle.regions.length !== n * n) return false;
  const usedCols = new Set<number>();
  const usedRegions = new Set<number>();
  for (let r = 0; r < n; r++) {
    const c = cols[r];
    if (!Number.isInteger(c) || c < 0 || c >= n) return false;
    if (usedCols.has(c)) return false;
    usedCols.add(c);
    const region = puzzle.regions[r * n + c];
    if (usedRegions.has(region)) return false;
    usedRegions.add(region);
    if (r > 0 && Math.abs(cols[r - 1] - c) < 2) return false;
  }
  return true;
}

export function isSolved(puzzle: QueensPuzzle, board: QueensCell[]): boolean {
  const cols = solutionOf(puzzle, board);
  return cols !== null && verify(puzzle, cols);
}

/** Cells whose right or bottom edge borders a different region, so the board can draw region outlines. */
export function borders(puzzle: QueensPuzzle, index: number): { right: boolean; bottom: boolean; left: boolean; top: boolean } {
  const n = puzzle.size;
  const r = Math.floor(index / n);
  const c = index % n;
  const region = puzzle.regions[index];
  return {
    right: c === n - 1 || puzzle.regions[index + 1] !== region,
    left: c === 0 || puzzle.regions[index - 1] !== region,
    bottom: r === n - 1 || puzzle.regions[index + n] !== region,
    top: r === 0 || puzzle.regions[index - n] !== region,
  };
}
