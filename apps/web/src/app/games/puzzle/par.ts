import { PuzzleGameId } from '../catalog';

/** A reasonable time to solve a level, in milliseconds. Beat it for three stars; take under 1.8 times as long for two. */
export function parMs(game: PuzzleGameId, puzzle: unknown): number {
  switch (game) {
    case 'queens': {
      const size = (puzzle as { size: number }).size;
      return size * size * 1200;
    }
    case 'tango':
      return 70_000;
    case 'sudoku': {
      const givens = (puzzle as { givens: string }).givens;
      const blanks = [...givens].filter((c) => c === '0').length;
      return blanks * (givens.length === 36 ? 3000 : 4500);
    }
    case 'patches': {
      const size = (puzzle as { size: number }).size;
      return size * size * 1400;
    }
    case 'zip': {
      const size = (puzzle as { size: number }).size;
      return size * size * 1500;
    }
  }
}

export function starsFor(ms: number | null, par: number): 0 | 1 | 2 | 3 {
  if (ms === null) return 0;
  return ms <= par ? 3 : ms <= par * 1.8 ? 2 : 1;
}

/** Easy, Medium, Hard or Very hard, from a level's place in its zone of ten. */
export function difficultyOf(level: number): 'Easy' | 'Medium' | 'Hard' | 'Very hard' {
  const position = (level - 1) % 10;
  return position <= 2 ? 'Easy' : position <= 5 ? 'Medium' : position <= 8 ? 'Hard' : 'Very hard';
}
