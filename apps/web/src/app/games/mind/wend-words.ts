export interface WendWords {
  /** Every word boards are made from (3 to 11 letters). */
  valid: Set<string>;
  /** Every start of a word (up to its full length), so a search can stop as soon as a path cannot lead anywhere. */
  prefixes: Set<string>;
  /** The words by length, which the puzzles are made from. */
  common: Record<number, string[]>;
}

let loaded: Promise<WendWords> | undefined;

/** The Wend word list is a separate chunk, loaded the first time a Wend board is needed. */
export function loadWendWords(): Promise<WendWords> {
  loaded ??= import('./data/wend-common').then(({ WEND_COMMON }) => buildWendWords(WEND_COMMON.split('\n')));
  return loaded;
}

export function buildWendWords(words: string[]): WendWords {
  const prefixes = new Set<string>();
  const common: Record<number, string[]> = {};
  for (const w of words) {
    for (let i = 1; i <= w.length; i++) prefixes.add(w.slice(0, i));
    (common[w.length] ??= []).push(w);
  }
  return { valid: new Set(words), prefixes, common };
}
