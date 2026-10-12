export type GameId =
  | 'word-guess'
  | 'queens'
  | 'tango'
  | 'sudoku'
  | 'zip'
  | 'patches'
  | 'pinpoint'
  | 'crossclimb'
  | 'wend'
  | 'comet-slice';

export interface GameInfo {
  id: GameId;
  name: string;
  blurb: string;
  /** The tile colour (an OKLCH hue). */
  hue: number;
  /** Playable now. Games that are not live yet show as "coming soon". */
  live: boolean;
  /** Has a daily challenge and leaderboards. */
  daily: boolean;
}

export const GAMES: GameInfo[] = [
  { id: 'word-guess', name: 'Word Guess', blurb: 'Five letters, six tries.', hue: 160, live: true, daily: true },
  { id: 'queens', name: 'Queens', blurb: 'One queen per row, column and colour.', hue: 330, live: true, daily: true },
  { id: 'tango', name: 'Tango', blurb: 'Suns and moons, never three in a row.', hue: 55, live: true, daily: true },
  { id: 'sudoku', name: 'Sudoku', blurb: 'The classic: 1 to 9, once per row, column and box.', hue: 250, live: true, daily: true },
  { id: 'zip', name: 'Zip', blurb: 'One path through every cell, in order.', hue: 25, live: true, daily: true },
  { id: 'patches', name: 'Patches', blurb: 'Split the grid into matching rectangles.', hue: 300, live: false, daily: false },
  { id: 'pinpoint', name: 'Pinpoint', blurb: 'Name the category from up to five clues.', hue: 200, live: false, daily: false },
  { id: 'crossclimb', name: 'Crossclimb', blurb: 'Climb a word ladder, one letter at a time.', hue: 95, live: false, daily: false },
  { id: 'wend', name: 'Wend', blurb: 'Four hidden words that use every letter.', hue: 275, live: false, daily: false },
  { id: 'comet-slice', name: 'Comet Slice', blurb: 'Slice comets, dodge bombs, keep your lives.', hue: 15, live: false, daily: false },
];

export const gameInfo = (id: string): GameInfo | undefined => GAMES.find((g) => g.id === id);

/** Games with a daily challenge and leaderboards. */
export const DAILY_GAMES = GAMES.filter((g) => g.daily);

export const PUZZLE_GAMES = ['queens', 'tango', 'sudoku', 'zip'] as const;
export type PuzzleGameId = (typeof PUZZLE_GAMES)[number];
export const isPuzzleGame = (id: string): id is PuzzleGameId => (PUZZLE_GAMES as readonly string[]).includes(id);

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LEVELS = ['Easy', 'Easy', 'Medium', 'Medium', 'Hard', 'Hard', 'Expert'];

/** Queens, Tango, Sudoku and Zip dailies get harder through the week, Monday (easiest) to Sunday (hardest). */
export function dailyDifficulty(date: string | null | undefined): { day: string; label: string; step: number } | null {
  if (!date) return null;
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const weekday = (d.getUTCDay() + 6) % 7;
  return { day: DAYS[weekday], label: LEVELS[weekday], step: weekday + 1 };
}
