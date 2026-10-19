import { GAME_RULES } from './rules-data';

/**
 * A demo is a short animated walk-through on a small dummy board, like a video that lives inside the app (so it works offline and
 * costs no download). Each frame shows a board (cells as described in cell.ts), says what is happening, optionally says what to do
 * in a given situation (`when`, written "If … → do …"), and moves a finger to the cell being used.
 */
export interface DemoFrame {
  rows: string[][];
  say: string;
  /** A situation and what to do about it: "If … → …". */
  when?: string;
  /** Where the finger goes: [row, column]. */
  point?: [number, number];
  /** The finger drags to this cell (a swipe or a traced word). */
  to?: [number, number];
}

export interface Demo {
  frames: DemoFrame[];
}

const F = (rows: string[][], say: string, when?: string, point?: [number, number], to?: [number, number]): DemoFrame => ({ rows, say, when, point, to });

/** Demos for the mind games. The dummy sets are tiny on purpose: just enough to see what to do. */
export const MIND_DEMOS: Record<string, Demo> = {
  'quick-sums': {
    frames: [
      F([['8 + 5']], 'A sum appears. You have 60 seconds.'),
      F([['#0 8 + 5'], ['11', '?13', '15', '12']], 'Four answers. Work it out and tap the right one.', 'If the sum is big → split it: do the tens first, then the ones.', [1, 1]),
      F([['#0 8 + 5'], ['!11', '+13', '15', '12']], 'A wrong answer costs 3 seconds, so a quick right one beats a fast guess.', 'If you are not sure → look for answers that are clearly too small or too big first.', [1, 1]),
    ],
  },
  'target-number': {
    frames: [
      F([['#1 Target 14'], ['2', '5', '4']], 'Make the target number by combining the numbers you are given.'),
      F([['#1 Target 14'], ['?2', '?5', '4']], 'Pick two numbers and an operation: 2 × 5 makes 10.', 'If the target is large → try × first; it grows fastest.', [1, 0], [1, 1]),
      F([['#1 Target 14'], ['10', '4', '.']], 'The two numbers become 10. Now 10 and 4 are left.'),
      F([['#1 Target 14'], ['+14', '.', '.']], '10 + 4 = 14. One number is left and it equals the target.', 'If you reach a dead end → undo and try another pair. Skip costs 5 seconds.'),
    ],
  },
  'colour-clash': {
    frames: [
      F([['#0 RED']], 'The word says RED but the ink is blue.'),
      F([['#0 RED'], ['?#0 Blue', '#6 Red', '#2 Green']], 'Tap the colour of the ink, not the word.', 'If the word and the ink disagree → ignore the word, say the ink.', [1, 0]),
      F([['#2 BLUE'], ['#0 Blue', '#6 Red', '?#2 Green']], 'Next one: BLUE in green ink. The answer is Green.', 'If you hesitate → say the ink colour in your head before looking at the buttons.', [1, 2]),
    ],
  },
  'odd-one-out': {
    frames: [
      F([['#0 ', '#0 ', '#0 '], ['#0 ', '#0 ', '#0 ']], 'Six tiles. They look the same.'),
      F([['#0 ', '#0 ', '#0 '], ['#0 ', '?#5 ', '#0 ']], 'One is a slightly different shade. Tap it.', 'If you cannot see it → soften your eyes and look at the whole grid, not tile by tile.', [1, 1]),
      F([['#0 ', '#0 ', '#0 '], ['#0 ', '+#5 ', '#0 ']], 'The shades get closer as you go, so stay calm and keep scanning.'),
    ],
  },
  'spot-change': {
    frames: [
      F([['#0 ', '#1 ', '#2 '], ['#3 ', '#4 ', '#5 ']], 'Memorise the colours. They flash for a moment.'),
      F([['.', '.', '.'], ['.', '.', '.']], 'The grid hides.'),
      F([['#0 ', '#1 ', '#2 '], ['#3 ', '?#6 ', '#5 ']], 'It flashes again with one tile changed. Tap the one that is different.', 'If you missed the change → remember the colours by position, like a row of words: top-left blue, top-middle orange…', [1, 1]),
    ],
  },
  'target-tap': {
    frames: [
      F([['#2 ●', '#6 ●', '#2 ●']], 'Circles appear. Some are green, some are not.'),
      F([['?#2 ●', '#6 ●', '?#2 ●']], 'Tap every green circle. Do not tap the others.', 'If a wrong colour appears → leave it. Tapping it costs points.', [0, 0]),
      F([['+#2 ●', '!#6 ●', '+#2 ●']], 'Speed matters, but a wrong tap costs more than a missed one.'),
    ],
  },
  'quick-reflex': {
    frames: [
      F([['#6 Wait…']], 'The screen is red. Wait.'),
      F([['!#6 Too soon']], 'Tapping now restarts the round.', 'If you keep tapping early → watch for the colour, not the clock.'),
      F([['?#2 TAP!']], 'It turns green. Tap as fast as you can. Five rounds; your average is your score.', undefined, [0, 0]),
    ],
  },
  'back-track': {
    frames: [
      F([['B', 'K', 'B']], 'Letters appear one at a time: B, then K, then B.'),
      F([['B', 'K', '?B'], ['Match']], 'This B is the same as two letters ago, so tap Match.', 'If it is the same as the one just before → do not tap. It has to be two back.', [1, 0]),
      F([['K', 'B', '!M'], ['No match']], 'M is not the same as K two back, so no tap. Wrong taps count against you.'),
    ],
  },
  'echo-sequence': {
    frames: [
      F([['#0 ', '#1 '], ['#2 ', '#3 ']], 'Four pads. Watch them light up in order.'),
      F([['?#0 ', '#1 '], ['#2 ', '#3 ']], 'First the top-left pad lights up…'),
      F([['#0 ', '#1 '], ['#2 ', '?#3 ']], '…then the bottom-right. Remember: top-left, bottom-right.'),
      F([['?#0 ', '#1 '], ['#2 ', '?#3 ']], 'Now repeat it by tapping the pads in the same order. It grows by one each round.', 'If the pattern gets long → chunk it in threes, like a phone number.', [0, 0], [1, 1]),
    ],
  },
  'grid-recall': {
    frames: [
      F([['.', '.', '.'], ['.', '.', '.'], ['.', '.', '.']], 'A grid of dark tiles.'),
      F([['?#0 ', '.', '.'], ['.', '?#0 ', '.'], ['.', '.', '?#0 ']], 'Some tiles light up. Remember where they are.'),
      F([['.', '.', '.'], ['.', '.', '.'], ['.', '.', '.']], 'They go dark. Now tap the ones that were lit.', 'If you are not sure about one → think of the shape they made, like a diagonal line.', [0, 0]),
    ],
  },
  'number-recall': {
    frames: [
      F([['4', '8', '1']], 'A number flashes: 481.'),
      F([['.', '.', '.']], 'It disappears.'),
      F([['+4', '+8', '+1']], 'Type it back. Each round adds one digit.', 'If it gets long → say it aloud in your head in groups: 48 – 1.'),
    ],
  },
  'pair-match': {
    frames: [
      F([['.', '.'], ['.', '.']], 'Cards face down. Flip two at a time.'),
      F([['?#0 ★', '?#1 ♥'], ['.', '.']], 'Star and heart do not match. They turn back over: remember where they were.', undefined, [0, 0], [0, 1]),
      F([['#0 ★', '#1 ♥'], ['?#1 ♥', '.']], 'Now you know where the heart is. Find its partner.', 'If you remember a card → use it to make a pair on purpose. Fewer flips is a better score.', [1, 0]),
      F([['#0 ★', '+#1 ♥'], ['+#1 ♥', '.']], 'A pair! It stays face up.'),
    ],
  },
  'anagram-rush': {
    frames: [
      F([['T', 'A', 'C']], 'The letters are mixed up.'),
      F([['?T', 'A', 'C'], ['_', '_', '_']], 'Tap them in the right order to spell the word.', 'If you cannot see it → try pairs that go together (CA, AT) and build out from there.', [0, 0]),
      F([['+C', '+A', '+T']], 'CAT. Next word. Skip costs 5 seconds, so skip only when stuck.'),
    ],
  },
  'missing-letters': {
    frames: [
      F([['S', '_', 'N', '_', 'Y']], 'Two letters are missing from the word.'),
      F([['S', '_', 'N', '_', 'Y'], ['?UN', 'AB', 'OT']], 'Pick the pair that makes a real word.', 'If more than one pair seems to work → check the whole word out loud. Only one is real.', [1, 0]),
      F([['S', '+U', 'N', '+N', 'Y']], 'SUNNY. A wrong answer costs 3 seconds.'),
    ],
  },
  'what-next': {
    frames: [
      F([['2', '4', '6', '8', '?']], 'A number pattern. What comes next?'),
      F([['2', '4', '6', '8', '+10']], 'Each number is 2 more than the one before.', 'If the gaps are not the same → look at the gaps of the gaps, or try doubling and halving.'),
      F([['3', '6', '12', '24', '?'], ['30', '48', '?36', '27']], 'Here each number doubles. 24 × 2 = 48.', 'If it does not add → try multiplying.', [1, 1]),
    ],
  },
  'mental-turn': {
    frames: [
      F([['#0 L']], 'A shape is shown.'),
      F([['#0 L'], ['?#0 ⅃', '#0 Γ', '#0 ┘']], 'Pick the same shape, turned around.', 'If an option looks like a mirror image → it is flipped over, not turned. Pass.', [1, 0]),
      F([['#0 L'], ['!#0 ⅃', '+#0 ⌐', '#0 ┘']], 'Turn the shape in your head one quarter at a time and compare one corner.'),
    ],
  },
  'number-sort': {
    frames: [
      F([['7', '2', '9'], ['4', '1', '8'], ['6', '3', '5']], 'Nine numbers. Tap them from the smallest to the largest.'),
      F([['7', '2', '9'], ['4', '?1', '8'], ['6', '3', '5']], 'Start with the 1…', undefined, [1, 1]),
      F([['7', '?2', '9'], ['4', '+1', '8'], ['6', '3', '5']], '…then 2, then 3. Keep your eyes moving ahead.', 'If you tap a wrong number → it adds 2 seconds. Find the next number before you tap.', [0, 1]),
    ],
  },
  'dot-count': {
    frames: [
      F([['●', '.', '●'], ['.', '●', '.']], 'Dots flash for a second.'),
      F([['.', '.', '.'], ['.', '.', '.']], 'They vanish.'),
      F([['2', '3', '?4', '5']], 'Pick how many there were: 3.', 'If you cannot count them in time → group them in twos and threes instead of one by one.', [0, 1]),
    ],
  },
  opposites: {
    frames: [
      F([['#1 HOT']], 'A word appears.'),
      F([['#1 HOT'], ['?COLD', 'WARM', 'FIRE', 'SUN']], 'Pick its opposite.', 'If two options look right → pick the exact opposite, not just a different word.', [1, 0]),
      F([['#1 EARLY'], ['LATE', 'SOON', 'AFTER', 'DAY']], 'Next one. A wrong answer costs 3 seconds.'),
    ],
  },
  'chain-link': {
    frames: [
      F([['M', 'A', 'N']], 'The first word is given: MAN.'),
      F([['M', 'A', 'N'], ['?M', '_', '_', '_']], 'The next word starts with the letter shown and has one line per letter. It must join the word before: man-made.', 'If you are stuck → say the two words together out loud. Compounds sound natural.', [1, 0]),
      F([['M', 'A', 'N'], ['+M', '+A', '+D', '+E'], ['?', '_', '_', '_', '_']], 'MADE joins MAN. Now the next one has to join MADE… A wrong word or skip costs a heart.', undefined, [2, 0]),
    ],
  },
  pinpoint: {
    frames: [
      F([['#0 Paris']], 'Clue 1: a single word. It is the vaguest one.'),
      F([['#0 Paris', '#0 Rome']], 'A second clue appears each time you guess wrong.'),
      F([['#0 Paris', '#0 Rome', '#0 Oslo'], ['?', 'What links them?']], 'Name what they have in common: capital cities.', 'If you are unsure → guess early for more points (5 on the first clue, down to 1).', [1, 0]),
      F([['+#2 Capital cities', '+5 pts']], 'Solved on the third clue.'),
    ],
  },
  crossclimb: {
    frames: [
      F([['C', 'O', 'L', 'D'], ['_', '_', '_', '_'], ['W', 'A', 'R', 'M']], 'A ladder: the first and last words are given.'),
      F([['C', 'O', 'L', 'D'], ['?C', 'O', 'R', 'D'], ['W', 'A', 'R', 'M']], 'Change exactly one letter at each step: COLD → CORD.', 'If you are stuck → work from both ends towards the middle.', [1, 2]),
      F([['C', 'O', 'L', 'D'], ['+C', '+O', '+R', '+D'], ['+W', '+O', '+R', '+D'], ['W', 'A', 'R', 'M']], 'CORD → WORD → WARM. One letter at a time. A wrong word costs a heart.'),
    ],
  },
  wend: {
    frames: [
      F([['■', 'C', 'A', 'T', '■'], ['D', 'O', 'G', 'S', '■']], 'A grid of letters with grey blocks. Hidden inside are several words, 3 to 11 letters. Monday is small; Sunday is the biggest.'),
      F([['■', '?C', '+A', 'T', '■'], ['D', 'O', 'G', 'S', '■']], 'Drag through touching letters (up, down, left, right) to spell a word.', 'If you are not sure where to start → try a corner or a letter with few neighbours.', [0, 1], [0, 3]),
      F([['■', '+C', '+A', '+T', '■'], ['?D', 'O', 'G', 'S', '■']], 'CAT locks in. Every letter is used exactly once, and the words never cross.', 'If you are stuck → press Hint: it shows the first letter of a word, then the next.', [1, 0], [1, 3]),
    ],
  },
  'word-recall': {
    frames: [
      F([['APPLE', 'RIVER', 'CHAIR']], 'A few words appear for a moment. Remember them.'),
      F([['.', '.', '.']], 'They disappear.'),
      F([['RIVER', 'LAMP', 'APPLE'], ['TRAIN', 'CHAIR', 'BREAD']], 'Now they are mixed in a longer list. Tap the ones you saw.', 'If you remember only some → picture each word as an object in one scene, like a story.', [0, 0]),
      F([['+RIVER', 'LAMP', '+APPLE'], ['TRAIN', '+CHAIR', 'BREAD']], 'All three found. One more word each round, and a wrong pick costs a life.'),
    ],
  },
  'comet-slice': {
    frames: [
      F([['☄', '.', '.'], ['.', '.', '☄'], ['.', '💀', '.']], 'Comets and skulls fall from the sky, each at its own speed.'),
      F([['?☄', '.', '.'], ['.', '.', '?☄'], ['.', '💀', '.']], 'Press and drag through the comets to slice them. Several in one swipe is a combo.', 'If a skull is in the way → swipe around it. Slicing a skull ends the run at once.', [0, 0], [1, 2]),
      F([['.', '.', '.'], ['.', '.', '.'], ['!☄', '.', '.']], 'A comet that reaches the ground costs a heart. You have three.', 'If the comets speed up → keep your swipes short and aim for the middle of each one.'),
    ],
  },
};

/** The demo for a game: written by hand for the mind games, built from the worked example and techniques for the main games. */
export function demoFor(id: string): Demo | null {
  const mind = MIND_DEMOS[id];
  if (mind) return mind;
  const rules = GAME_RULES.find((g) => g.id === id);
  if (!rules) return null;
  const frames: DemoFrame[] = [];
  const pointAt = (rows: string[][]): [number, number] | undefined => {
    for (const mark of ['?', '+']) for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++) if (rows[r][c].startsWith(mark)) return [r, c];
    return undefined;
  };
  let last: string[][] | null = null;
  for (const step of rules.example.steps) {
    const rows: string[][] | null = step.figure?.rows ?? last;
    if (!rows) continue;
    last = rows;
    frames.push({ rows, say: step.text, point: pointAt(rows) });
  }
  for (const t of rules.techniques) {
    if (!t.figure) continue;
    frames.push({ rows: t.figure.rows, say: t.text, when: `If you see this → ${t.title.charAt(0).toLowerCase()}${t.title.slice(1)}`, point: pointAt(t.figure.rows) });
  }
  if (frames.length) frames.unshift({ rows: frames[0].rows, say: `The goal: ${rules.goal}`, point: undefined });
  return frames.length ? { frames } : null;
}
