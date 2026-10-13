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
  | 'comet-slice'
  | MindGameId;

/** Mind-training games on the way, by the skill they train (generic names: they are Zenigma's own takes on classic brain exercises). */
export type MindGameId =
  | 'echo-sequence'
  | 'grid-recall'
  | 'number-recall'
  | 'pair-match'
  | 'colour-clash'
  | 'odd-one-out'
  | 'spot-change'
  | 'target-tap'
  | 'quick-reflex'
  | 'back-track'
  | 'quick-sums'
  | 'target-number'
  | 'anagram-rush'
  | 'missing-letters'
  | 'what-next'
  | 'mental-turn'
  | 'number-sort'
  | 'dot-count'
  | 'opposites'
  | 'word-recall';

/** Where a game sits in the apps: logic puzzles, Sudoku, words or mind training. */
export type Category = 'logic' | 'sudoku' | 'word' | 'mind';
export type Skill = 'memory' | 'attention' | 'speed' | 'math' | 'language' | 'logic';

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
  category: Category;
  /** Mind-training games: the skill they train. */
  skill?: Skill;
}

export const CATEGORIES: { id: Category; name: string; blurb: string }[] = [
  { id: 'logic', name: 'Logic puzzles', blurb: 'Queens, Tango, Zip, Patches and friends.' },
  { id: 'sudoku', name: 'Sudoku', blurb: 'Classic, mini and special rules, Easy to Insane.' },
  { id: 'word', name: 'Words', blurb: 'Guess, climb and find words.' },
  { id: 'mind', name: 'Mind training', blurb: 'Short exercises for memory, focus, speed and maths.' },
];

export const SKILLS: { id: Skill; name: string; emoji: string }[] = [
  { id: 'memory', name: 'Memory', emoji: '🧩' },
  { id: 'attention', name: 'Focus', emoji: '🎯' },
  { id: 'speed', name: 'Speed', emoji: '⚡' },
  { id: 'math', name: 'Maths', emoji: '➕' },
  { id: 'language', name: 'Language', emoji: '🔤' },
  { id: 'logic', name: 'Reasoning', emoji: '🔮' },
];

