/**
 * Word Guess rules (the same rules as Wordle): five letters, six tries, only real words, and every letter is marked
 * green (right spot), yellow (in the word, wrong spot) or grey (not in the word). Repeated letters are marked by
 * count: a guess never shows more yellow/green for a letter than the answer actually contains.
 *
 * Pure functions, no Angular. The C# validator on the server implements the same rules and both run against the
 * JSON vectors in tests/vectors/word-guess.
 */

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export type Mark = 'correct' | 'present' | 'absent';
export type Status = 'playing' | 'won' | 'lost';

export interface Guess {
  word: string;
  marks: Mark[];
}

export interface GameState {
  answer: string;
  hard: boolean;
  guesses: Guess[];
  status: Status;
}

export type SubmitError = 'too-short' | 'not-a-word' | 'game-over' | 'hard-mode';

export interface HardModeProblem {
  reason: 'position' | 'missing';
  letter: string;
  /** 1-based position for 'position' problems. */
  index?: number;
}

export type SubmitResult =
  | { ok: true; state: GameState }
  | { ok: false; error: SubmitError; detail?: HardModeProblem };

/** Compact form used in test vectors and share data: c = correct, p = present, a = absent. */
export const marksToString = (marks: Mark[]): string => marks.map((m) => m[0]).join('');
export const marksFromString = (text: string): Mark[] =>
  [...text].map((c) => (c === 'c' ? 'correct' : c === 'p' ? 'present' : 'absent'));

/** Marks a guess against the answer. Greens first, then yellows from the letters the answer still has left over. */
export function evaluate(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array<Mark>(WORD_LENGTH).fill('absent');
  const remaining = new Map<string, number>();

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      marks[i] = 'correct';
    } else {
      remaining.set(answer[i], (remaining.get(answer[i]) ?? 0) + 1);
    }
  }
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (marks[i] === 'correct') continue;
    const left = remaining.get(guess[i]) ?? 0;
    if (left > 0) {
      marks[i] = 'present';
      remaining.set(guess[i], left - 1);
    }
  }
  return marks;
}

/**
 * Hard mode: every revealed hint must be used. Green letters stay in place and every yellow or green letter
 * must appear in the next guess (as many times as it was revealed). Returns the first problem found, or null.
 */
export function hardModeProblem(previous: Guess[], next: string): HardModeProblem | null {
  const last = previous[previous.length - 1];
  if (!last) return null;

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (last.marks[i] === 'correct' && next[i] !== last.word[i]) {
      return { reason: 'position', letter: last.word[i], index: i + 1 };
    }
  }

  const needed = new Map<string, number>();
  last.marks.forEach((mark, i) => {
    if (mark !== 'absent') needed.set(last.word[i], (needed.get(last.word[i]) ?? 0) + 1);
  });
  const available = new Map<string, number>();
  for (const letter of next) available.set(letter, (available.get(letter) ?? 0) + 1);

  for (const [letter, count] of needed) {
    if ((available.get(letter) ?? 0) < count) return { reason: 'missing', letter };
  }
  return null;
}

export function newGame(answer: string, hard = false): GameState {
  return { answer, hard, guesses: [], status: 'playing' };
}

/** Plays one guess. `isWord` says whether a word is in the accepted-words list. */
export function submitGuess(state: GameState, raw: string, isWord: (word: string) => boolean): SubmitResult {
  if (state.status !== 'playing') return { ok: false, error: 'game-over' };

  const word = raw.toLowerCase();
  if (word.length < WORD_LENGTH) return { ok: false, error: 'too-short' };
  if (!isWord(word)) return { ok: false, error: 'not-a-word' };

  if (state.hard) {
    const problem = hardModeProblem(state.guesses, word);
    if (problem) return { ok: false, error: 'hard-mode', detail: problem };
  }

  const marks = evaluate(word, state.answer);
  const guesses = [...state.guesses, { word, marks }];
  const status: Status = word === state.answer ? 'won' : guesses.length >= MAX_GUESSES ? 'lost' : 'playing';
  return { ok: true, state: { ...state, guesses, status } };
}

/** Replays a whole move log from scratch. Returns null if any guess was illegal, which is how the server rejects cheats. */
export function replay(
  answer: string,
  words: string[],
  hard: boolean,
  isWord: (word: string) => boolean,
): GameState | null {
  let state = newGame(answer, hard);
  for (const word of words) {
    const result = submitGuess(state, word, isWord);
    if (!result.ok) return null;
    state = result.state;
  }
  return state;
}

/** Best known mark per letter, for colouring the on-screen keyboard. */
export function keyboardMarks(guesses: Guess[]): Map<string, Mark> {
  const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };
  const best = new Map<string, Mark>();
  for (const { word, marks } of guesses) {
    marks.forEach((mark, i) => {
      const current = best.get(word[i]);
      if (!current || rank[mark] > rank[current]) best.set(word[i], mark);
    });
  }
  return best;
}

const SQUARES: Record<Mark, { normal: string; contrast: string }> = {
  correct: { normal: '🟩', contrast: '🟧' },
  present: { normal: '🟨', contrast: '🟦' },
  absent: { normal: '⬛', contrast: '⬛' },
};

/** The spoiler-free emoji grid people paste into chats. */
export function shareText(state: GameState, title: string, highContrast = false): string {
  const score = state.status === 'won' ? `${state.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const rows = state.guesses.map((g) =>
    g.marks.map((m) => (highContrast ? SQUARES[m].contrast : SQUARES[m].normal)).join(''),
  );
  return [`${title} ${score}${state.hard ? '*' : ''}`, '', ...rows].join('\n');
}
