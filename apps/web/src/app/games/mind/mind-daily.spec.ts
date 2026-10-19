import { mindSetFor } from './mind-daily';
import { MIND_META } from './mind-meta';

describe('mind daily set', () => {
  it('is the same for a given day and picks one game from every skill', () => {
    const a = mindSetFor('2026-10-13');
    expect(mindSetFor('2026-10-13')).toEqual(a);
    expect(a).toHaveLength(6);
    expect(new Set(a.map((g) => MIND_META[g]!.skill)).size).toBe(6);
  });

  it('changes from day to day', () => {
    const days = Array.from({ length: 14 }, (_, i) => mindSetFor(`2026-10-${String(i + 1).padStart(2, '0')}`).join());
    expect(new Set(days).size).toBeGreaterThan(5);
  });

  it('never puts Comet Slice in the daily set, as it has a daily of its own', () => {
    for (let i = 1; i <= 28; i++) expect(mindSetFor(`2026-10-${String(i).padStart(2, '0')}`)).not.toContain('comet-slice');
  });
});
