import evaluateVectors from '../../../../../../tests/vectors/word-guess/evaluate.json';
import hardModeVectors from '../../../../../../tests/vectors/word-guess/hard-mode.json';
import {
  evaluate,
  Guess,
  hardModeProblem,
  keyboardMarks,
  marksFromString,
  marksToString,
  newGame,
  replay,
  shareText,
  submitGuess,
} from './engine';

const anyWord = () => true;

describe('evaluate (shared vectors)', () => {
  for (const c of evaluateVectors.cases) {
    it(`${c.guess} vs ${c.answer} -> ${c.marks}`, () => {
      expect(marksToString(evaluate(c.guess, c.answer))).toBe(c.marks);
    });
  }
});

describe('hard mode (shared vectors)', () => {
  for (const c of hardModeVectors.cases) {
    it(`${c.previous.join(',') || '-'} then ${c.next} (answer ${c.answer})`, () => {
      const previous: Guess[] = c.previous.map((word) => ({ word, marks: marksFromString(marksToString(evaluate(word, c.answer))) }));
      expect(hardModeProblem(previous, c.next)).toEqual(c.problem);
    });
  }
});

describe('playing a game', () => {
  it('wins on the right word and stops accepting guesses', () => {
    const first = submitGuess(newGame('crane'), 'slate', anyWord);
    expect(first.ok && first.state.status).toBe('playing');
    const won = submitGuess((first as { state: ReturnType<typeof newGame> }).state, 'CRANE', anyWord);
    expect(won.ok && won.state.status).toBe('won');
    if (won.ok) expect(submitGuess(won.state, 'slate', anyWord)).toEqual({ ok: false, error: 'game-over' });
  });

  it('loses after six wrong guesses', () => {
    const result = replay('crane', ['slate', 'pious', 'dumpy', 'ghost', 'fishy', 'bluff'], false, anyWord);
    expect(result?.status).toBe('lost');
    expect(result?.guesses).toHaveLength(6);
  });

  it('rejects short words and words that are not in the list without using a try', () => {
    const state = newGame('crane');
    expect(submitGuess(state, 'cat', anyWord)).toEqual({ ok: false, error: 'too-short' });
    expect(submitGuess(state, 'zzzzz', (w) => w !== 'zzzzz')).toEqual({ ok: false, error: 'not-a-word' });
    expect(state.guesses).toHaveLength(0);
  });

  it('enforces hard mode only when it is on', () => {
    const play = (hard: boolean) => replay('crane', ['slate', 'about'], hard, anyWord);
    expect(play(false)).not.toBeNull();
    expect(play(true)).toBeNull();
  });

  it('replay returns null for an illegal move log', () => {
    expect(replay('crane', ['slate', 'zzzzz'], false, (w) => w !== 'zzzzz')).toBeNull();
    expect(replay('crane', ['crane', 'slate'], false, anyWord)).toBeNull(); // guess after winning
  });
});

describe('keyboard marks', () => {
  it('keeps the best mark per letter', () => {
    const guesses = ['slate', 'trace'].map((word) => ({ word, marks: evaluate(word, 'crane') }));
    const marks = keyboardMarks(guesses);
    expect(marks.get('a')).toBe('correct');
    expect(marks.get('t')).toBe('absent');
    expect(marks.get('r')).toBe('correct'); // trace puts r in its right place
  });
});

describe('share text', () => {
  it('shows score, hard-mode star and an emoji grid without letters', () => {
    const state = replay('crane', ['slate', 'crane'], true, anyWord)!;
    const text = shareText(state, 'Zenigma Word Guess');
    expect(text.split('\n')[0]).toBe('Zenigma Word Guess 2/6*');
    expect(text).toContain('⬛⬛🟩⬛🟩');
    expect(text.split('\n').at(-1)).toBe('🟩🟩🟩🟩🟩');
    expect(text.split('\n').slice(2).join('')).not.toMatch(/[a-z]/i); // the grid never reveals letters
  });

  it('uses X when lost and the colour-blind palette on request', () => {
    const lost = replay('crane', ['slate', 'pious', 'dumpy', 'ghost', 'fishy', 'bluff'], false, anyWord)!;
    expect(shareText(lost, 'T')).toMatch(/^T X\/6/);
    expect(shareText(replay('crane', ['crane'], false, anyWord)!, 'T', true)).toContain('🟧🟧🟧🟧🟧');
  });
});
