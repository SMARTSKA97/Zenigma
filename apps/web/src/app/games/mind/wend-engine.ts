const A = 'a'.charCodeAt(0);

/** Letter counts of a word as 26 numbers. */
export function counts(word: string): number[] {
  const c = new Array<number>(26).fill(0);
  for (const ch of word) c[ch.charCodeAt(0) - A]++;
  return c;
}

const fits = (word: number[], pool: number[]): boolean => word.every((n, i) => n <= pool[i]);
const minus = (pool: number[], word: number[]): number[] => pool.map((n, i) => n - word[i]);
const total = (pool: number[]): number => pool.reduce((a, b) => a + b, 0);

/** Candidate words with their letter counts, so the search does not recount them. */
export interface Candidate {
  word: string;
  counts: number[];
}
export const candidatesOf = (words: Iterable<string>): Candidate[] => [...words].map((word) => ({ word, counts: counts(word) }));

/**
 * Whether the letters in `pool` can all be used up by exactly `wordsLeft` real words (each as long as `size`).
 * It tries each real word that fits the pool, so it is quick: a 15-letter pool has only a few dozen.
 */
export function canFinish(pool: number[], wordsLeft: number, size: number, candidates: readonly Candidate[], memo = new Map<string, boolean>()): boolean {
  if (wordsLeft === 0) return total(pool) === 0;
  if (total(pool) !== wordsLeft * size) return false;
  const key = pool.join(',') + '|' + wordsLeft;
  const known = memo.get(key);
  if (known !== undefined) return known;
  // Only words that fit this pool can fit any smaller pool inside it, so the list shrinks as the search goes deeper.
  const usable = candidates.filter((c) => fits(c.counts, pool));
  let ok = false;
  for (const c of usable) {
    if (canFinish(minus(pool, c.counts), wordsLeft - 1, size, usable, memo)) {
      ok = true;
      break;
    }
  }
  memo.set(key, ok);
  return ok;
}

/** The pool left when `word` is taken out of it, or null if the pool cannot spell it. */
export function take(pool: number[], word: string): number[] | null {
  const w = counts(word);
  return fits(w, pool) ? minus(pool, w) : null;
}

export interface Puzzle {
  /** The words the letters were made from (other splits may exist). */
  words: string[];
  /** All the letters, shuffled. */
  letters: string[];
}

export function shuffle<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Four distinct common words whose letters are mixed up together. */
export function makePuzzle(common: readonly string[], howMany = 4, random: () => number = Math.random): Puzzle {
  const words = new Set<string>();
  while (words.size < howMany) words.add(common[Math.floor(random() * common.length)]);
  const list = [...words];
  return { words: list, letters: shuffle(list.join('').split(''), random) };
}
