/**
 * Hints that coach instead of giving the answer. A hint never fills a cell and never says which value belongs where.
 * - If something on the board cannot be part of the solution, the hint points at the area it is in ("something here is off").
 * - Otherwise it points at the place with the most to learn next and says why, in words.
 */
import { PuzzleGameId } from '../catalog';
import { boxOf, boxShape, sizeOf, SudokuPuzzle } from '../sudoku/engine';
import * as queens from '../queens/engine';
import * as tango from '../tango/engine';
import * as zip from '../zip/engine';
import * as patches from '../patches/engine';
import { patchOptions, solvePatches, solveQueens, solveSudoku, solveTango, solveZip, sudokuCandidates } from './solvers';

export interface Hint {
  /** 'mistake': something placed is wrong. 'nudge': where to look next. 'done': nothing left to hint. 'none': could not work one out. */
  kind: 'mistake' | 'nudge' | 'done' | 'none';
  /** Cells to light up (a row, a rectangle, a handful of cells...). */
  cells: number[];
  title: string;
  text: string;
}

const line = (n: number, kind: 'row' | 'col', index: number): number[] => Array.from({ length: n }, (_, k) => (kind === 'row' ? index * n + k : k * n + index));

const done: Hint = { kind: 'done', cells: [], title: 'Nothing to hint', text: 'The board is already complete.' };
const none: Hint = { kind: 'none', cells: [], title: 'No hint found', text: 'Try the Check button, or undo your last few moves.' };

/** A puzzle's solution only depends on the puzzle, so it is worked out once (a big board can take a third of a second, and the board is checked after every move). */
const once = <P extends object, R>(fn: (p: P) => R): ((p: P) => R) => {
  const seen = new WeakMap<P, R>();
  return (p) => {
    if (!seen.has(p)) seen.set(p, fn(p));
    return seen.get(p) as R;
  };
};
const queensSolution = once(solveQueens);
const tangoSolution = once(solveTango);
const sudokuSolution = once((p: SudokuPuzzle) => solveSudoku([...p.givens].map(Number), p));
const zipSolution = once(solveZip);
const patchesSolution = once(solvePatches);

export function hintFor(game: PuzzleGameId, puzzle: unknown, state: unknown): Hint {
  switch (game) {
    case 'queens':
      return queensHint(puzzle as queens.QueensPuzzle, state as queens.QueensCell[]);
    case 'tango':
      return tangoHint(puzzle as tango.TangoPuzzle, state as tango.TangoCell[]);
    case 'sudoku':
      return sudokuHint(puzzle as SudokuPuzzle, state as number[]);
    case 'zip':
      return zipHint(puzzle as zip.ZipPuzzle, state as zip.ZipPath);
    case 'patches':
      return patchesHint(puzzle as patches.PatchesPuzzle, state as patches.Rect[]);
  }
}

/**
 * The second, stronger hint for a board that has not changed since the first one: it names the exact cell and says what to do with it,
 * so asking again always gets more than the first time. Null when the board is already finished or cannot be solved.
 */
