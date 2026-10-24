import { streakShare } from './streak-share';

describe('streakShare', () => {
  it('names the player and keeps a plain line for guests', () => {
    expect(streakShare(7, '  Asha ').streakCard.name).toBe('Asha');
    expect(streakShare(7, null).streakCard.name).toBe('Zenigma player');
  });

  it('writes the streak into the text, with the best only when it is higher', () => {
    expect(streakShare(7, 'A', 12).text).toContain('7-day streak');
    expect(streakShare(7, 'A', 12).text).toContain('best 12');
    expect(streakShare(7, 'A', 7).text).not.toContain('best');
  });
});
