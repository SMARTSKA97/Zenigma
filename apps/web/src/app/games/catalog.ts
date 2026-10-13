import { LEVEL_COUNTS } from './level-counts.data';

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
  { id: 'patches', name: 'Patches', blurb: 'Split the grid into matching rectangles.', hue: 300, live: true, daily: true },
  { id: 'pinpoint', name: 'Pinpoint', blurb: 'Name the category from up to five clues.', hue: 200, live: false, daily: false },
  { id: 'crossclimb', name: 'Crossclimb', blurb: 'Climb a word ladder, one letter at a time.', hue: 95, live: false, daily: false },
  { id: 'wend', name: 'Wend', blurb: 'Four hidden words that use every letter.', hue: 275, live: false, daily: false },
  { id: 'comet-slice', name: 'Comet Slice', blurb: 'Slice comets, dodge bombs, keep your lives.', hue: 15, live: false, daily: false },
];

export const gameInfo = (id: string): GameInfo | undefined => GAMES.find((g) => g.id === id);

/** Games with a daily challenge and leaderboards. */
export const DAILY_GAMES = GAMES.filter((g) => g.daily);

/** Games with a speed round (five easy levels against a three-minute clock). */
export const SPEED_GAMES = ['queens', 'tango', 'sudoku', 'zip', 'patches'] as const;

export const PUZZLE_GAMES = ['queens', 'tango', 'sudoku', 'zip', 'patches'] as const;
export type PuzzleGameId = (typeof PUZZLE_GAMES)[number];
export const isPuzzleGame = (id: string): id is PuzzleGameId => (PUZZLE_GAMES as readonly string[]).includes(id);

export interface Variant {
  id: string;
  name: string;
  blurb: string;
  /** Not playable yet: shown as "coming soon" on the chooser, and has no levels. */
  soon?: boolean;
  /** Split into difficulty tiers (Easy to Insane): each tier is its own set of levels and map. */
  tiered?: boolean;
}

export interface Tier {
  id: string;
  name: string;
  blurb: string;
}

/** The difficulty tiers of a tiered kind, gentlest first. */
export const TIERS: Tier[] = [
  { id: 'easy', name: 'Easy', blurb: 'Lots of numbers given. Learn the ropes.' },
  { id: 'medium', name: 'Medium', blurb: 'A steady challenge.' },
  { id: 'hard', name: 'Hard', blurb: 'Fewer clues, sharper thinking.' },
  { id: 'challenging', name: 'Challenging', blurb: 'Only for confident solvers.' },
  { id: 'insane', name: 'Insane', blurb: 'As few clues as a puzzle can have.' },
];

/** How many levels a practice track has (it grows every week: see tools/generators/puzzles/grow-levels.mjs). */
export const levelCountOf = (track: string): number => LEVEL_COUNTS[track] ?? 1000;

/** Games that offer more than one kind of practice. Each variant has its own levels, map and progress. Add a variant here to add one. */
export const VARIANTS: Partial<Record<PuzzleGameId, Variant[]>> = {
  sudoku: [
    { id: 'classic', name: 'Classic', blurb: 'The 9 by 9 grid, numbers 1 to 9.', tiered: true },
    { id: 'mini', name: 'Mini', blurb: 'A quick 6 by 6 grid, numbers 1 to 6.', tiered: true },
    { id: 'diagonal', name: 'Diagonal', blurb: 'Classic rules, and both long diagonals hold 1 to 9 as well.' },
    { id: 'knight', name: 'Anti-Knight', blurb: 'Classic rules, and no digit repeats a chess knight\'s move away.' },
    // The kinds seen at Sudoku championships (World Sudoku and Puzzle Championships), on the way.
    { id: 'killer', name: 'Killer', blurb: 'Cages with a sum: the digits in each cage add up to its number, with no repeats.', soon: true },
    { id: 'thermo', name: 'Thermo', blurb: 'Digits climb along every thermometer, from the bulb to the tip.', soon: true },
    { id: 'jigsaw', name: 'Jigsaw', blurb: 'Boxes are irregular shapes instead of squares.', soon: true },
    { id: 'arrow', name: 'Arrow', blurb: 'The digits along an arrow add up to the number in its circle.', soon: true },
    { id: 'sandwich', name: 'Sandwich', blurb: 'Clues give the sum of the digits caught between the 1 and the 9 in a row or column.', soon: true },
    { id: 'consecutive', name: 'Consecutive', blurb: 'A bar between two cells means their digits differ by exactly 1.', soon: true },
    { id: 'even-odd', name: 'Even-Odd', blurb: 'Shaded cells hold only even digits (squares) or only odd digits (circles).', soon: true },
  ],
};

/** The kinds of a game as the player chooses them (Sudoku: Classic, Mini ...). */
export const variantsOf = (game: string): Variant[] => (isPuzzleGame(game) ? VARIANTS[game] ?? [] : []);

/** The ids that levels are stored under: a tiered kind becomes one id per tier ('classic-easy' ...), other kinds keep their id. */
export const leafIds = (game: string): string[] =>
  variantsOf(game)
    .filter((v) => !v.soon)
    .flatMap((v) => (v.tiered ? TIERS.map((t) => `${v.id}-${t.id}`) : [v.id]));

/** Router link to the difficulty chooser of a tiered kind. */
export const kindLink = (game: string, kind: string): string[] => ['/games', game, kind];

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
  return variants ? leafIds(game).map((id) => ({ track: trackOf(game, id), game, variant: id })) : [{ track: game, game, variant: null }];
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

/** A kind of a game that is on the way: shown under "Coming soon" in Practice. */
export interface SoonKind {
  name: string;
  blurb: string;
}

/** What is coming next for the games that are live (Sudoku's championship kinds are on its own page, in VARIANTS). */
export const SOON_KINDS: Partial<Record<GameId, SoonKind[]>> = {
  'word-guess': [
    { name: 'Four Letters', blurb: 'A quick word, four letters and five tries.' },
    { name: 'Six Letters', blurb: 'A longer word, six letters and seven tries.' },
    { name: 'Seven Letters', blurb: 'A big word for big brains.' },
    { name: 'Speed Guess', blurb: 'Solve as many words as you can in three minutes.' },
    { name: 'Duel', blurb: 'The same word, you against a friend.' },
    { name: 'Themed Words', blurb: 'Animals, food, places: every word in a theme.' },
  ],
  queens: [
    { name: 'Mini Queens', blurb: 'Small boards for a quick break.' },
    { name: 'Giant Queens', blurb: 'Bigger boards with more colours.' },
  ],
  tango: [{ name: 'Big Tango', blurb: 'An 8 by 8 board with more clues to chain.' }],
  zip: [{ name: 'Zip Walls', blurb: 'Walls block the path between some cells.' }],
  patches: [{ name: 'Patches Big', blurb: 'Bigger grids with more shapes.' }],
};