export function revealFor(game: PuzzleGameId, puzzle: unknown, state: unknown): Hint | null {
  const first = hintFor(game, puzzle, state);
  if (first.kind === 'done' || first.kind === 'none') return null;
  switch (game) {
    case 'queens': {
      const p = puzzle as queens.QueensPuzzle;
      const board = state as queens.QueensCell[];
      const sol = queensSolution(p);
      if (!sol) return null;
      const n = p.size;
      for (let r = 0; r < n; r++) {
        const idx = r * n + sol[r];
        for (let c = 0; c < n; c++) if (board[r * n + c] === queens.QUEEN && c !== sol[r] && !queens.isGiven(p, r * n + c))
          return { kind: 'mistake', cells: [r * n + c], title: 'This queen is wrong', text: `Take this queen off row ${r + 1}. It looks fine, but the puzzle cannot be finished with it.` };
        if (board[idx] === queens.MARK) return { kind: 'mistake', cells: [idx], title: 'This ✕ is wrong', text: `Clear this ✕: row ${r + 1} needs its queen right here.` };
      }
      let best = -1;
      let bestOpen = 99;
      for (let r = 0; r < n; r++) {
        if (board[r * n + sol[r]] === queens.QUEEN) continue;
        const open = Array.from({ length: n }, (_, c) => board[r * n + c]).filter((v) => v !== queens.MARK).length;
        if (open < bestOpen) (best = r), (bestOpen = open);
      }
      if (best < 0) return null;
      return { kind: 'nudge', cells: [best * n + sol[best]], title: 'A queen goes here', text: `Put a queen in row ${best + 1}, column ${sol[best] + 1}. Then work out what it rules out around it.` };
    }
    case 'tango': {
      const p = puzzle as tango.TangoPuzzle;
      const board = state as tango.TangoCell[];
      const sol = tangoSolution(p);
      if (!sol) return null;
      const name = (v: string): string => (v === 's' ? 'sun ☀️' : 'moon 🌙');
      for (let i = 0; i < board.length; i++)
        if (board[i] !== '.' && p.givens[i] === '.' && board[i] !== sol[i]) return { kind: 'mistake', cells: [i], title: 'This symbol is wrong', text: `Change this cell: it should be a ${name(sol[i])}, not a ${name(board[i])}.` };
      const N = tango.SIZE;
      let best = -1;
      let bestLeft = 99;
      for (let i = 0; i < board.length; i++) {
        if (board[i] !== '.') continue;
        const row = line(N, 'row', Math.floor(i / N)).filter((j) => board[j] === '.').length;
        const col = line(N, 'col', i % N).filter((j) => board[j] === '.').length;
        if (Math.min(row, col) < bestLeft) (best = i), (bestLeft = Math.min(row, col));
      }
      if (best < 0) return null;
      return { kind: 'nudge', cells: [best], title: 'This cell is easiest', text: `Put a ${name(sol[best])} here. Check why: the line it is in already points to it.` };
    }
    case 'sudoku': {
      const p = puzzle as SudokuPuzzle;
      const board = state as number[];
      const sol = sudokuSolution(p);
      if (!sol) return null;
      for (let i = 0; i < board.length; i++)
        if (board[i] && p.givens[i] === '0' && String(board[i]) !== sol[i]) return { kind: 'mistake', cells: [i], title: 'This number is wrong', text: `Clear this ${board[i]}: it cannot be part of the solution, even if nothing clashes yet.` };
      const empties = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
      if (!empties.length) return null;
      const fewest = empties.reduce((a, b) => (sudokuCandidates(board, b, p).length < sudokuCandidates(board, a, p).length ? b : a));
      return { kind: 'nudge', cells: [fewest], title: 'This cell is a ' + sol[fewest], text: `Put a ${sol[fewest]} here (row ${Math.floor(fewest / sizeOf(board.length)) + 1}, column ${(fewest % sizeOf(board.length)) + 1}), then see which cells it settles.` };
    }
    case 'zip': {
      const p = puzzle as zip.ZipPuzzle;
      const path = state as zip.ZipPath;
      const sol = zipSolution(p);
      if (!sol) return null;
      for (let i = 0; i < path.length; i++)
        if (path[i] !== sol[i]) return { kind: 'mistake', cells: [path[Math.max(0, i - 1)], path[i]], title: 'Back up to here', text: 'Drag back to the first highlighted cell, then go a different way: the path cannot be finished from the second one.' };
      const next = sol[path.length];
      if (next === undefined) return null;
      return { kind: 'nudge', cells: [path[path.length - 1], next], title: 'Go here next', text: 'The route continues into the highlighted cell. Keep going and check each step against the numbers.' };
    }
    case 'patches': {
      const p = puzzle as patches.PatchesPuzzle;
      const rects = state as patches.Rect[];
      const sol = patchesSolution(p);
      if (!sol) return null;
      const key = (r: patches.Rect) => r.join(',');
      const right = new Set(sol.map(key));
      const n = p.size;
      const cellsOf = (r: patches.Rect): number[] => {
        const cells: number[] = [];
        for (let rr = r[0]; rr <= r[2]; rr++) for (let cc = r[1]; cc <= r[3]; cc++) cells.push(rr * n + cc);
        return cells;
      };
      const bad = rects.find((r) => !right.has(key(r)));
      if (bad) return { kind: 'mistake', cells: cellsOf(bad), title: 'Remove this rectangle', text: 'It does not fit the answer. Clear it and give those cells to their neighbours.' };
      const todo = sol.filter((r) => !rects.some((x) => key(x) === key(r)));
      if (!todo.length) return null;
      // The smallest missing rectangle is the easiest to place.
      const pick = todo.reduce((a, b) => (cellsOf(a).length <= cellsOf(b).length ? a : b));
      return { kind: 'nudge', cells: cellsOf(pick), title: 'Draw this rectangle', text: 'These cells make one rectangle of the answer. Drag across them to draw it.' };
    }
  }
}

