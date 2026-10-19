/** The play field is 320 by 480 units; the screen just scales it. */
export const W = 320;
export const H = 480;
export const GRAVITY = 520;

export interface Body {
  id: number;
  /** 'comet' is a fire to collect, 'bomb' is a skull that ends the run. */
  kind: 'comet' | 'bomb';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** Seconds since the body appeared. */
  age: number;
  sliced: boolean;
  /** The body's age when it was sliced. */
  slicedAt?: number;
  /** A fire that has fallen past the bottom without being sliced (it costs nothing). */
  missed: boolean;
}

/** Whether the segment from (ax, ay) to (bx, by) touches the circle at (cx, cy) with radius r. */
export function segmentHitsCircle(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / len2));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return (cx - px) ** 2 + (cy - py) ** 2 <= r * r;
}

/** How hard the game is after `seconds` of play, from 0 (gentle) to 1 (frantic, reached at the end of a run). */
export const heat = (seconds: number): number => Math.min(1, seconds / RUN_SECONDS);

/** Seconds until the next throw. */
export const throwGap = (seconds: number, random: () => number): number => (1.15 - 0.7 * heat(seconds)) * (0.75 + 0.5 * random());

/** Chance that a thrown body is a bomb. */
export const bombChance = (seconds: number): number => 0.14 + 0.2 * heat(seconds);

/** A run lasts this long unless a skull is sliced first. */
export const RUN_SECONDS = 45;

let nextId = 1;

/** A body thrown up from below the bottom edge, rising to somewhere between 55% and 90% of the field's height. */
export function throwBody(seconds: number, random: () => number): Body {
  const kind = random() < bombChance(seconds) ? 'bomb' : 'comet';
  const r = kind === 'bomb' ? 26 : 26;
  const x = 40 + random() * (W - 80);
  const peak = H * (0.55 + 0.35 * random());
  const vy = -Math.sqrt(2 * GRAVITY * peak);
  // Drift gently towards the middle so bodies do not leave the sides.
  const vx = ((W / 2 - x) / W) * 120 * (0.4 + random());
  return { id: nextId++, kind, x, y: H + r, vx, vy, r, age: 0, sliced: false, missed: false };
}

/** Moves a body forward by `dt` seconds. */
export function advance(b: Body, dt: number): void {
  b.age += dt;
  b.vy += GRAVITY * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (!b.sliced && b.vy > 0 && b.y - b.r > H) b.missed = true;
}
