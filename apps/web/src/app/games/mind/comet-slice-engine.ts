/**
 * The play field is 320 units wide (the same for everyone, so the same throws land in the same places) and as tall as the screen
 * allows, between 440 and 960 units. Comets and skulls fall from the top.
 */
export const W = 320;
export const MIN_H = 440;
export const MAX_H = 960;
export let H = 480;
/** Sets the field's height for the screen in use. */
export function setFieldHeight(height: number): void {
  H = Math.round(Math.max(MIN_H, Math.min(MAX_H, height)));
}
/** A little pull so that bodies speed up as they fall. */
export const GRAVITY = 70;

export interface Body {
  id: number;
  /** 'comet' is one to collect, 'bomb' is a skull that costs a heart. */
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
  /** A comet that has fallen past the bottom without being sliced (it costs a heart). */
  missed: boolean;
  /** Set once the miss has been counted. */
  counted?: boolean;
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

/** How hard the game is after `seconds` of play, from 0 (gentle) to 1 (frantic, reached after a minute and a half). */
export const heat = (seconds: number): number => Math.min(1, seconds / 90);

/** How much faster everything falls than at the start: it keeps building for the first few minutes, like Magic Tiles. */
export const speedUp = (seconds: number): number => 1 + Math.min(2.2, seconds / 50);

/** Seconds until the next throw. */
export const throwGap = (seconds: number, random: () => number): number => (1.15 - 0.7 * heat(seconds)) * (0.75 + 0.5 * random());

/** Chance that a thrown body is a bomb. */
export const bombChance = (seconds: number): number => 0.14 + 0.2 * heat(seconds);

/** The daily is a timed run of this many seconds. Practice has no clock: it goes on until the hearts run out. */
export const RUN_SECONDS = 60;

/** Hearts at the start. A sliced skull or a comet that gets past costs one. */
export const HEARTS = 3;

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
  const vy = (60 + random() * 240) * speedUp(seconds);
  // Slanted in any direction, but never so much that the body would leave the sides before it reaches the bottom.
  const fall = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * (H + 2 * r))) / GRAVITY;
  const lo = Math.max(-80, (r - x) / fall);
  const hi = Math.min(80, (W - r - x) / fall);
  const vx = lo + random() * (hi - lo);
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