/** True when the board has something that cannot be part of the one solution (used by the free Check button). */
export function hasMistake(game: PuzzleGameId, puzzle: unknown, state: unknown): boolean {
  return hintFor(game, puzzle, state).kind === 'mistake';
}

// ------------------------------------------------------------------------------------------------ Queens

function queensHint(puzzle: queens.QueensPuzzle, board: queens.QueensCell[]): Hint {
  const n = puzzle.size;
  const sol = queensSolution(puzzle);
  if (!sol) return none;
  if (queens.isSolved(puzzle, board)) return done;

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const cell = board[r * n + c];
      const right = sol[r] === c;
      if (cell === queens.QUEEN && !right && !queens.isGiven(puzzle, r * n + c))
        return { kind: 'mistake', cells: line(n, 'row', r), title: 'Something is off in this row', text: `The queen in row ${r + 1} cannot be part of the solution, even if it looks fine. Check which colour regions and columns it uses up.` };
      if (cell === queens.MARK && right)
        return { kind: 'mistake', cells: line(n, 'row', r), title: 'A ✕ is in the wrong place', text: `Row ${r + 1} has a ✕ on a cell that should not be crossed out. Re-check why you ruled it out.` };
    }
  }

  // What is still possible: no queen in the row, column, colour or neighbourhood of another queen, and not crossed out.
  const queensAt: number[] = [];
  board.forEach((v, i) => v === queens.QUEEN && queensAt.push(i));
  const free = (i: number): boolean => {
    if (board[i] === queens.MARK) return false;
    const r = Math.floor(i / n);
    const c = i % n;
    return !queensAt.some((q) => {
      const qr = Math.floor(q / n);
      const qc = q % n;
      return q !== i && (qr === r || qc === c || puzzle.regions[q] === puzzle.regions[i] || (Math.abs(qr - r) <= 1 && Math.abs(qc - c) <= 1));
    });
  };
  const hasQueen = (cells: number[]) => cells.some((i) => board[i] === queens.QUEEN);
  const lines: { cells: number[]; label: string }[] = [];
  for (let k = 0; k < n; k++) {
    lines.push({ cells: line(n, 'row', k), label: `row ${k + 1}` });
    lines.push({ cells: line(n, 'col', k), label: `column ${k + 1}` });
  }
  for (let region = 0; region < n; region++) {
    const cells = puzzle.regions.map((v, i) => (v === region ? i : -1)).filter((i) => i >= 0);
    lines.push({ cells, label: 'this colour' });
  }
  let best: { cells: number[]; label: string; open: number } | null = null;
  for (const l of lines) {
    if (hasQueen(l.cells)) continue;
    const open = l.cells.filter(free).length;
    if (open === 0) continue;
    if (!best || open < best.open) best = { ...l, open };
  }
  if (!best) return none;
  return best.open === 1
    ? { kind: 'nudge', cells: best.cells, title: 'Only one place left', text: `In ${best.label}, only one cell is not ruled out yet. Which one is it?` }
    : { kind: 'nudge', cells: best.cells, title: 'Look at the fewest options', text: `${best.label[0].toUpperCase()}${best.label.slice(1)} still needs a queen and has only ${best.open} cells left. Cross out the ones touching another queen or sharing its row, column or colour.` };
}

// ------------------------------------------------------------------------------------------------ Tango

