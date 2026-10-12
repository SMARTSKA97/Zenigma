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

  lines.push('zenigma.ska97homelab.uk');
  return lines.join('\n');
}
