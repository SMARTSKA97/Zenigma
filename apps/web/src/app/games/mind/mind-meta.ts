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
};

export const isMindPlayable = (id: string): id is MindGameId => id in MIND_META;
