import { PuzzleGameId } from '../catalog';
import { formatDuration } from '../../core/leaderboard.service';

const REGION = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫', '⬛', '⬜'];

interface ShareInput {
  game: PuzzleGameId;
  name: string;
  /** "Daily 2026-10-12" or "Level 12". */
  label: string;
  puzzle: unknown;
  state: unknown;
  ms: number;
  rank?: number | null;
}

/** A spoiler-free result card: the finished board as emoji (no digits), the time, and where to play. */
export function shareCard(input: ShareInput): string {
  const lines = [`${input.name} · ${input.label}`, `⏱ ${formatDuration(input.ms)}${input.rank ? ` · #${input.rank} today` : ''}`];

  if (input.game === 'queens') {
    const puzzle = input.puzzle as { size: number; regions: number[] };
    const board = input.state as number[];
    for (let r = 0; r < puzzle.size; r++) {
      let row = '';
      for (let c = 0; c < puzzle.size; c++) {
        const i = r * puzzle.size + c;
        row += board[i] === 2 ? '👑' : REGION[puzzle.regions[i] % REGION.length];
      }
      lines.push(row);
    }
  } else if (input.game === 'tango') {
    const board = input.state as string[];
    for (let r = 0; r < 6; r++) lines.push(board.slice(r * 6, r * 6 + 6).map((v) => (v === 's' ? '🌞' : '🌙')).join(''));
  }

  else if (input.game === 'sudoku') {
    // Digits stay hidden: the boxes alternate in two colours, so only the shape of the grid shows.
    const total = (input.puzzle as { givens: string }).givens.length;
    const n = total === 36 ? 6 : 9;
    const [bh, bw] = n === 6 ? [2, 3] : [3, 3];
    for (let r = 0; r < n; r++) {
      let row = '';
      for (let c = 0; c < n; c++) row += (Math.floor(r / bh) + Math.floor(c / bw)) % 2 ? '🟦' : '🟩';
      lines.push(row);
    }
  } else if (input.game === 'patches') {
    // Each patch gets a colour, so the cut of the grid shows without giving the clues away.
    const puzzle = input.puzzle as { size: number };
    const rects = input.state as number[][];
    const colours = ['🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '🟫'];
    const grid = new Array<string>(puzzle.size * puzzle.size).fill('⬜');
    rects.forEach((r, k) => {
      for (let row = r[0]; row <= r[2]; row++) for (let col = r[1]; col <= r[3]; col++) grid[row * puzzle.size + col] = colours[k % colours.length];
    });
    for (let r = 0; r < puzzle.size; r++) lines.push(grid.slice(r * puzzle.size, r * puzzle.size + puzzle.size).join(''));
  } else if (input.game === 'zip') {
    // The path as colours from start (blue) to finish (red): the shape of the route without its turns.
    const puzzle = input.puzzle as { size: number };
    const path = input.state as number[];
    const heat = ['🟦', '🟩', '🟨', '🟧', '🟥'];
    const colour = new Array<string>(path.length);
    path.forEach((cell, step) => (colour[cell] = heat[Math.min(4, Math.floor((step / path.length) * 5))]));
    for (let r = 0; r < puzzle.size; r++) lines.push(colour.slice(r * puzzle.size, r * puzzle.size + puzzle.size).join(''));
  }

  lines.push('zenigma.ska97homelab.uk');
  return lines.join('\n');
}
