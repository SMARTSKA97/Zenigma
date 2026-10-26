import { levelFromXp, titleOf } from './player.service';

describe('player level', () => {
  it('starts at level 1 with nothing', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, span: 40 });
  });
  it('moves up on the quadratic curve', () => {
    expect(levelFromXp(39).level).toBe(1);
    expect(levelFromXp(40)).toEqual({ level: 2, into: 0, span: 120 });
    expect(levelFromXp(160).level).toBe(3);
    expect(levelFromXp(3240).level).toBe(10);
  });
  it('never goes negative', () => {
    expect(levelFromXp(-5).level).toBe(1);
  });
  it('earns titles as it climbs', () => {
    expect(titleOf(1)).toBe('Cadet');
    expect(titleOf(6)).toBe('Puzzler');
    expect(titleOf(99)).toBe('Grandmaster');
  });
});
