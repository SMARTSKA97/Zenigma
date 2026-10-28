/** The game ends after this many outs (bowled, caught or run out), or after ten overs. */
export const OUTS_TO_END = 5;
export const MAX_BALLS = 60;

/** The batter stands in one of five lanes across the crease (-2 far left … 2 far right). */
export const LANES = 5;
export const MAX_LANE = 2;

/** How far along its flight (0 to 1) the ball is at the sweet spot, and how far either side of it a swing still makes contact. */
export const SWEET = 0.86;
export const WINDOW = 0.16;

/** One run, from crease to crease, takes this long. */
export const RUN_SECONDS = 0.7;

export interface Delivery {
  /** The lane the ball arrives in (-2 to 2). */
  lane: number;
  /** How long it takes to reach the bat: every ball is a different speed. */
  seconds: number;
}

/** The next ball: a random lane at a random speed. */
export function deliver(random: () => number): Delivery {
  return { lane: Math.floor(random() * LANES) - MAX_LANE, seconds: 0.9 + random() * 0.6 };
}

export const clampLane = (lane: number): number => Math.max(-MAX_LANE, Math.min(MAX_LANE, lane));

/** How well-timed a swing at flight position `t` is: 1 at the sweet spot, falling to 0 at the edge of the window, -1 outside it (a miss). */
export function timingQuality(t: number): number {
  const d = Math.abs(t - SWEET);
  return d > WINDOW ? -1 : 1 - d / WINDOW;
}

export type Outcome = 'miss' | 'caught' | 'runs' | 'four' | 'six';

export interface Shot {
  outcome: Outcome;
  /** 0 to 1: timing, cut down when the bat is a lane off the ball. */
  power: number;
  /** How far the ball travels when it stays in the field. */
  dist: number;
  /** Radians from straight down the ground; negative is to the left. */
  angle: number;
}

/**
 * What a swing does. The bat must be in the ball's lane, or the lane next to it (a weaker, edged shot); two lanes away is a miss. The
 * timing sets the power, and the lane and timing set where the ball goes.
 */
export function playShot(t: number, batLane: number, ballLane: number, random: () => number): Shot {
  const off = batLane - ballLane;
  const q = timingQuality(t);
  if (q < 0 || Math.abs(off) > 1) return { outcome: 'miss', power: 0, dist: 0, angle: 0 };
  const power = q * (off === 0 ? 1 : 0.6);
  const angle = Math.max(-1.35, Math.min(1.35, off * 0.5 + (SWEET - t) * 3 + (random() - 0.5) * 0.3));
  if (power < 0.3) return { outcome: 'caught', power, dist: 20, angle };
  if (power >= 0.88) return { outcome: 'six', power, dist: ROPE, angle };
  if (power >= 0.68) return { outcome: 'four', power, dist: ROPE, angle };
  return { outcome: 'runs', power, dist: 14 + power * 40, angle };
}

// ---- the field, seen from above ---------------------------------------------------------------------------------------------------

export interface Pt {
  x: number;
  y: number;
}

/** The field is a circle of radius ROPE around the middle of the pitch; the pitch runs up and down, the bowler at the top. */
export const ROPE = 96;
export const BAT_END: Pt = { x: 0, y: 24 };
export const BOWL_END: Pt = { x: 0, y: -24 };
export const FIELDERS: Pt[] = [
  { x: -62, y: -6 },
  { x: -48, y: -56 },
  { x: 0, y: -78 },
  { x: 48, y: -56 },
  { x: 62, y: -6 },
  { x: 52, y: 52 },
  { x: 0, y: 72 },
  { x: -52, y: 52 },
];
export const FIELDER_SPEED = 34;
const THROW_SPEED = 60;

const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.y - b.y);

export interface FieldPlan {
  kind: 'boundary' | 'caught' | 'play';
  /** Unit direction the ball travels from the bat. */
  dir: Pt;
  /** Where the ball stops, or is taken. */
  end: Pt;
  /** How long the ball takes to get there. */
  ballTime: number;
  /** Which fielder deals with it, and when he has it. */
  fielder: number;
  tMeet: number;
  /** When the ball is back at the bowler's end. */
  returned: number;
}

/** The ball's place `t` seconds after the hit, for a ball that rolls and slows to a stop. */
export function rollPoint(plan: FieldPlan, t: number): Pt {
  const p = Math.min(1, t / plan.ballTime);
  const s = 1 - (1 - p) * (1 - p);
  return { x: BAT_END.x + (plan.end.x - BAT_END.x) * s, y: BAT_END.y + (plan.end.y - BAT_END.y) * s };
}

/** Works out the ball after a hit: where it goes, which fielder chases it, and when it is back. */
export function planField(shot: Shot): FieldPlan {
  const dir = { x: Math.sin(shot.angle), y: -Math.cos(shot.angle) };
  if (shot.outcome === 'four' || shot.outcome === 'six') {
    const end = { x: BAT_END.x + dir.x * ROPE, y: BAT_END.y + dir.y * ROPE };
    return { kind: 'boundary', dir, end, ballTime: 0.8, fielder: -1, tMeet: 0.8, returned: 0.8 };
  }
  if (shot.outcome === 'caught') {
    // Skied or edged straight to the fielder nearest its line.
    let best = 0;
    let score = -2;
    FIELDERS.forEach((f, i) => {
      const d = dist(BAT_END, f);
      const s = ((f.x - BAT_END.x) * dir.x + (f.y - BAT_END.y) * dir.y) / d;
      if (s > score) (score = s, (best = i));
    });
    const end = FIELDERS[best];
    const t = dist(BAT_END, end) / 45 + 0.25;
    return { kind: 'caught', dir, end, ballTime: t, fielder: best, tMeet: t, returned: t + 0.4 };
  }
  const end = { x: BAT_END.x + dir.x * shot.dist, y: BAT_END.y + dir.y * shot.dist };
  const plan: FieldPlan = { kind: 'play', dir, end, ballTime: 0.7 + shot.dist / 40, fielder: 0, tMeet: Infinity, returned: 0 };
  FIELDERS.forEach((f, i) => {
    for (let t = 0.02; t < 8; t += 0.02) {
      if (dist(f, rollPoint(plan, t)) <= FIELDER_SPEED * t) {
        if (t < plan.tMeet) (plan.tMeet = t, (plan.fielder = i));
        break;
      }
    }
  });
  const meet = rollPoint(plan, plan.tMeet);
  plan.returned = plan.tMeet + dist(meet, BOWL_END) / THROW_SPEED + 0.15;
  return plan;
}

/** Where a fielder is `t` seconds after the hit: running to the ball's place if he is the one chasing it, else standing. */
export function fielderPoint(plan: FieldPlan, i: number, t: number): Pt {
  const f = FIELDERS[i];
  if (i !== plan.fielder || plan.kind === 'boundary') return f;
  const to = plan.kind === 'caught' ? plan.end : rollPoint(plan, plan.tMeet);
  const p = Math.min(1, t / plan.tMeet);
  return { x: f.x + (to.x - f.x) * p, y: f.y + (to.y - f.y) * p };
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
  outs = 0;

  record(runs: number, out: boolean): void {
    this.balls++;
    this.runs += runs;
    if (out) this.outs++;
  }

  get over(): boolean {
    return this.outs >= OUTS_TO_END || this.balls >= MAX_BALLS;
  }

  /** "1.3" for one over and three balls. */
  get overs(): string {
    return `${Math.floor(this.balls / 6)}.${this.balls % 6}`;
  }
}
