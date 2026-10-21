import { MindGameId, Skill } from '../catalog';

/** What each mind-training game is about, and how its score is read. Scores are whole numbers, higher is better. */
export interface MindMeta {
  skill: Skill;
  /** One or two sentences: what to do. */
  how: string;
  /** The score that counts as "excellent" (full marks on the skill chart). */
  scale: number;
  /** How the score reads: "23 correct". */
  unit: string;
  /** Overrides the default "score unit" text (for example the reflex game shows milliseconds). */
  format?: (score: number) => string;
}

export const MIND_META: Partial<Record<MindGameId, MindMeta>> = {
  'quick-sums': { skill: 'math', how: 'Pick the right answer to each sum. You have 60 seconds. A wrong answer costs 3 seconds.', scale: 30, unit: 'correct' },
  'target-number': { skill: 'math', how: 'Combine two numbers at a time with + − × until one number is left. Make the target. 90 seconds. Skip costs 5 seconds.', scale: 8, unit: 'solved' },
  'colour-clash': { skill: 'attention', how: 'The word names one colour, but it is written in another. Tap the colour of the ink, not the word. 45 seconds.', scale: 25, unit: 'correct' },
  'odd-one-out': { skill: 'attention', how: 'One tile is a slightly different shade. Tap it. The tiles get closer in colour as you go. 45 seconds.', scale: 20, unit: 'found' },
  'spot-change': { skill: 'attention', how: 'Memorise the grid of colours. It flashes again with one tile changed. Tap the one that changed. Three lives.', scale: 12, unit: 'rounds' },
  'target-tap': { skill: 'attention', how: 'Tap every green circle. Do not tap anything else. 40 shapes, quickly.', scale: 25, unit: 'points' },
  'quick-reflex': { skill: 'speed', how: 'Wait for the screen to turn green, then tap as fast as you can. Five rounds. Tapping early restarts the round.', scale: 750, unit: '', format: (s) => `${1000 - s} ms` },
  'back-track': { skill: 'speed', how: 'Letters appear one at a time. Tap Match when the letter is the same as two letters ago. Wrong taps count against you.', scale: 7, unit: 'points' },
  'echo-sequence': { skill: 'memory', how: 'Watch the pads light up, then repeat the pattern. It grows by one each round.', scale: 12, unit: 'long' },
  'grid-recall': { skill: 'memory', how: 'Some tiles light up. Remember them, then tap them once they go dark. Three lives.', scale: 10, unit: 'levels' },
  'number-recall': { skill: 'memory', how: 'A number flashes on screen. Type it back from memory. It gets one digit longer each time. Two lives.', scale: 10, unit: 'digits' },
  'pair-match': { skill: 'memory', how: 'Flip cards to find the matching pairs in as few flips as you can.', scale: 100, unit: 'points' },
  'anagram-rush': { skill: 'language', how: 'Tap the letters in the right order to spell the word. 60 seconds. Skip costs 5 seconds.', scale: 10, unit: 'words' },
  'missing-letters': { skill: 'language', how: 'Two letters are missing from the word. Pick the pair that makes a real word. 60 seconds. A wrong answer costs 3 seconds.', scale: 15, unit: 'words' },
  'what-next': { skill: 'logic', how: 'Find the rule in the number pattern and pick the number that comes next. 60 seconds. A wrong answer costs 3 seconds.', scale: 12, unit: 'correct' },
  'mental-turn': { skill: 'logic', how: 'A shape is shown. Pick the one that is the same shape turned around. Beware: flipped over is not the same. 60 seconds. A wrong answer costs 3 seconds.', scale: 12, unit: 'correct' },
  'number-sort': { skill: 'speed', how: 'Nine numbers on the board. Tap them from the smallest to the largest. Five boards. A wrong tap adds 2 seconds.', scale: 90, unit: 'points' },
  'dot-count': { skill: 'attention', how: 'Dots flash for a second, then vanish. Pick how many there were. 45 seconds. A wrong answer costs 3 seconds.', scale: 15, unit: 'counted' },
  opposites: { skill: 'language', how: 'A word appears. Pick its opposite from four words. 60 seconds. A wrong answer costs 3 seconds.', scale: 20, unit: 'correct' },
  'chain-link': { skill: 'language', how: 'The first word is given. Fill in each next word so that it joins the one before into a compound word, like MAN and MADE (man-made). It starts with the letter shown and has one line per letter. Chains start at 4 links and grow to 9. A wrong word or a skip costs a life. Three lives.', scale: 30, unit: 'links' },
  pinpoint: { skill: 'language', how: 'Five words share something in common, shown one at a time, vaguest first. Name what they have in common. A wrong guess shows the next clue. Solve it on the first clue for 5 points, down to 1 on the last. Five categories a game.', scale: 20, unit: 'points' },
  crossclimb: { skill: 'language', how: 'A word ladder. The first and last words are given. Fill the rows between, changing exactly one letter from each row to the next, to reach the last word. Any real word that keeps the way open counts. Ladders grow from 2 rows to 5. A wrong word or a skip costs a life. Three lives.', scale: 20, unit: 'rungs' },
  wend: { skill: 'language', how: 'A grid of letters with grey blocks hides words, shown as empty slots under the board. Drag through touching tiles (up, down, left, right) to trace each word. Every letter is used exactly once, and each board has one solution. Start with a letter that has only one neighbour: it must begin or end a word. Hint shows the first letter of a word, then the next. One board a game, scored out of 100: hints and a slow solve cost points. Each win makes the next board bigger.', scale: 100, unit: 'points' },
  'comet-slice': { skill: 'speed', how: 'Comets and skulls fall from the sky, each at its own speed, and everything gets faster the longer you last. Swipe through the comets to collect them, and several in one swipe is a combo. A comet that reaches the ground costs a heart (three hearts). Slice a skull and it is over at once. Beat your best.', scale: 150, unit: 'points' },
  switchyard: { skill: 'attention', how: 'Coloured trains roll in from the top of a rail yard. Tap a round switch to choose which way the track goes, so each train ends up at the station of its own colour. Joiners merge tracks into one. A train at the wrong station costs a life. Three lives. Every round has more trains, closer together and faster, in a bigger yard.', scale: 40, unit: 'trains' },
  'word-recall': { skill: 'memory', how: 'A few words appear for a moment. Then pick them out of a longer list. One more word each round. Three lives.', scale: 7, unit: 'rounds' },
};

export const isMindPlayable = (id: string): id is MindGameId => id in MIND_META;

/** A score as a 0 to 100 mark against the game's "excellent" score. */
export const markOf = (id: string, score: number): number => {
  const meta = MIND_META[id as MindGameId];
  return meta ? Math.max(0, Math.min(100, Math.round((score / meta.scale) * 100))) : 0;
};
