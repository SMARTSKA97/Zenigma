import { advance, bombChance, COMET_R, heat, RUN_SECONDS, segmentHitsCircle, SKULL_R, throwBody, throwGap, W } from './comet-slice-engine';

describe('Comet Slice', () => {
  it('detects a swipe through a circle, and one that passes beside it', () => {
    expect(segmentHitsCircle(0, 50, 100, 50, 50, 50, 10)).toBe(true);
    expect(segmentHitsCircle(0, 70, 100, 70, 50, 50, 10)).toBe(false);
    expect(segmentHitsCircle(0, 50, 30, 50, 50, 50, 10)).toBe(false); // stops short
    expect(segmentHitsCircle(50, 50, 50, 50, 55, 50, 10)).toBe(true); // a tap
  });

  it('drops bodies from above the field, each at its own speed, and they all fall past the bottom', () => {
    const speeds = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const b = throwBody(i % 30, Math.random);
      expect(b.y).toBeLessThan(0);
      expect(b.vy).toBeGreaterThan(0);
      expect(b.x).toBeGreaterThanOrEqual(b.r);
      expect(b.x).toBeLessThanOrEqual(W - b.r);
      speeds.add(Math.round(b.vy / 10));
      for (let t = 0; t < 12 && !b.missed; t += 1 / 60) advance(b, 1 / 60);
      expect(b.missed).toBe(true);
    }
    expect(speeds.size).toBeGreaterThan(8);
  });

  it('makes skulls bigger than comets', () => {
    expect(SKULL_R).toBeGreaterThan(COMET_R * 1.4);
    const kinds = Array.from({ length: 200 }, () => throwBody(30, Math.random));
    for (const b of kinds) expect(b.r).toBe(b.kind === 'bomb' ? SKULL_R : COMET_R);
    expect(kinds.some((b) => b.kind === 'bomb')).toBe(true);
  });

  it('gets harder with time but stays within bounds', () => {
    expect(heat(0)).toBe(0);
    expect(heat(1000)).toBe(1);
    expect(throwGap(RUN_SECONDS, () => 0.5)).toBeLessThan(throwGap(0, () => 0.5));
    expect(bombChance(RUN_SECONDS)).toBeGreaterThan(bombChance(0));
    expect(bombChance(RUN_SECONDS)).toBeLessThan(0.5);
  });
});
