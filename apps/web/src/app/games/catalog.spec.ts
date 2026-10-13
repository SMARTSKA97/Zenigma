import { GAMES, MIND_LIVE, mapLink, playLink, PRACTICE_TRACKS, practiceEntry, soonKindsOf, trackOf, variantsOf } from './catalog';

describe('practice tracks', () => {
  it('names a track after its game and variant', () => {
    expect(trackOf('sudoku', 'mini-easy')).toBe('sudoku-mini-easy');
    expect(trackOf('queens')).toBe('queens');
    expect(trackOf('queens', null)).toBe('queens');
  });

  it('gives Sudoku its kinds, the logic games one tiered Classic kind, and Word Guess none', () => {
    expect(variantsOf('sudoku').filter((v) => !v.soon).map((v) => v.id)).toEqual(['classic', 'mini', 'diagonal', 'windoku', 'disjoint', 'knight', 'killer', 'thermo', 'jigsaw', 'arrow', 'sandwich', 'consecutive', 'even-odd']);
    for (const g of ['queens', 'tango', 'zip', 'patches']) expect(variantsOf(g).map((v) => v.id)).toEqual(['classic']);
    expect(variantsOf('word-guess')).toEqual([]);
  });

  it('lists one track per variant', () => {
    const tiers = ['easy', 'medium', 'hard', 'challenging', 'insane'];
    expect(PRACTICE_TRACKS.map((t) => t.track)).toEqual([
      ...['queens', 'tango'].flatMap((g) => tiers.map((t) => `${g}-classic-${t}`)),
      ...['classic', 'mini'].flatMap((k) => tiers.map((t) => `sudoku-${k}-${t}`)),
      'sudoku-diagonal',
      'sudoku-windoku',
      'sudoku-disjoint',
      'sudoku-knight',
      ...['killer', 'thermo', 'jigsaw', 'arrow', 'sandwich', 'consecutive', 'even-odd'].map((k) => `sudoku-${k}`),
      ...['zip', 'patches'].flatMap((g) => tiers.map((t) => `${g}-classic-${t}`)),
    ]);
  });

  it('links to the map and the game', () => {
    expect(mapLink('sudoku', 'mini-hard')).toEqual(['/games', 'sudoku', 'mini-hard', 'levels']);
    expect(mapLink('zip')).toEqual(['/games', 'zip', 'levels']);
    expect(playLink('sudoku', 'classic-insane')).toEqual(['/games', 'sudoku', 'classic-insane']);
  });

  it('sends Sudoku to the chooser and other games straight to their map', () => {
    expect(practiceEntry('sudoku')).toEqual(['/games', 'sudoku']);
    expect(practiceEntry('queens')).toEqual(['/games', 'queens', 'classic']);
    expect(practiceEntry('word-guess')).toEqual(['/games', 'word-guess']);
  });

  it('sorts every game into a category and marks only the finished mind games as live', () => {
    expect(GAMES.every((g) => g.category)).toBe(true);
    const mind = GAMES.filter((g) => g.category === 'mind');
    expect(mind.length).toBeGreaterThanOrEqual(12);
    expect(mind.every((g) => !g.daily && g.skill)).toBe(true);
    expect(mind.filter((g) => g.live).map((g) => g.id).sort()).toEqual([...MIND_LIVE].sort());
    expect(mind.some((g) => !g.live)).toBe(true);
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(GAMES.length);
  });

  it('lists what is coming soon for a live game, including Sudoku kinds that are still planned', () => {
    expect(soonKindsOf('sudoku').map((k) => k.name)).toContain('Renban');
    expect(soonKindsOf('word-guess').length).toBeGreaterThan(0);
    expect(soonKindsOf('pinpoint')).toEqual([]);
  });
});
