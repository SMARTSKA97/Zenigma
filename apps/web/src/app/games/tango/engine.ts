/** Tango: fill the grid with suns and moons. No three the same in a row, three of each in every row and column, and
 *  "=" / "x" signs between neighbours say whether the two cells match or differ. */

export const SIZE = 6;

export interface TangoPuzzle {
  /** 36 characters: '.' empty, 's' sun, 'm' moon. */
  givens: string;
  edges: [number, number, '=' | 'x'][];
}

export type TangoCell = '.' | 's' | 'm';

export const boardFrom = (puzzle: TangoPuzzle): TangoCell[] => [...puzzle.givens] as TangoCell[];

/** The cell a tap moves to: empty, then sun, then moon, then back to empty. */
export const nextCell = (cell: TangoCell): TangoCell => (cell === '.' ? 's' : cell === 's' ? 'm' : '.');

/** Cells that currently break a rule (only counting cells the player has filled in). */
export function conflicts(puzzle: TangoPuzzle, board: TangoCell[]): Set<number> {
  const bad = new Set<number>();
  for (let line = 0; line < SIZE; line++) {
    const row = Array.from({ length: SIZE }, (_, k) => line * SIZE + k);
    const col = Array.from({ length: SIZE }, (_, k) => k * SIZE + line);
    for (const cells of [row, col]) {
      for (let k = 0; k + 2 < SIZE; k++) {
        const [a, b, c] = [cells[k], cells[k + 1], cells[k + 2]];
        if (board[a] !== '.' && board[a] === board[b] && board[b] === board[c]) [a, b, c].forEach((i) => bad.add(i));
      }
      for (const symbol of ['s', 'm'] as const) {
        const matching = cells.filter((i) => board[i] === symbol);
        if (matching.length > SIZE / 2) matching.forEach((i) => bad.add(i));
      }
    }
  }
  for (const [a, b, kind] of puzzle.edges) {
    if (board[a] === '.' || board[b] === '.') continue;
    const same = board[a] === board[b];
    if (kind === '=' ? !same : same) {
      bad.add(a);
      bad.add(b);
    }
  }
  return bad;
}

export const solutionOf = (board: TangoCell[]): string | null => (board.includes('.') ? null : board.join(''));

/** The same rules the server applies to a submitted solution (36 characters of 's' and 'm'). */
export function verify(puzzle: TangoPuzzle, solution: unknown): boolean {
  if (typeof solution !== 'string' || solution.length !== SIZE * SIZE || puzzle.givens.length !== SIZE * SIZE) return false;
  if (![...solution].every((c) => c === 's' || c === 'm')) return false;
  for (let i = 0; i < solution.length; i++) if (puzzle.givens[i] !== '.' && puzzle.givens[i] !== solution[i]) return false;
  const cells = [...solution] as TangoCell[];
  if (conflicts({ givens: puzzle.givens, edges: puzzle.edges }, cells).size > 0) return false;
  for (let line = 0; line < SIZE; line++) {
    let rowSuns = 0;
    let colSuns = 0;
    for (let k = 0; k < SIZE; k++) {
      if (cells[line * SIZE + k] === 's') rowSuns++;
      if (cells[k * SIZE + line] === 's') colSuns++;
    }
    if (rowSuns !== SIZE / 2 || colSuns !== SIZE / 2) return false;
  }
  return true;
}

export function isSolved(puzzle: TangoPuzzle, board: TangoCell[]): boolean {
  const solution = solutionOf(board);
  return solution !== null && verify(puzzle, solution);
}