export const GAMES: GameInfo[] = [
  { id: 'word-guess', name: 'Word Guess', blurb: 'Five letters, six tries.', hue: 160, live: true, daily: true, category: 'word' },
  { id: 'queens', name: 'Queens', blurb: 'One queen per row, column and colour.', hue: 330, live: true, daily: true, category: 'logic' },
  { id: 'tango', name: 'Tango', blurb: 'Suns and moons, never three in a row.', hue: 55, live: true, daily: true, category: 'logic' },
  { id: 'sudoku', name: 'Sudoku', blurb: 'The classic: 1 to 9, once per row, column and box.', hue: 250, live: true, daily: true, category: 'sudoku' },
  { id: 'zip', name: 'Zip', blurb: 'One path through every cell, in order.', hue: 25, live: true, daily: true, category: 'logic' },
  { id: 'patches', name: 'Patches', blurb: 'Split the grid into matching rectangles.', hue: 300, live: true, daily: true, category: 'logic' },
  { id: 'pinpoint', name: 'Pinpoint', blurb: 'Name the category from up to five clues.', hue: 200, live: false, daily: false, category: 'word' },
  { id: 'crossclimb', name: 'Crossclimb', blurb: 'Climb a word ladder, one letter at a time.', hue: 95, live: false, daily: false, category: 'word' },
  { id: 'wend', name: 'Wend', blurb: 'Four hidden words that use every letter.', hue: 275, live: false, daily: false, category: 'word' },
  { id: 'comet-slice', name: 'Comet Slice', blurb: 'Slice comets, dodge bombs, keep your lives.', hue: 15, live: false, daily: false, category: 'mind', skill: 'speed' },
  { id: 'echo-sequence', name: 'Echo Sequence', blurb: 'Watch a pattern of lights, then repeat it. It grows by one each round.', hue: 120, live: true, daily: false, category: 'mind', skill: 'memory' },
  { id: 'grid-recall', name: 'Grid Recall', blurb: 'Memorise which tiles lit up, then tap them from memory.', hue: 140, live: true, daily: false, category: 'mind', skill: 'memory' },
  { id: 'number-recall', name: 'Number Recall', blurb: 'See a number for a moment, then type it back.', hue: 180, live: true, daily: false, category: 'mind', skill: 'memory' },
  { id: 'pair-match', name: 'Pair Match', blurb: 'Flip cards and find every matching pair in as few flips as you can.', hue: 210, live: true, daily: false, category: 'mind', skill: 'memory' },
  { id: 'colour-clash', name: 'Colour Clash', blurb: 'The word says one colour, the ink shows another. Tap the ink.', hue: 20, live: true, daily: false, category: 'mind', skill: 'attention' },
  { id: 'odd-one-out', name: 'Odd One Out', blurb: 'Spot the one tile that is different, before time runs out.', hue: 70, live: true, daily: false, category: 'mind', skill: 'attention' },
  { id: 'spot-change', name: 'Spot the Change', blurb: 'Two scenes flash by. Find what changed.', hue: 100, live: true, daily: false, category: 'mind', skill: 'attention' },
  { id: 'target-tap', name: 'Target Tap', blurb: 'Tap the right shapes, ignore the wrong ones.', hue: 335, live: true, daily: false, category: 'mind', skill: 'attention' },
  { id: 'quick-reflex', name: 'Quick Reflex', blurb: 'Tap the moment the screen changes. How fast are you?', hue: 10, live: true, daily: false, category: 'mind', skill: 'speed' },
  { id: 'back-track', name: 'Back Track', blurb: 'Is this the same as two steps ago? A classic working-memory workout.', hue: 230, live: true, daily: false, category: 'mind', skill: 'speed' },
  { id: 'quick-sums', name: 'Quick Sums', blurb: 'Answer as many sums as you can before the clock runs out.', hue: 40, live: true, daily: false, category: 'mind', skill: 'math' },
  { id: 'target-number', name: 'Target Number', blurb: 'Combine the numbers you are given to reach the target.', hue: 60, live: true, daily: false, category: 'mind', skill: 'math' },
  { id: 'anagram-rush', name: 'Anagram Rush', blurb: 'Unscramble the letters into a word, fast.', hue: 165, live: true, daily: false, category: 'mind', skill: 'language' },
  { id: 'missing-letters', name: 'Missing Letters', blurb: 'Fill in the blanks to complete the word.', hue: 190, live: true, daily: false, category: 'mind', skill: 'language' },
  { id: 'what-next', name: 'What Comes Next', blurb: 'Find the rule and pick the piece that comes next in the pattern.', hue: 285, live: true, daily: false, category: 'mind', skill: 'logic' },
  { id: 'mental-turn', name: 'Mental Turn', blurb: 'Which shape is the same one, just turned around?', hue: 310, live: true, daily: false, category: 'mind', skill: 'logic' },
  { id: 'number-sort', name: 'Number Sort', blurb: 'Tap nine numbers from smallest to largest, as fast as you can.', hue: 50, live: true, daily: false, category: 'mind', skill: 'speed' },
  { id: 'dot-count', name: 'Dot Count', blurb: 'Dots flash for a second. How many were there?', hue: 95, live: true, daily: false, category: 'mind', skill: 'attention' },
  { id: 'opposites', name: 'Opposites', blurb: 'Pick the word that means the opposite.', hue: 200, live: true, daily: false, category: 'mind', skill: 'language' },
  { id: 'word-recall', name: 'Word Recall', blurb: 'Remember a few words, then pick them out of a list.', hue: 150, live: true, daily: false, category: 'mind', skill: 'memory' },
];

/** Mind-training games that can be played now (the rest of them are still coming soon). */
export const MIND_LIVE: readonly MindGameId[] = ['quick-sums', 'target-number', 'colour-clash', 'odd-one-out', 'spot-change', 'target-tap', 'quick-reflex', 'back-track', 'echo-sequence', 'grid-recall', 'number-recall', 'pair-match', 'anagram-rush', 'missing-letters', 'what-next', 'mental-turn', 'number-sort', 'dot-count', 'opposites', 'word-recall'];

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
  { id: 'easy', name: 'Easy', blurb: 'Small boards and plenty of help. Learn the ropes.' },
  { id: 'medium', name: 'Medium', blurb: 'A steady challenge.' },
  { id: 'hard', name: 'Hard', blurb: 'Less help, sharper thinking.' },
  { id: 'challenging', name: 'Challenging', blurb: 'Only for confident solvers.' },
  { id: 'insane', name: 'Insane', blurb: 'The biggest boards with the least help.' },
];

/** How many levels a practice track has (it grows every week: see tools/generators/puzzles/grow-levels.mjs). */
export const levelCountOf = (track: string): number => LEVEL_COUNTS[track] ?? 1000;

