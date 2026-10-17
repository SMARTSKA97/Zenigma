import { PinpointCategory } from './pinpoint-data';

/** Lower case, letters only, without a leading "the" or "types of", and without a trailing "s": "The Planets" and "planet" are the same answer. */
export function normalise(text: string): string {
  let t = text.toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/^(the|a|an|some|types of|kinds of|famous) /, '');
  t = t.replace(/ /g, '');
  return t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t;
}

/** Whether the guess names the category (or one of its other names). */
export function isCorrect(guess: string, category: PinpointCategory): boolean {
  const g = normalise(guess);
  if (g.length < 2) return false;
  return [category.name, ...category.also].some((n) => normalise(n) === g);
}

/** Points for solving at the given clue (1 to 5): 5 for the first clue, 1 for the last. */
export const pointsAt = (clue: number): number => Math.max(1, 6 - clue);