function tangoHint(puzzle: tango.TangoPuzzle, board: tango.TangoCell[]): Hint {
  const N = tango.SIZE;
  const sol = tangoSolution(puzzle);
  if (!sol) return none;
  if (!board.includes('.') && tango.isSolved(puzzle, board)) return done;

  for (let i = 0; i < board.length; i++) {
    if (board[i] !== '.' && puzzle.givens[i] === '.' && board[i] !== sol[i]) {
      const r = Math.floor(i / N);
      return { kind: 'mistake', cells: line(N, 'row', r), title: 'Something is off in this row', text: `One of the symbols in row ${r + 1} cannot be part of the solution. Count the suns and moons and check each = and ×.` };
    }
  }

  const empty = (i: number) => board[i] === '.';
  const lines: number[][] = [];
  for (let k = 0; k < N; k++) lines.push(line(N, 'row', k), line(N, 'col', k));

  // A sign beside a symbol that is already there.
  for (const [a, b, kind] of puzzle.edges) {
    if (empty(a) !== empty(b)) return { kind: 'nudge', cells: [a, b], title: 'Follow the sign', text: kind === '=' ? 'An = sign joins a filled cell to an empty one. What must the empty one be?' : 'A × sign joins a filled cell to an empty one. What must the empty one be?' };
  }
  for (const cells of lines) {
    for (let k = 0; k + 1 < N; k++) {
      const [a, b] = [cells[k], cells[k + 1]];
      if (!empty(a) && board[a] === board[b]) {
        const ends = [cells[k - 1], cells[k + 2]].filter((x) => x !== undefined && empty(x));
        if (ends.length) return { kind: 'nudge', cells: [a, b, ...ends], title: 'Two the same side by side', text: 'No three of a kind in a row. What can go at the ends of this pair?' };
      }
    }
    for (let k = 0; k + 2 < N; k++) {
      const [a, m, b] = [cells[k], cells[k + 1], cells[k + 2]];
      if (!empty(a) && board[a] === board[b] && empty(m)) return { kind: 'nudge', cells: [a, m, b], title: 'A gap between two the same', text: 'If the gap held the same symbol, you would have three in a row. What goes in it?' };
    }
  }
  for (const cells of lines) {
    const empties = cells.filter(empty);
    if (empties.length && (cells.filter((i) => board[i] === 's').length === N / 2 || cells.filter((i) => board[i] === 'm').length === N / 2))
      return { kind: 'nudge', cells, title: 'One symbol is used up here', text: `This line already has ${N / 2} of one symbol. What does that mean for its empty cells?` };
  }
  // Nothing simple: the line with the fewest empty cells.
  let best: number[] | null = null;
  for (const cells of lines) {
    const left = cells.filter(empty).length;
    if (left && (!best || left < best.filter(empty).length)) best = cells;
  }
  if (!best) return none;
  return { kind: 'nudge', cells: best, title: 'Try the fullest line', text: 'No simple rule applies. Pick an empty cell here and ask: what breaks if it is a sun? What breaks if it is a moon?' };
}

// ------------------------------------------------------------------------------------------------ Sudoku

function sudokuHint(puzzle: SudokuPuzzle, board: number[]): Hint {
  const n = sizeOf(board.length);
  const rule = puzzle.rule;
  const boxId = (j: number): number => (rule === 'jigsaw' ? Number(puzzle.regions![j]) : boxOf(j, n));
  const sol = sudokuSolution(puzzle);
  if (!sol) return none;
  if (!board.includes(0) && board.join('') === sol) return done;

  for (let i = 0; i < board.length; i++) {
    if (board[i] && puzzle.givens[i] === '0' && String(board[i]) !== sol[i]) {
      const box = boxId(i);
      const cells = board.map((_, j) => (boxId(j) === box ? j : -1)).filter((j) => j >= 0);
      return { kind: 'mistake', cells, title: rule === 'jigsaw' ? 'Something is off in this region' : 'Something is off in this box', text: 'One of the numbers you placed in this box is not right. It may not clash with anything yet, but the puzzle cannot be finished with it.' };
    }
  }

  const empties = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  const cand = new Map(empties.map((i) => [i, sudokuCandidates(board, i, puzzle)]));

  // A cell with only one number left.
  const naked = empties.find((i) => cand.get(i)!.length === 1);
  if (naked !== undefined) return { kind: 'nudge', cells: [naked], title: 'Only one number fits here', text: `Everything else is already taken by this cell’s row, column or box${rule === 'diagonal' ? ', or its diagonal' : rule === 'knight' ? ', or a knight’s move away' : rule === 'windoku' ? ', or its shaded window' : rule === 'disjoint' ? ', or the cells in the same spot of the other boxes' : rule === 'killer' ? ', or its cage' : rule === 'jigsaw' ? ', or its region' : rule === 'thermo' ? ', or the thermometer it sits on' : rule === 'arrow' ? ', or its arrow' : rule === 'even-odd' ? ', or its even/odd shape' : rule === 'consecutive' ? ', or the bars and gaps next to it' : rule === 'sandwich' ? ', or the sandwich clues' : ''}. Which number is left?` };

  // A number that has only one home in a row, column or box.
  const houses: { cells: number[]; label: string }[] = [];
  const [bh, bw] = boxShape(n);
  for (let b = 0; b < n; b++) houses.push({ cells: board.map((_, j) => (boxId(j) === b ? j : -1)).filter((j) => j >= 0), label: rule === 'jigsaw' ? 'region' : 'box' });
  for (let k = 0; k < n; k++) houses.push({ cells: line(n, 'row', k), label: 'row' }, { cells: line(n, 'col', k), label: 'column' });
  void bh;
  void bw;
  if (rule === 'diagonal') {
    houses.push({ cells: board.map((_, j) => (Math.floor(j / n) === j % n ? j : -1)).filter((j) => j >= 0), label: 'diagonal' });
    houses.push({ cells: board.map((_, j) => (Math.floor(j / n) + (j % n) === n - 1 ? j : -1)).filter((j) => j >= 0), label: 'diagonal' });
  }
  for (const h of houses) {
    for (let d = 1; d <= n; d++) {
      if (h.cells.some((i) => board[i] === d)) continue;
      const spots = h.cells.filter((i) => !board[i] && cand.get(i)!.includes(d));
      if (spots.length === 1) return { kind: 'nudge', cells: h.cells, title: `Where does the ${d} go?`, text: `In this ${h.label}, the ${d} has only one place left. Rule out the other cells.` };
    }
  }

  const fewest = empties.reduce((a, b) => (cand.get(b)!.length < cand.get(a)!.length ? b : a));
  return { kind: 'nudge', cells: [fewest], title: 'Start with the fewest options', text: `This cell has ${cand.get(fewest)!.length} possible numbers. Note them down, then see what its neighbours rule out.` };
}

