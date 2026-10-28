import { clampLane, deliver, FIELDERS, fielderPoint, Match, MAX_BALLS, OUTS_TO_END, planField, playShot, ROPE, rollPoint, Running, RUN_SECONDS, SWEET, timingQuality } from './pocket-cricket-engine';

const fixed = (v: number) => () => v;

describe('Pocket Cricket', () => {
  it('rates timing: best at the sweet spot, nothing outside the window', () => {
    expect(timingQuality(SWEET)).toBe(1);
    expect(timingQuality(SWEET + 0.08)).toBeCloseTo(0.5, 5);
    expect(timingQuality(0.3)).toBe(-1);
    expect(timingQuality(1.05)).toBe(-1);
  });

  it('bowls random lanes at random speeds', () => {
    const lanes = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const d = deliver(Math.random);
      lanes.add(d.lane);
      expect(d.seconds).toBeGreaterThanOrEqual(0.9);
      expect(d.seconds).toBeLessThanOrEqual(1.5);
    }
    expect([...lanes].sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
    expect(clampLane(5)).toBe(2);
    expect(clampLane(-9)).toBe(-2);
  });

  it('needs the bat in the ball\'s lane or the next one, and the right moment', () => {
    expect(playShot(SWEET, 1, 1, fixed(0.5)).outcome).toBe('six');
    expect(playShot(SWEET, 0, 1, fixed(0.5)).outcome).toBe('four'); // a lane off: at most 0.75
    expect(playShot(SWEET, -1, 1, fixed(0.5)).outcome).toBe('miss'); // two lanes off
    expect(playShot(0.3, 1, 1, fixed(0.5)).outcome).toBe('miss'); // too early
    expect(playShot(SWEET + 0.04, 0, 0, fixed(0.5)).outcome).toBe('four');
    expect(playShot(SWEET + 0.08, 0, 0, fixed(0.5)).outcome).toBe('runs');
    // A badly mistimed edge: half are caught, half drop short for a single.
    expect(playShot(SWEET + 0.15, 0, 0, fixed(0.4)).outcome).toBe('caught');
    expect(playShot(SWEET + 0.15, 0, 0, fixed(0.6)).outcome).toBe('runs');
  });

  it('is not mostly catches: most hits that make contact score', () => {
    let n = 0;
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const t = 0.7 + (i / 4000) * 0.32; // every moment inside the window
      const o = playShot(t, 0, i % 3 === 0 ? 1 : 0, () => (n = (n * 7919 + 104729) % 100003) / 100003).outcome;
      counts[o] = (counts[o] ?? 0) + 1;
    }
    expect((counts['caught'] ?? 0) / 4000).toBeLessThan(0.12);
    expect(((counts['runs'] ?? 0) + (counts['four'] ?? 0) + (counts['six'] ?? 0)) / 4000).toBeGreaterThan(0.75);
  });

  it('sends the ball to either side depending on the lane and the timing', () => {
    expect(playShot(SWEET, 1, 0, fixed(0.5)).angle).toBeGreaterThan(0);
    expect(playShot(SWEET, -1, 0, fixed(0.5)).angle).toBeLessThan(0);
  });

  it('plans a boundary, a catch or a chase', () => {
    const four = planField({ outcome: 'four', power: 0.7, dist: ROPE, angle: 0.5 });
    expect(four.kind).toBe('boundary');
    expect(Math.hypot(four.end.x, four.end.y - 24)).toBeCloseTo(ROPE, 3);
    const caught = planField({ outcome: 'caught', power: 0.1, dist: 20, angle: 0.7 });
    expect(caught.kind).toBe('caught');
    expect(caught.returned).toBeLessThan(2);
    expect(FIELDERS).toContainEqual(caught.end);
    const near = planField({ outcome: 'runs', power: 0.4, dist: 20, angle: 0.2 });
    const far = planField({ outcome: 'runs', power: 0.6, dist: 40, angle: 0.2 });
    expect(near.kind).toBe('play');
    expect(Number.isFinite(near.tMeet)).toBe(true);
    expect(far.returned).toBeGreaterThan(0);
    // The ball slows to a stop where it was heading, and the chasing fielder ends up there.
    expect(rollPoint(far, 99)).toEqual(far.end);
    const f = fielderPoint(far, far.fielder, far.tMeet + 1);
    expect(Math.hypot(f.x - rollPoint(far, far.tMeet).x, f.y - rollPoint(far, far.tMeet).y)).toBeLessThan(0.01);
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
    r.tap(0.2);
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

  it('ends after five outs, or ten overs', () => {
    const a = new Match();
    for (let i = 0; i < OUTS_TO_END - 1; i++) a.record(3, true);
    expect(a.over).toBe(false);
    a.record(0, true);
    expect(a.over).toBe(true);
    expect(a.runs).toBe(12);
    const b = new Match();
    for (let i = 0; i < MAX_BALLS; i++) b.record(1, false);
    expect(b.over).toBe(true);
    expect(b.overs).toBe('10.0');
  });
});
