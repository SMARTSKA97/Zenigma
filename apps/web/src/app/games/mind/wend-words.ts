export interface WendWords {
  /** Every word a player may trace. */
  valid: Set<string>;
  /** Every start of a valid word (up to its full length), so a search can stop as soon as a path cannot lead anywhere. */
  prefixes: Set<string>;
  /** Everyday words by length (3 to 6), which the puzzles are made from. */
  common: Record<number, string[]>;
}

let loaded: Promise<WendWords> | undefined;

/** The Wend word lists are a separate chunk, loaded the first time a Wend board is needed. */
export function loadWendWords(): Promise<WendWords> {
  loaded ??= (async () => {
    const [{ WEND_VALID }, { WEND_COMMON }] = await Promise.all([import('./data/wend-valid'), import('./data/wend-common')]);
    return buildWendWords(WEND_VALID.split('\n'), WEND_COMMON.split('\n'));
  })();
  return loaded;
}

export function buildWendWords(valid: string[], common: string[]): WendWords {
  const prefixes = new Set<string>();
  for (const w of valid) for (let i = 1; i <= w.length; i++) prefixes.add(w.slice(0, i));
  const byLength: Record<number, string[]> = { 3: [], 4: [], 5: [], 6: [] };
  for (const w of common) byLength[w.length]?.push(w);
  return { valid: new Set(valid), prefixes, common: byLength };
}
