/** Two overs, two wickets: score as many runs as you can. */
export const BALLS_PER_INNINGS = 12;
export const WICKETS = 2;

/** How far along its flight (0 to 1) the ball is at the sweet spot, and how far either side of it a swing still makes contact. */
export const SWEET = 0.86;
export const WINDOW = 0.16;

/** One run, from crease to crease, takes this long. */
export const RUN_SECONDS = 0.7;
/** How far a four or a six travels (the boundary). */
export const BOUNDARY = 60;

export type Side = 'left' | 'right';
export type Line = -1 | 0 | 1;

export interface Delivery {
  /** Which side of the stumps the ball comes in on: -1 on the left, 1 on the right, 0 straight. */
  line: Line;
  /** How long the ball takes to reach the bat: every ball is a different speed. */
  seconds: number;
}

/** The next ball: a random line at a random speed. */
export function deliver(random: () => number): Delivery {
  const line = ([-1, 0, 1] as const)[Math.floor(random() * 3)];
  return { line, seconds: 0.95 + random() * 0.65 };
}

/** How well-timed a swing at flight position `t` is: 1 at the sweet spot, falling to 0 at the edge of the window, -1 outside it (a miss). */
export function timingQuality(t: number): number {
  const d = Math.abs(t - SWEET);
  return d > WINDOW ? -1 : 1 - d / WINDOW;
}

/** A shot to the left suits a ball on the left, a shot to the right one on the right; a straight ball suits either. */
export function sideMatches(side: Side, line: Line): boolean {
  return line === 0 || line < 0 === (side === 'left');
}

export type Outcome = 'miss' | 'caught' | 'runs' | 'four' | 'six';

export interface Shot {
  outcome: Outcome;
  /** 0 to 1: timing, cut down when the shot is played to the wrong side of the ball. */
  power: number;
  /** How far the ball travels (when it is hit). */
  dist: number;
  /** Radians from straight up; negative is to the left. */
  angle: number;
}

/** What a swing at position `t` of a ball on `line` does. */
export function playShot(t: number, side: Side, line: Line, random: () => number): Shot {
  const q = timingQuality(t);
  if (q < 0) return { outcome: 'miss', power: 0, dist: 0, angle: 0 };
  const power = q * (sideMatches(side, line) ? 1 : 0.65);
  const spread = 0.4 + random() * 0.9;
  const angle = side === 'left' ? -spread : spread;
  if (power < 0.3) return { outcome: 'caught', power, dist: 8 + power * 20, angle };
  if (power >= 0.88) return { outcome: 'six', power, dist: BOUNDARY, angle };
  if (power >= 0.68) return { outcome: 'four', power, dist: BOUNDARY, angle };
  return { outcome: 'runs', power, dist: 12 + power * 45, angle };
}

/** When a fielder gets to a ball hit `dist` away, and when it is back at the stumps (seconds after the hit). */
export function fieldTimes(dist: number): { fielded: number; returned: number } {
  const fielded = 0.8 + dist / 30;
  return { fielded, returned: fielded + 0.5 };
}

/**
 * The running after a shot: each tap of Run sets off for the other end (a second tap while running is saved for the next run). A run counts
 * when the batter arrives before the ball is back; still on the pitch when it is back is a run out.
 */
export class Running {
  runs = 0;
  out = false;
  done = false;
  /** When the current run was started, or null while standing at a crease. */
  start: number | null = null;
  private queued = false;

  constructor(readonly returned: number) {}

  tap(now: number): void {
    if (this.done) return;
    if (this.start === null) {
      if (now < this.returned) this.start = now;
    } else {
      this.queued = true;
    }
  }

  tick(now: number): void {
    for (;;) {
      if (this.done) return;
      if (this.start === null) {
        if (now >= this.returned) this.done = true;
        return;
      }
      const finish = this.start + RUN_SECONDS;
      if (finish <= this.returned) {
        if (now < finish) return;
        this.runs++;
        this.start = this.queued && finish < this.returned ? finish : null;
        this.queued = false;
        continue;
      }
      // This run could not be finished before the ball is back.
      if (now < this.returned) return;
      this.out = true;
      this.done = true;
      return;
    }
  }
}

/** The tally for the innings. */
export class Match {
  runs = 0;
  balls = 0;
  wickets = 0;

  record(runs: number, wicket: boolean): void {
    this.balls++;
    this.runs += runs;
    if (wicket) this.wickets++;
  }

  get over(): boolean {
    return this.balls >= BALLS_PER_INNINGS || this.wickets >= WICKETS;
  }

  /** "1.3" for one over and three balls. */
  get overs(): string {
    return `${Math.floor(this.balls / 6)}.${this.balls % 6}`;
  }
}
