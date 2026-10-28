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

/** Seconds until the next throw: anywhere from quick to leisurely, at random. Nothing builds up over the run. */
export const throwGap = (random: () => number): number => 0.3 + random() * 1.2;

/** Chance that a single thrown body is a skull. */
export const BOMB_CHANCE = 0.2;

/** The daily is a timed run of this many seconds. Practice has no clock: it goes on until the hearts run out. */
export const RUN_SECONDS = 60;

/** Hearts at the start. A sliced skull or a comet that gets past costs one. */
export const HEARTS = 3;

/** Radius of the hit area of a comet and of a skull (skulls are the bigger ones, so they are easy to see and to avoid). */
export const COMET_R = 28;
export const SKULL_R = 42;

let nextId = 1;

/** A random fall speed: mostly a medium drift, now and then a lazy float or a fast streak. */
export function randomSpeed(random: () => number): number {
  return 70 + random() ** 1.5 * 260;
}

/**
 * One body that appears above the top edge (`lift` units higher, so a group can arrive staggered) and falls. Its slant is random, but never so
 * much that it would leave the sides before it reaches the bottom.
 */
export function makeBody(kind: 'comet' | 'bomb', x: number, vy: number, random: () => number, lift = 0): Body {
  const r = kind === 'bomb' ? SKULL_R : COMET_R;
  const cx = Math.max(r, Math.min(W - r, x));
  const fall = (-vy + Math.sqrt(vy * vy + 2 * GRAVITY * (H + 2 * r + lift))) / GRAVITY;
  const lo = Math.max(-80, (r - cx) / fall);
  const hi = Math.min(80, (W - r - cx) / fall);
  const vx = lo + random() * (hi - lo);
  return { id: nextId++, kind, x: cx, y: -r - lift, vx, vy, r, age: 0, sliced: false, missed: false };
}

/** A single body at a random place and speed. */
export function throwBody(random: () => number): Body {
  const kind = random() < BOMB_CHANCE ? 'bomb' : 'comet';
  const r = kind === 'bomb' ? SKULL_R : COMET_R;
  return makeBody(kind, r + random() * (W - 2 * r), randomSpeed(random), random);
}

export type WaveKind = 'single' | 'pair' | 'fan' | 'rain' | 'trap' | 'mixed';

/**
 * The next throw, chosen at random: a single body, a pair, a fan of comets from one spot, a row of comets raining down together, a skull
 * with comets close around it, or a mix. Every throw is independent: there is no ramp-up, so a calm one can follow a wild one.
 */
export function throwWave(random: () => number): { kind: WaveKind; bodies: Body[] } {
  const roll = random();
  const x = () => COMET_R + random() * (W - 2 * COMET_R);
  if (roll < 0.34) return { kind: 'single', bodies: [throwBody(random)] };
  if (roll < 0.5) return { kind: 'pair', bodies: [throwBody(random), throwBody(random)] };
  if (roll < 0.64) {
    // A fan: comets from the same spot at the same speed, spreading out as they fall.
    const n = 3 + Math.floor(random() * 3);
    const cx = x();
    const vy = randomSpeed(random);
    return { kind: 'fan', bodies: Array.from({ length: n }, (_, i) => makeBody('comet', cx, vy * (0.9 + 0.2 * (i / n)), random, i * 14)) };
  }
  if (roll < 0.78) {
    // Rain: a row of comets across the width, a little staggered.
    const n = 4 + Math.floor(random() * 3);
    const vy = randomSpeed(random);
    return { kind: 'rain', bodies: Array.from({ length: n }, (_, i) => makeBody('comet', COMET_R + ((W - 2 * COMET_R) * (i + 0.5)) / n, vy, random, random() * 70)) };
  }
  if (roll < 0.9) {
    // A trap: a skull with comets right beside it, so a careless swipe costs a heart.
    const cx = SKULL_R + 60 + random() * (W - 2 * SKULL_R - 120);
    const vy = randomSpeed(random);
    return { kind: 'trap', bodies: [makeBody('bomb', cx, vy, random), makeBody('comet', cx - 70, vy, random, 20), makeBody('comet', cx + 70, vy, random, 40)] };
  }
  const n = 3 + Math.floor(random() * 2);
  return { kind: 'mixed', bodies: Array.from({ length: n }, () => throwBody(random)) };
}

/** Moves a body forward by `dt` seconds. */
export function advance(b: Body, dt: number): void {
  b.age += dt;
  b.vy += GRAVITY * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (!b.sliced && b.vy > 0 && b.y - b.r > H) b.missed = true;
}
