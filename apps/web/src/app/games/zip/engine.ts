/** Zip: one path through every cell, passing the numbered cells in order, from 1 to the highest number. */

export interface ZipPuzzle {
  size: number;
  /** The number on every cell (0 for none), row by row. */
  numbers: number[];
}

/** The path so far, as the cells it passes, starting on the cell numbered 1. */
export type ZipPath = number[];

export const startCell = (puzzle: ZipPuzzle): number => puzzle.numbers.indexOf(1);
export const topNumber = (puzzle: ZipPuzzle): number => Math.max(...puzzle.numbers);
export const blankPath = (puzzle: ZipPuzzle): ZipPath => [startCell(puzzle)];

const apart = (size: number, a: number, b: number): number => Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs((a % size) - (b % size));

/** The number the path has to reach next. */
export function nextNumber(puzzle: ZipPuzzle, path: ZipPath): number {
  let reached = 0;
  for (const cell of path) if (puzzle.numbers[cell] > 0) reached++;
  return reached + 1;
}

/** Whether the path may step onto `cell`: next to its end, not visited, numbers in order, and the highest number only last. */
export function canStep(puzzle: ZipPuzzle, path: ZipPath, cell: number): boolean {
  const end = path[path.length - 1];
  if (cell < 0 || cell >= puzzle.size * puzzle.size || path.includes(cell) || apart(puzzle.size, end, cell) !== 1) return false;
  const number = puzzle.numbers[cell];
  if (number > 0 && number !== nextNumber(puzzle, path)) return false;
  if (number === topNumber(puzzle) && path.length + 1 !== puzzle.size * puzzle.size) return false;
  return true;
}

/** Moves the end of the path onto `cell`: one step forward, or one step back when `cell` is the cell it came from. Null if not allowed. */
export function step(puzzle: ZipPuzzle, path: ZipPath, cell: number): ZipPath | null {
  if (path.length >= 2 && cell === path[path.length - 2]) return path.slice(0, -1);
  return canStep(puzzle, path, cell) ? [...path, cell] : null;
}

/** Cutting the path back to `cell` (when it is already on the path). */
export function cutTo(path: ZipPath, cell: number): ZipPath | null {
  const at = path.indexOf(cell);
  return at < 0 ? null : path.slice(0, at + 1);
}

/** Moves never break a rule, so nothing is ever highlighted as wrong. */
export const conflicts = (): Set<number> => new Set();

export const solutionOf = (puzzle: ZipPuzzle, path: ZipPath): number[] | null => (path.length === puzzle.size * puzzle.size ? path : null);

/** The same rules the server applies to a submitted path. */
export function verify(puzzle: ZipPuzzle, path: unknown): boolean {
  const total = puzzle.size * puzzle.size;
  if (!Array.isArray(path) || path.length !== total || puzzle.numbers.length !== total) return false;
  const top = topNumber(puzzle);
  const seen = new Set<number>();
  let expected = 1;
  for (let i = 0; i < total; i++) {
    const cell = path[i];
    if (!Number.isInteger(cell) || cell < 0 || cell >= total || seen.has(cell)) return false;
    seen.add(cell);
    if (i > 0 && apart(puzzle.size, path[i - 1], cell) !== 1) return false;
    const number = puzzle.numbers[cell];
    if (number !== 0) {
      if (number !== expected) return false;
      expected++;
    }
  }
  return top >= 2 && expected === top + 1 && puzzle.numbers[path[total - 1]] === top;
}

export const isSolved = (puzzle: ZipPuzzle, path: ZipPath): boolean => verify(puzzle, path);

/** A board saved earlier fits when it is a legal path from the start (older versions or other levels would not be). */
export function fits(puzzle: ZipPuzzle, path: unknown): boolean {
  if (!Array.isArray(path) || path.length === 0 || path[0] !== startCell(puzzle)) return false;
  let built: ZipPath = [path[0]];
  for (const cell of path.slice(1)) {
    const next = canStep(puzzle, built, cell as number) ? [...built, cell as number] : null;
    if (!next) return false;
    built = next;
  }
  return true;
}
