import { mapLink, playLink, PRACTICE_TRACKS, practiceEntry, trackOf, variantsOf } from './catalog';

describe('practice tracks', () => {
  it('names a track after its game and variant', () => {
    expect(trackOf('sudoku', 'mini-easy')).toBe('sudoku-mini-easy');
    expect(trackOf('queens')).toBe('queens');
    expect(trackOf('queens', null)).toBe('queens');
  });

  it('gives Sudoku a classic and a mini variant, and no other game variants', () => {
    expect(variantsOf('sudoku').filter((v) => !v.soon).map((v) => v.id)).toEqual(['classic', 'mini']);
    expect(variantsOf('queens')).toEqual([]);
    expect(variantsOf('word-guess')).toEqual([]);
  });

  it('lists one track per variant', () => {
    const tiers = ['easy', 'medium', 'hard', 'challenging', 'insane'];
    expect(PRACTICE_TRACKS.map((t) => t.track)).toEqual([
      'queens',
      'tango',
      ...['classic', 'mini'].flatMap((k) => tiers.map((t) => `sudoku-${k}-${t}`)),
      'zip',
      'patches',
    ]);
  });

  it('links to the map and the game', () => {
    expect(mapLink('sudoku', 'mini-hard')).toEqual(['/games', 'sudoku', 'mini-hard', 'levels']);
    expect(mapLink('zip')).toEqual(['/games', 'zip', 'levels']);
    expect(playLink('sudoku', 'classic-insane')).toEqual(['/games', 'sudoku', 'classic-insane']);
  });

  it('sends Sudoku to the chooser and other games straight to their map', () => {
    expect(practiceEntry('sudoku')).toEqual(['/games', 'sudoku']);
    expect(practiceEntry('queens')).toEqual(['/games', 'queens', 'levels']);
    expect(practiceEntry('word-guess')).toEqual(['/games', 'word-guess']);
  });
});
