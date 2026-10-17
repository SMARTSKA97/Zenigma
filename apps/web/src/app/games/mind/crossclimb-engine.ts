/** Words grouped by "pattern with one letter hidden" (c_ld), so a word's neighbours are found without comparing every pair. */
export type Index = ReadonlyMap<string, readonly string[]>;

export function buildIndex(words: Iterable<string>): Index {
  const index = new Map<string, string[]>();
  for (const w of words) {
    for (let i = 0; i < w.length; i++) {
      const key = w.slice(0, i) + '_' + w.slice(i + 1);
      const list = index.get(key);
      if (list) list.push(w);
      else index.set(key, [w]);
    }
  }
  return index;
}

/** Whether two words of the same length differ in exactly one letter. */
export function oneApart(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++diff > 1) return false;
  return diff === 1;
}

export function neighbours(word: string, index: Index): string[] {
  const out = new Set<string>();
  for (let i = 0; i < word.length; i++) {
    for (const w of index.get(word.slice(0, i) + '_' + word.slice(i + 1)) ?? []) if (w !== word) out.add(w);
  }
  return [...out];
}

/** How many steps every reachable word is from `target` (the target itself is 0). */
export function distancesTo(target: string, index: Index): Map<string, number> {
  const dist = new Map<string, number>([[target, 0]]);
  let frontier = [target];
  while (frontier.length > 0) {
    const next: string[] = [];
    for (const w of frontier) {
      for (const n of neighbours(w, index)) {
        if (!dist.has(n)) {
          dist.set(n, dist.get(w)! + 1);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

export interface Ladder {
  /** The first word, then `blanks` words to find, then the last word. */
  words: string[];
}

/** A ladder of common words: `blanks` words between a given first and last word, each one letter from the next. */
export function makeLadder(blanks: number, common: readonly string[], index: Index, random: () => number = Math.random): Ladder | null {
  const commonSet = new Set(common);
  for (let attempt = 0; attempt < 200; attempt++) {
    const path = [common[Math.floor(random() * common.length)]];
    while (path.length < blanks + 2) {
      const options = neighbours(path[path.length - 1], index).filter((w) => commonSet.has(w) && !path.includes(w));
      if (options.length === 0) break;
      path.push(options[Math.floor(random() * options.length)]);
    }
    if (path.length === blanks + 2 && !oneApart(path[0], path[path.length - 1])) return { words: path };
  }
  return null;
}

/**
 * Whether `guess` is a good next row: a real word, one letter from the row above, not used already, and still close enough to the
 * last word to arrive there in the rows that remain (`left` rows to fill after this one). The last row must be one letter from the end.
 */
export function accepts(
  guess: string,
  above: string,
  used: readonly string[],
  end: string,
  left: number,
  valid: ReadonlySet<string>,
  distToEnd: ReadonlyMap<string, number>,
): boolean {
  if (!valid.has(guess) || !oneApart(guess, above) || used.includes(guess) || guess === end) return false;
  if (left === 0) return oneApart(guess, end);
  const d = distToEnd.get(guess);
  return d !== undefined && d <= left + 1;
}

/** How many blanks the ladder of a round has: 2, 3, 4, then 5 for every round after. */
export const blanksForRound = (round: number): number => Math.min(5, 1 + round);
