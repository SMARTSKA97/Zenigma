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

export interface Variant {
  id: string;
  name: string;
  blurb: string;
}

/** Games that offer more than one kind of practice. Each variant has its own levels, map and progress. Add a variant here to add one. */
export const VARIANTS: Partial<Record<PuzzleGameId, Variant[]>> = {
  sudoku: [
    { id: 'classic', name: 'Classic', blurb: 'The 9 by 9 grid, numbers 1 to 9.' },
    { id: 'mini', name: 'Mini', blurb: 'A quick 6 by 6 grid, numbers 1 to 6.' },
  ],
};

export const variantsOf = (game: string): Variant[] => (isPuzzleGame(game) ? VARIANTS[game] ?? [] : []);

/** The key practice progress and levels are stored under: the game, plus its variant when it has one. */
export const trackOf = (game: string, variant?: string | null): string => (variant ? `${game}-${variant}` : game);

/** Router link to the level map of a game (and variant). */
export const mapLink = (game: string, variant?: string | null): string[] => ['/games', game, ...(variant ? [variant] : []), 'levels'];

/** Router link to play a practice level of a game (and variant). */
export const playLink = (game: string, variant?: string | null): string[] => ['/games', game, ...(variant ? [variant] : [])];

/** Where a practice tile leads: the level map, the variant chooser (Sudoku), or the game itself. */
export const practiceEntry = (id: string): string[] => (!isPuzzleGame(id) ? ['/games', id] : VARIANTS[id] ? ['/games', id] : mapLink(id));

/** Every practice track (a game, or a game's variant) with its game, for loading progress. */
export interface PracticeTrack {
  track: string;
  game: PuzzleGameId;
  variant: string | null;
}
export const PRACTICE_TRACKS: PracticeTrack[] = PUZZLE_GAMES.flatMap((game): PracticeTrack[] => {
  const variants = VARIANTS[game];
  return variants ? variants.map((v) => ({ track: trackOf(game, v.id), game, variant: v.id })) : [{ track: game, game, variant: null }];
});

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
