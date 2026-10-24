import { H, MAX_H, MIN_H, setFieldHeight, advance, bombChance, COMET_R, heat, speedUp, RUN_SECONDS, segmentHitsCircle, SKULL_R, throwBody, throwGap, W } from './comet-slice-engine';

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

  it('falls faster and faster the longer you last, with every body at its own speed', () => {
    expect(speedUp(0)).toBe(1);
    expect(speedUp(60)).toBeGreaterThan(speedUp(20));
    expect(speedUp(10000)).toBeLessThan(3.5);
    const slow = Array.from({ length: 200 }, () => throwBody(0, Math.random).vy);
    const fast = Array.from({ length: 200 }, () => throwBody(150, Math.random).vy);
    expect(Math.max(...fast)).toBeGreaterThan(Math.max(...slow) * 1.8);
    expect(new Set(fast.map((v) => Math.round(v / 5))).size).toBeGreaterThan(20);
  });

  it('gets harder with time but stays within bounds', () => {
    expect(heat(0)).toBe(0);
    expect(heat(1000)).toBe(1);
    expect(RUN_SECONDS).toBe(60);
    expect(throwGap(RUN_SECONDS, () => 0.5)).toBeLessThan(throwGap(0, () => 0.5));
    expect(bombChance(RUN_SECONDS)).toBeGreaterThan(bombChance(0));
    expect(bombChance(RUN_SECONDS)).toBeLessThan(0.5);
  });

  it('sizes the field to the screen, within bounds', () => {
    setFieldHeight(10);
    expect(H).toBe(MIN_H);
    setFieldHeight(5000);
    expect(H).toBe(MAX_H);
    setFieldHeight(690.4);
    expect(H).toBe(690);
    setFieldHeight(480);
  });

  it('throws bodies that stay inside the sides all the way down', () => {
    let n = 0;
    const random = (): number => ((n = (n * 7919 + 104729) % 100003) / 100003);
    for (let i = 0; i < 300; i++) {
      const b = throwBody(i % 120, random);
      for (let t = 0; t < 600 && b.y - b.r <= H; t++) {
        advance(b, 0.02);
        expect(b.x).toBeGreaterThanOrEqual(b.r - 0.5);
        expect(b.x).toBeLessThanOrEqual(W - b.r + 0.5);
      }
    }
  });
});
