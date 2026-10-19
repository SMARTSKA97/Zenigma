/** The play field is 320 by 480 units; the screen just scales it. Comets and skulls fall from the top. */
export const W = 320;
export const H = 480;
/** A little pull so that bodies speed up as they fall. */
export const GRAVITY = 70;

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
export const RUN_SECONDS = 60;

/** Radius of the hit area of a comet and of a skull (skulls are the bigger ones, so they are easy to see and to avoid). */
export const COMET_R = 28;
export const SKULL_R = 42;

let nextId = 1;

/**
 * A body that appears above the top edge and falls. Each one gets its own speed (from a slow drift to a fast streak) and its
 * own slant, so no two come down alike.
 */
export function throwBody(seconds: number, random: () => number): Body {
  const kind = random() < bombChance(seconds) ? 'bomb' : 'comet';
  const r = kind === 'bomb' ? SKULL_R : COMET_R;
  const x = r + random() * (W - 2 * r);
  const vy = 70 + random() * 300 * (0.6 + 0.4 * heat(seconds));
  // Slanted, but drifting back towards the middle so bodies do not leave the sides.
  const vx = (random() - 0.5) * 120 + ((W / 2 - x) / W) * 50;
  return { id: nextId++, kind, x, y: -r, vx, vy, r, age: 0, sliced: false, missed: false };
}

/** Moves a body forward by `dt` seconds. */
export function advance(b: Body, dt: number): void {
  b.age += dt;
  b.vy += GRAVITY * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (!b.sliced && b.vy > 0 && b.y - b.r > H) b.missed = true;
}
