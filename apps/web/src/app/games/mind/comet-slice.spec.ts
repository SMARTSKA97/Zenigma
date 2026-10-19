import { advance, bombChance, H, heat, RUN_SECONDS, segmentHitsCircle, throwBody, throwGap } from './comet-slice-engine';

describe('Comet Slice', () => {
  it('detects a swipe through a circle, and one that passes beside it', () => {
    expect(segmentHitsCircle(0, 50, 100, 50, 50, 50, 10)).toBe(true);
    expect(segmentHitsCircle(0, 70, 100, 70, 50, 50, 10)).toBe(false);
    expect(segmentHitsCircle(0, 50, 30, 50, 50, 50, 10)).toBe(false); // stops short
    expect(segmentHitsCircle(50, 50, 50, 50, 55, 50, 10)).toBe(true); // a tap
  });

  it('throws bodies upwards from below the field that rise and then fall back past the bottom', () => {
    for (let i = 0; i < 50; i++) {
      const b = throwBody(0, Math.random);
      expect(b.y).toBeGreaterThan(H);
      expect(b.vy).toBeLessThan(0);
      let top = b.y;
      for (let t = 0; t < 6 && !b.missed; t += 1 / 60) {
        advance(b, 1 / 60);
        top = Math.min(top, b.y);
      }
      expect(top).toBeLessThan(H * 0.55);
      expect(b.missed).toBe(true);
    }
  });

  it('gets harder with time but stays within bounds', () => {
    expect(heat(0)).toBe(0);
    expect(heat(1000)).toBe(1);
    expect(throwGap(RUN_SECONDS, () => 0.5)).toBeLessThan(throwGap(0, () => 0.5));
    expect(bombChance(RUN_SECONDS)).toBeGreaterThan(bombChance(0));
    expect(bombChance(RUN_SECONDS)).toBeLessThan(0.5);
  });
});
