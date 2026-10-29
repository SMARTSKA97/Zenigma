import { COMET_SIZES, DAILY_TARGET, H, levelForDate, setLevel, TUNES, MAX_H, MIN_H, setFieldHeight, advance, BOMB_CHANCE, COMET_R, RUN_SECONDS, segmentHitsCircle, SKULL_R, throwBody, throwGap, throwWave, W } from './comet-slice-engine';

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

  it('makes skulls bigger than comets, and comets come in three sizes', () => {
    expect(SKULL_R).toBeGreaterThan(COMET_R * 1.4);
    expect(COMET_SIZES.small.r).toBeLessThan(COMET_SIZES.medium.r);
    expect(COMET_SIZES.medium.r).toBeLessThan(COMET_SIZES.normal.r);
    expect(COMET_SIZES.small.value).toBeGreaterThan(COMET_SIZES.medium.value);
    const bodies = Array.from({ length: 400 }, () => throwBody(Math.random));
    for (const b of bodies) {
      if (b.kind === 'comet') expect(b.r).toBe(COMET_SIZES[b.size].r);
      else expect(b.r).toBeGreaterThan(COMET_SIZES.normal.r);
    }
    expect(bodies.some((b) => b.kind === 'bomb')).toBe(true);
    expect(new Set(bodies.filter((b) => b.kind === 'comet').map((b) => b.size)).size).toBe(3);
  });

  it('gives bodies in a group different paces', () => {
    let spread = 0;
    for (let i = 0; i < 200; i++) {
      const w = throwWave(Math.random);
      if (w.kind !== 'rain' && w.kind !== 'fan' && w.kind !== 'swarm') continue;
      expect(new Set(w.bodies.map((b) => Math.round(b.vy))).size).toBeGreaterThan(1);
      expect(new Set(w.bodies.map((b) => b.g.toFixed(2))).size).toBeGreaterThan(1);
      spread++;
    }
    expect(spread).toBeGreaterThan(5);
  });

  it('has no ramp-up: speed and gaps are random and do not depend on how long you have played', () => {
    expect(throwGap.length).toBe(1);
    const gaps = Array.from({ length: 300 }, () => throwGap(Math.random));
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0.1);
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
      if (w.kind === 'swarm') expect(w.bodies.filter((b) => b.kind === 'comet').every((b) => b.size === 'small')).toBe(true);
    }
    expect(kinds.size).toBe(10);
    for (let i = 0; i < 400; i++) {
      const w = throwWave(Math.random);
      if (w.kind === 'decoy') expect(w.bodies.some((b) => b.kind === 'bomb')).toBe(true);
    }
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
          expect(b.x).toBeGreaterThanOrEqual(b.r - 2.5);
          expect(b.x).toBeLessThanOrEqual(W - b.r + 2.5);
        }
      }
    }
  });

  it('has easy, medium and hard: gentler levels are slower, with bigger comets, fewer skulls and simpler patterns', () => {
    expect(TUNES.easy.speed).toBeLessThan(TUNES.medium.speed);
    expect(TUNES.medium.speed).toBeLessThan(TUNES.hard.speed);
    expect(TUNES.easy.hearts).toBeGreaterThan(TUNES.hard.hearts);
    expect(TUNES.easy.bombs).toBeLessThan(TUNES.hard.bombs);
    try {
      setLevel('easy');
      const sizes = new Set<string>();
      const kinds = new Set<string>();
      let fastest = 0;
      for (let i = 0; i < 600; i++) {
        const w = throwWave(Math.random);
        kinds.add(w.kind);
        for (const b of w.bodies) {
          if (b.kind === 'comet') sizes.add(b.size);
          else expect(b.r).toBe(SKULL_R); // no small skulls on easy
          fastest = Math.max(fastest, b.vy);
        }
        expect(w.bodies.length).toBeLessThanOrEqual(5);
      }
      expect(sizes.has('small')).toBe(false);
      expect([...kinds].sort()).toEqual(['fan', 'pair', 'rain', 'single']);
      expect(fastest).toBeLessThanOrEqual(TUNES.easy.maxSpeed + 1);
      const gaps = Array.from({ length: 200 }, () => throwGap(Math.random));
      expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0.9);
      setLevel('medium');
      const mk = new Set(Array.from({ length: 800 }, () => throwWave(Math.random).kind));
      expect(mk.has('decoy')).toBe(false);
      expect(mk.has('swarm')).toBe(false);
      expect(mk.has('trap')).toBe(true);
    } finally {
      setLevel('hard');
    }
  });

  it('sets the daily level by the day of the week', () => {
    expect(levelForDate('2026-10-26')).toBe('easy'); // Monday
    expect(levelForDate('2026-10-27')).toBe('easy');
    expect(levelForDate('2026-10-28')).toBe('medium');
    expect(levelForDate('2026-10-29')).toBe('medium');
    expect(levelForDate('2026-10-30')).toBe('hard');
    expect(levelForDate('2026-11-01')).toBe('hard'); // Sunday
    expect(levelForDate('nonsense')).toBe('medium');
    expect(DAILY_TARGET.easy).toBeLessThan(DAILY_TARGET.hard);
  });
});
