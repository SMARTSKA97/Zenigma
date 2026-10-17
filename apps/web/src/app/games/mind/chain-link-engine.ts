import { COMPOUNDS, Compounds } from './chain-link-data';

/** A chain of words where each neighbouring pair joins into a compound word. The first word is shown; the rest are the player's to find. */
export interface Chain {
  words: string[];
}

/** Whether `first` and `second` join into a compound word. */
export const joins = (first: string, second: string, graph: Compounds = COMPOUNDS): boolean => graph.get(first)?.has(second) === true;

/** How a pair is written, such as "sunflower" or "ice cream". */
export const written = (first: string, second: string, graph: Compounds = COMPOUNDS): string => graph.get(first)?.get(second) ?? first + second;

/**
 * Whether `guess` is a good word for the blank after `previous`. It must join with the word before, and with the word that is
 * meant to come next, so a different but valid answer never leaves the rest of the chain unsolvable.
 */
export function accepts(previous: string, guess: string, next: string | undefined, graph: Compounds = COMPOUNDS): boolean {
  return joins(previous, guess, graph) && (next === undefined || joins(guess, next, graph));
}

/** A random chain with `links` words after the first one (so `links + 1` words), or null if none was found. */
export function makeChain(links: number, random: () => number = Math.random, graph: Compounds = COMPOUNDS, avoid: ReadonlySet<string> = new Set()): Chain | null {
  const starts = [...graph.keys()].filter((w) => !avoid.has(w));
  for (let attempt = 0; attempt < 60; attempt++) {
    const start = starts[Math.floor(random() * starts.length)];
    const path = walk([start], links, random, graph);
    if (path) return { words: path };
  }
  return null;
}

function walk(path: string[], links: number, random: () => number, graph: Compounds): string[] | null {
  if (path.length === links + 1) return path;
  const options = [...(graph.get(path[path.length - 1])?.keys() ?? [])].filter((w) => !path.includes(w));
  // Visit the options in a random order, giving up on a dead end and trying the next.
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  for (const next of options) {
    const found = walk([...path, next], links, random, graph);
    if (found) return found;
  }
  return null;
}

/** How many words (after the first) the chain of a given round has: 2, 3, 4, 5, then 6 for every round after. */
export const linksForRound = (round: number): number => Math.min(6, 1 + round);