// ------------------------------------------------------------------------------------------------ Zip

function zipHint(puzzle: zip.ZipPuzzle, path: zip.ZipPath): Hint {
  const sol = zipSolution(puzzle);
  if (!sol) return none;
  if (zip.isSolved(puzzle, path)) return done;
  for (let i = 0; i < path.length; i++) {
    if (path[i] !== sol[i]) {
      return { kind: 'mistake', cells: [path[Math.max(0, i - 1)], path[i]], title: 'Your path goes wrong here', text: 'From the highlighted spot on, the path cannot be completed. Back up to it and look for a cell that would get cut off.' };
    }
  }
  const n = puzzle.size;
  if (path.length === 1) {
    const corners = [0, n - 1, n * (n - 1), n * n - 1].filter((c) => !path.includes(c) && puzzle.numbers[c] === 0 && !puzzle.holes?.includes(c));
    if (corners.length) return { kind: 'nudge', cells: corners, title: 'Corners have two neighbours', text: 'The path must enter and leave every corner, so it must use both of its neighbours. Start your route from there.' };
  }
  const next = zip.nextNumber(puzzle, path);
  const target = puzzle.numbers.indexOf(next);
  return { kind: 'nudge', cells: [path[path.length - 1], target], title: `Next stop: ${next}`, text: `Reach ${next} next without cutting off any cell you will still need. Count how many cells that leaves on the way.` };
}

// ------------------------------------------------------------------------------------------------ Patches

function patchesHint(puzzle: patches.PatchesPuzzle, rects: patches.Rect[]): Hint {
  const sol = patchesSolution(puzzle);
  if (!sol) return none;
  const key = (r: patches.Rect) => r.join(',');
  const right = new Set(sol.map(key));
  if (rects.length === sol.length && rects.every((r) => right.has(key(r)))) return done;
  const n = puzzle.size;

  for (const r of rects) {
    if (!right.has(key(r))) {
      const cells: number[] = [];
      for (let rr = r[0]; rr <= r[2]; rr++) for (let cc = r[1]; cc <= r[3]; cc++) cells.push(rr * n + cc);
      return { kind: 'mistake', cells, title: 'This rectangle is not right', text: 'It breaks no rule yet, but the grid cannot be finished with it. Check what it leaves for the numbers around it.' };
    }
  }

  let best: { k: number; options: number } | null = null;
  puzzle.clues.forEach(([cell], k) => {
    if (rects.some((r) => patches.covers(r, n, cell))) return;
    const options = patchOptions(puzzle, k).filter((o) => rects.every((r) => !patches.overlap(r, o))).length;
    // A lone 1 teaches nothing, so numbers that need real thought come first.
    const weight = options + (puzzle.clues[k][1] === 1 ? 100 : 0);
    if (options > 0 && (!best || weight < best.options)) best = { k, options: weight };
  });
  if (!best) return none;
  const clue = puzzle.clues[(best as { k: number }).k];
  const count = patchOptions(puzzle, (best as { k: number }).k).filter((o) => rects.every((r) => !patches.overlap(r, o))).length;
  return count === 1
    ? { kind: 'nudge', cells: [clue[0]], title: 'Only one rectangle fits this number', text: `The ${clue[1]} has just one place to grow. Which cells does it have to take?` }
    : { kind: 'nudge', cells: [clue[0]], title: 'Start with this number', text: `The ${clue[1]} has ${count} possible rectangles left. Which ones would crowd the numbers around it?` };
}
