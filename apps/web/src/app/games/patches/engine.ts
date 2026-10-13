/** Patches: cut the grid into rectangles. Each holds exactly one clue and has its area, and matches its shape when shown. */

/** [cell, area, shape]: shape 0 is any, 1 wide, 2 tall, 3 square. */
export type PatchesClue = [number, number, number];

export interface PatchesPuzzle {
  size: number;
  clues: PatchesClue[];
}

/** [row0, col0, row1, col1], both corners included. */
export type Rect = [number, number, number, number];

export const SHAPES = { any: 0, wide: 1, tall: 2, square: 3 } as const;

export const blankBoard = (): Rect[] => [];

export const widthOf = (r: Rect): number => r[3] - r[1] + 1;
export const heightOf = (r: Rect): number => r[2] - r[0] + 1;
export const shapeOf = (r: Rect): number => (widthOf(r) === heightOf(r) ? 3 : widthOf(r) > heightOf(r) ? 1 : 2);

/** The rectangle spanned by two cells. */
export function between(size: number, a: number, b: number): Rect {
  const [ra, ca, rb, cb] = [Math.floor(a / size), a % size, Math.floor(b / size), b % size];
  return [Math.min(ra, rb), Math.min(ca, cb), Math.max(ra, rb), Math.max(ca, cb)];
}

export const covers = (r: Rect, size: number, cell: number): boolean => {
  const [row, col] = [Math.floor(cell / size), cell % size];
  return row >= r[0] && row <= r[2] && col >= r[1] && col <= r[3];
};

export const overlap = (a: Rect, b: Rect): boolean => a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];

/** Adds a rectangle, taking away any it would overlap. */
export const place = (rects: Rect[], rect: Rect): Rect[] => [...rects.filter((r) => !overlap(r, rect)), rect];

export const removeAt = (rects: Rect[], size: number, cell: number): Rect[] => rects.filter((r) => !covers(r, size, cell));

export const rectAt = (rects: Rect[], size: number, cell: number): Rect | undefined => rects.find((r) => covers(r, size, cell));

/** The clues inside a rectangle. */
export const cluesIn = (puzzle: PatchesPuzzle, r: Rect): PatchesClue[] => puzzle.clues.filter(([cell]) => covers(r, puzzle.size, cell));

/** A rectangle is right when it holds one clue and has that clue's area and (if shown) shape. */
export function isRight(puzzle: PatchesPuzzle, r: Rect): boolean {
  const inside = cluesIn(puzzle, r);
  if (inside.length !== 1) return false;
  const [, area, shape] = inside[0];
  return area === widthOf(r) * heightOf(r) && (shape === 0 || shape === shapeOf(r));
}

/** Cells of every rectangle that cannot be part of an answer. */
export function conflicts(puzzle: PatchesPuzzle, rects: Rect[]): Set<number> {
  const bad = new Set<number>();
  for (const r of rects) {
    if (isRight(puzzle, r)) continue;
    for (let row = r[0]; row <= r[2]; row++) for (let col = r[1]; col <= r[3]; col++) bad.add(row * puzzle.size + col);
  }
  return bad;
}

/** The same rules the server applies to a submitted answer. */
export function verify(puzzle: PatchesPuzzle, rects: unknown): boolean {
  const { size, clues } = puzzle;
  if (!Array.isArray(rects) || rects.length !== clues.length) return false;
  const owner = new Array<number>(size * size).fill(0);
  let id = 0;
  for (const raw of rects) {
    id++;
    if (!Array.isArray(raw) || raw.length !== 4 || !raw.every((n) => Number.isInteger(n))) return false;
    const r = raw as Rect;
    if (r[0] < 0 || r[1] < 0 || r[2] < r[0] || r[3] < r[1] || r[2] >= size || r[3] >= size) return false;
    for (let row = r[0]; row <= r[2]; row++) {
      for (let col = r[1]; col <= r[3]; col++) {
        if (owner[row * size + col] !== 0) return false;
        owner[row * size + col] = id;
      }
    }
    if (!isRight(puzzle, r)) return false;
  }
  return owner.every((o) => o !== 0);
}

export const isSolved = (puzzle: PatchesPuzzle, rects: Rect[]): boolean => verify(puzzle, rects);

export const solutionOf = (_: PatchesPuzzle, rects: Rect[]): Rect[] => rects;

/** A saved board fits when every rectangle is inside this grid and none overlap. */
export function fits(puzzle: PatchesPuzzle, state: unknown): boolean {
  if (!Array.isArray(state)) return false;
  const seen = new Set<number>();
  for (const r of state) {
    if (!Array.isArray(r) || r.length !== 4 || !r.every((n) => Number.isInteger(n))) return false;
    if (r[0] < 0 || r[1] < 0 || r[2] < r[0] || r[3] < r[1] || r[2] >= puzzle.size || r[3] >= puzzle.size) return false;
    for (let row = r[0]; row <= r[2]; row++) {
      for (let col = r[1]; col <= r[3]; col++) {
        const cell = row * puzzle.size + col;
        if (seen.has(cell)) return false;
        seen.add(cell);
      }
    }
  }
  return true;
}
