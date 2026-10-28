import { BALLS_PER_INNINGS, BOUNDARY, deliver, fieldTimes, Match, playShot, RUN_SECONDS, Running, SWEET, sideMatches, timingQuality, WICKETS } from './pocket-cricket-engine';

const fixed = (v: number) => () => v;

describe('Pocket Cricket', () => {
  it('rates timing: best at the sweet spot, nothing outside the window', () => {
    expect(timingQuality(SWEET)).toBe(1);
    expect(timingQuality(SWEET + 0.08)).toBeCloseTo(0.5, 5);
    expect(timingQuality(0.3)).toBe(-1);
    expect(timingQuality(1.05)).toBe(-1);
  });

  it('bowls random lines at random speeds', () => {
    const lines = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const d = deliver(Math.random);
      lines.add(d.line);
      expect(d.seconds).toBeGreaterThanOrEqual(0.95);
      expect(d.seconds).toBeLessThanOrEqual(1.6);
    }
    expect(lines.size).toBe(3);
  });

  it('matches the shot to the side of the ball', () => {
    expect(sideMatches('left', -1)).toBe(true);
    expect(sideMatches('left', 1)).toBe(false);
    expect(sideMatches('right', 0)).toBe(true);
  });

  it('turns timing and side into runs, fours, sixes, catches and misses', () => {
    expect(playShot(SWEET, 'left', -1, fixed(0.5)).outcome).toBe('six');
    expect(playShot(SWEET, 'left', 1, fixed(0.5)).outcome).toBe('runs'); // wrong side: at most 0.65
    expect(playShot(SWEET + 0.04, 'right', 1, fixed(0.5)).outcome).toBe('four');
    expect(playShot(SWEET + 0.15, 'right', 1, fixed(0.5)).outcome).toBe('caught');
    expect(playShot(0.2, 'right', 1, fixed(0.5)).outcome).toBe('miss');
    const four = playShot(SWEET + 0.04, 'left', -1, fixed(0.5));
    expect(four.dist).toBe(BOUNDARY);
    expect(four.angle).toBeLessThan(0);
    expect(playShot(SWEET, 'right', 0, fixed(0.5)).angle).toBeGreaterThan(0);
  });

  it('gives a faraway ball more time before the fielder returns it', () => {
    expect(fieldTimes(40).returned).toBeGreaterThan(fieldTimes(10).returned);
  });

  it('counts runs that finish before the ball is back, and a run out when one does not', () => {
    const safe = new Running(2.4);
    safe.tap(0);
    safe.tick(RUN_SECONDS);
    expect(safe.runs).toBe(1);
    safe.tap(RUN_SECONDS);
    safe.tick(2 * RUN_SECONDS);
    safe.tick(2.5);
    expect(safe.runs).toBe(2);
    expect(safe.out).toBe(false);
    expect(safe.done).toBe(true);

    const risky = new Running(1.0);
    risky.tap(0);
    risky.tick(RUN_SECONDS);
    risky.tap(RUN_SECONDS); // would finish at 1.4, after the ball is back at 1.0
    risky.tick(1.1);
    expect(risky.runs).toBe(1);
    expect(risky.out).toBe(true);
    expect(risky.done).toBe(true);
  });

  it('saves a second tap for the next run, and ignores taps once the ball is back', () => {
    const r = new Running(3);
    r.tap(0);
    r.tap(0.2); // queued
    r.tick(RUN_SECONDS);
    expect(r.runs).toBe(1);
    expect(r.start).toBeCloseTo(RUN_SECONDS, 5);
    r.tick(3.1);
    expect(r.runs).toBe(2);
    const late = new Running(1);
    late.tap(1.2);
    expect(late.start).toBeNull();
    late.tick(1.2);
    expect(late.done).toBe(true);
    expect(late.runs).toBe(0);
  });

  it('ends the innings after twelve balls or two wickets', () => {
    const a = new Match();
    for (let i = 0; i < BALLS_PER_INNINGS - 1; i++) a.record(1, false);
    expect(a.over).toBe(false);
    a.record(4, false);
    expect(a.over).toBe(true);
    expect(a.runs).toBe(15);
    expect(a.overs).toBe('2.0');
    const b = new Match();
    for (let i = 0; i < WICKETS; i++) b.record(0, true);
    expect(b.over).toBe(true);
  });
});
