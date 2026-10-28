import { H, MAX_H, MIN_H, setFieldHeight, advance, BOMB_CHANCE, COMET_R, RUN_SECONDS, segmentHitsCircle, SKULL_R, throwBody, throwGap, throwWave, W } from './comet-slice-engine';

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
      const b = throwBody(Math.random);
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
    const kinds = Array.from({ length: 200 }, () => throwBody(Math.random));
    for (const b of kinds) expect(b.r).toBe(b.kind === 'bomb' ? SKULL_R : COMET_R);
    expect(kinds.some((b) => b.kind === 'bomb')).toBe(true);
  });

  it('has no ramp-up: speed and gaps are random and do not depend on how long you have played', () => {
    expect(throwGap.length).toBe(1);
    const gaps = Array.from({ length: 300 }, () => throwGap(Math.random));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0.3);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(1.5);
    expect(new Set(Array.from({ length: 300 }, () => Math.round(throwBody(Math.random).vy / 10))).size).toBeGreaterThan(15);
    expect(BOMB_CHANCE).toBeLessThan(0.3);
    expect(RUN_SECONDS).toBe(60);
  });

  it('picks random patterns: singles, fans, rain, traps, pairs and mixes', () => {
    const kinds = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const w = throwWave(Math.random);
      kinds.add(w.kind);
      expect(w.bodies.length).toBeGreaterThan(0);
      if (w.kind === 'trap') expect(w.bodies.filter((b) => b.kind === 'bomb')).toHaveLength(1);
      if (w.kind === 'fan' || w.kind === 'rain') expect(w.bodies.every((b) => b.kind === 'comet')).toBe(true);
    }
    expect(kinds.size).toBe(6);
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
      for (const b of throwWave(random).bodies) {
        for (let t = 0; t < 600 && b.y - b.r <= H; t++) {
          advance(b, 0.02);
          expect(b.x).toBeGreaterThanOrEqual(b.r - 0.5);
          expect(b.x).toBeLessThanOrEqual(W - b.r + 0.5);
        }
      }
    }
  });
});