/** Games that offer more than one kind of practice. Each variant has its own levels, map and progress. Add a variant here to add one. */
export const VARIANTS: Partial<Record<PuzzleGameId, Variant[]>> = {
  sudoku: [
    { id: 'classic', name: 'Classic', blurb: 'The 9 by 9 grid, numbers 1 to 9.', tiered: true },
    { id: 'mini', name: 'Mini', blurb: 'A quick 6 by 6 grid, numbers 1 to 6.', tiered: true },
    { id: 'diagonal', name: 'Diagonal', blurb: 'Classic rules, and both long diagonals hold 1 to 9 as well.' },
    { id: 'windoku', name: 'Windoku', blurb: 'Classic rules, and four extra shaded 3×3 windows hold 1 to 9 too.' },
    { id: 'disjoint', name: 'Disjoint Groups', blurb: 'Classic rules, and the cells in the same spot of every box (all top-lefts, all centres…) hold 1 to 9.' },
    { id: 'knight', name: 'Anti-Knight', blurb: 'Classic rules, and no digit repeats a chess knight\'s move away.' },
    // The kinds seen at Sudoku championships (World Sudoku and Puzzle Championships), on the way.
    { id: 'killer', name: 'Killer', blurb: 'Cages with a sum: the digits in each cage add up to its number, with no repeats.' },
    { id: 'thermo', name: 'Thermo', blurb: 'Digits climb along every thermometer, from the bulb to the tip.' },
    { id: 'jigsaw', name: 'Jigsaw', blurb: 'Boxes are irregular shapes instead of squares.' },
    { id: 'arrow', name: 'Arrow', blurb: 'The digits along an arrow add up to the number in its circle.' },
    { id: 'sandwich', name: 'Sandwich', blurb: 'Clues give the sum of the digits caught between the 1 and the 9 in a row or column.' },
    { id: 'consecutive', name: 'Consecutive', blurb: 'A bar between two cells means their digits differ by exactly 1.' },
    { id: 'even-odd', name: 'Even-Odd', blurb: 'Shaded cells hold only even digits (circles) or only odd digits (squares).' },
  ],
  // The other games have one kind with the same five difficulties as Sudoku, so they go straight to the difficulty chooser.
  queens: [{ id: 'classic', name: 'Classic', blurb: 'One queen in every row, column and colour.', tiered: true }],
  tango: [{ id: 'classic', name: 'Classic', blurb: 'Fill the grid with suns and moons.', tiered: true }],
  zip: [
    { id: 'classic', name: 'Classic', blurb: 'One path through every cell, in number order.', tiered: true },
    { id: 'walls', name: 'Walls', blurb: 'Walls stand between some cells, and the path may not cross them.' },
    { id: 'holes', name: 'Blocked cells', blurb: 'Some cells are blocked. The path goes around them and covers all the rest.' },
  ],
  patches: [
    { id: 'classic', name: 'Classic', blurb: 'Cut the grid into rectangles that match their numbers.', tiered: true },
    { id: 'shapes', name: 'Shapes only', blurb: 'Many numbers are hidden. A clue shows only the shape of its patch, and you work out the size.' },
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
export const practiceEntry = (id: string): string[] => {
  if (!isPuzzleGame(id)) return GAMES.find((g) => g.id === id)?.category === 'mind' ? ['/mind', id] : ['/games', id];
  const variants = VARIANTS[id];
  if (!variants) return mapLink(id);
  // A game with one tiered kind has nothing to choose but the difficulty.
  return variants.length === 1 && variants[0].tiered ? kindLink(id, variants[0].id) : ['/games', id];
};

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
  sudoku: [
    { name: 'Anti-King', blurb: 'Classic rules, and no digit repeats a king’s step away, diagonals included.' },
    { name: 'Renban', blurb: 'Purple lines hold a run of consecutive digits, in any order.' },
    { name: 'Little Killer', blurb: 'Arrows outside the grid give the sum along a diagonal.' },
  ],
  queens: [
    { name: 'Mini Queens', blurb: 'Small boards for a quick break.' },
    { name: 'Giant Queens', blurb: 'Bigger boards with more colours.' },
  ],
  tango: [{ name: 'Big Tango', blurb: 'An 8 by 8 board with more clues to chain.' }],
};

/** Everything on the way for a live game: its own coming-soon kinds plus the variants not playable yet. */
export const soonKindsOf = (game: string): SoonKind[] => [
  ...(SOON_KINDS[game as GameId] ?? []),
  ...variantsOf(game)
    .filter((v) => v.soon)
    .map((v) => ({ name: v.name, blurb: v.blurb })),
];
