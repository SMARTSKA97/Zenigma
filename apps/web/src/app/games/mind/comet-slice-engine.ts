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

export type Size = 'small' | 'medium' | 'normal';

export interface Body {
  id: number;
  /** 'comet' is one to collect, 'bomb' is a skull that costs a heart. */
  kind: 'comet' | 'bomb';
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** How big it is: comets come small (fast, worth 3), medium (worth 2) and normal (worth 1); a skull is small or normal. */
  size: Size;
  /** What slicing it is worth, before the combo bonus. */
  value: number;
  /** Its own pull: a low one floats and drifts, a high one drops hard, so bodies in a group fall at different paces. */
  g: number;
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

export type Level = 'easy' | 'medium' | 'hard';
export const LEVELS: Level[] = ['easy', 'medium', 'hard'];

/** The daily gets harder through the week: Monday and Tuesday easy, Wednesday and Thursday medium, Friday to Sunday hard. */
export function levelForDate(date: string): Level {
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return 'medium';
  const weekday = (d.getUTCDay() + 6) % 7;
  return weekday < 2 ? 'easy' : weekday < 4 ? 'medium' : 'hard';
}

/** What a daily run scores in points for a full 100 on each level (the levels' points are multiplied, so the harder ones run higher). */
export const DAILY_TARGET: Record<Level, number> = { easy: 30, medium: 70, hard: 120 };

export interface Tune {
  /** Hearts at the start. */
  hearts: number;
  /** What a comet is worth is multiplied by this, so a harder level earns more. */
  points: number;
  /** Multiplies every fall speed, and the fastest start speed allowed. */
  speed: number;
  maxSpeed: number;
  /** The range of each body's own pull (see Body.g). */
  pull: [number, number];
  /** Chances of a normal and a medium comet (the rest are small); small skulls' chance. */
  normal: number;
  medium: number;
  smallSkull: number;
  /** Average chance that a thrown body is a skull. */
  bombs: number;
  /** Gap between throws, and how often a throw comes right on the heels of the last one. */
  gap: [number, number];
  burst: number;
  /** How crowded a throw is (1 = the full count). */
  crowd: number;
  /** How likely each pattern is. */
  waves: Partial<Record<WaveKind, number>>;
}

/** Easy is gentle: slow, big comets, few skulls and simple patterns. Hard is the full set. */
export const TUNES: Record<Level, Tune> = {
  easy: {
    hearts: 5,
    points: 1,
    speed: 0.62,
    maxSpeed: 210,
    pull: [0.8, 1.15],
    normal: 0.62,
    medium: 0.38,
    smallSkull: 0,
    bombs: 0.07,
    gap: [0.9, 2.1],
    burst: 0,
    crowd: 0.6,
    waves: { single: 40, pair: 22, fan: 18, rain: 20 },
  },
  medium: {
    hearts: 4,
    points: 2,
    speed: 0.82,
    maxSpeed: 320,
    pull: [0.6, 1.35],
    normal: 0.45,
    medium: 0.4,
    smallSkull: 0.2,
    bombs: 0.13,
    gap: [0.55, 1.7],
    burst: 0.05,
    crowd: 0.8,
    waves: { single: 24, pair: 16, fan: 14, rain: 14, trap: 12, ladder: 8, mixed: 6, cross: 6 },
  },
  hard: {
    hearts: 3,
    points: 3,
    speed: 1,
    maxSpeed: 430,
    pull: [0.45, 1.65],
    normal: 0.4,
    medium: 0.32,
    smallSkull: 0.4,
    bombs: 0.2,
    gap: [0.3, 1.5],
    burst: 0.15,
    crowd: 1,
    waves: { single: 18, pair: 12, fan: 11, rain: 11, trap: 10, decoy: 10, cross: 8, swarm: 8, ladder: 6, mixed: 6 },
  },
};

/** The level in play: set once at the start of a run. */
export let tune: Tune = TUNES.hard;
export function setLevel(level: Level): void {
  tune = TUNES[level];
}

/** Seconds until the next throw: mostly quick to leisurely, sometimes right on the heels of the last one. Nothing builds up over the run. */
export const throwGap = (random: () => number): number => (random() < tune.burst ? 0.1 + random() * 0.2 : tune.gap[0] + random() * (tune.gap[1] - tune.gap[0]));

/** Average chance that a thrown body is a skull. Each throw varies around it, so some are clean and some are skull-heavy. */
export const BOMB_CHANCE = 0.2;

/** The daily is a timed run of this many seconds. Practice has no clock: it goes on until the hearts run out. */
export const RUN_SECONDS = 60;

/** Hearts at the start. A sliced skull or a comet that gets past costs one. */
export const HEARTS = 3;

/** Normal comets, and a skull (the biggest, so it is easy to see and to avoid). Small and medium comets are in COMET_SIZES. */
export const COMET_R = 28;
export const SKULL_R = 42;

/** The three comet sizes: smaller ones are worth more and fall faster. */
export const COMET_SIZES: Record<Size, { r: number; value: number; speed: number }> = {
  small: { r: 17, value: 3, speed: 1.3 },
  medium: { r: 22, value: 2, speed: 1.12 },
  normal: { r: COMET_R, value: 1, speed: 1 },
};
/** Skulls come in two sizes too: a small one is quicker and harder to read. */
export const SKULL_SIZES: Record<'small' | 'normal', number> = { small: 32, normal: SKULL_R };

let nextId = 1;

/** A random comet size: normal most often, small the least. */
export function randomSize(random: () => number): Size {
  const r = random();
  return r < tune.normal ? 'normal' : r < tune.normal + tune.medium ? 'medium' : 'small';
}

/** A random fall speed: mostly a medium drift, now and then a lazy float or a fast streak. */
export function randomSpeed(random: () => number): number {
  return 70 + random() ** 1.5 * 260;
}

/** A random pull between a floaty and a heavy fall, so even two comets thrown at the same speed do not stay together. */
export const randomPull = (random: () => number): number => tune.pull[0] + random() * (tune.pull[1] - tune.pull[0]);

export interface BodyOptions {
  /** Higher up by this much, so a group can arrive staggered. */
  lift?: number;
  size?: Size;
  /** Its own pull (see Body.g). */
  g?: number;
  /** Where in its possible slant it goes: 0 is as far left as it may, 1 as far right. Random if left out. */
  lean?: number;
}

/**
 * One body that appears above the top edge and falls. Its slant is random (or `lean`), but never so much that it would leave the sides
 * before it reaches the bottom.
 */
export function makeBody(kind: 'comet' | 'bomb', x: number, vy: number, random: () => number, options: BodyOptions = {}): Body {
  const lift = options.lift ?? 0;
  const size = options.size ?? 'normal';
  const g = options.g ?? 1;
  const r = kind === 'bomb' ? SKULL_SIZES[size === 'small' ? 'small' : 'normal'] : COMET_SIZES[size].r;
  const value = kind === 'bomb' ? 0 : COMET_SIZES[size].value;
  const cx = Math.max(r, Math.min(W - r, x));
  const pull = GRAVITY * g;
  const fall = (-vy + Math.sqrt(vy * vy + 2 * pull * (H + 2 * r + lift))) / pull;
  const lo = Math.max(-90, (r - cx) / fall);
  const hi = Math.min(90, (W - r - cx) / fall);
  const vx = lo + (options.lean ?? random()) * (hi - lo);
  return { id: nextId++, kind, x: cx, y: -r - lift, vx, vy, r, size, value, g, age: 0, sliced: false, missed: false };
}

/** The speed to throw a body of this size at: its own random pace, quicker for the small ones. */
const paceFor = (size: Size, random: () => number): number => Math.min(tune.maxSpeed, randomSpeed(random) * tune.speed * COMET_SIZES[size].speed);

/** A single body at a random place, size, speed and pull. */
export function throwBody(random: () => number, bombChance = tune.bombs): Body {
  const kind = random() < bombChance ? 'bomb' : 'comet';
  const size = randomSize(random);
  const r = kind === 'bomb' ? SKULL_SIZES[size === 'small' ? 'small' : 'normal'] : COMET_SIZES[size].r;
  return makeBody(kind, r + random() * (W - 2 * r), paceFor(size, random), random, { size, g: randomPull(random) });
}

export type WaveKind = 'single' | 'pair' | 'fan' | 'rain' | 'trap' | 'mixed' | 'decoy' | 'cross' | 'swarm' | 'ladder';

/** A comet of a random size, with a pace and a pull of its own, at x. */
const comet = (x: number, random: () => number, lift = 0, lean?: number, size = randomSize(random)): Body =>
  makeBody('comet', x, paceFor(size, random), random, { lift, size, g: randomPull(random), lean });
const skull = (x: number, random: () => number, lift = 0, lean?: number): Body => {
  const size = random() < tune.smallSkull ? 'small' : 'normal';
  return makeBody('bomb', x, paceFor(size, random), random, { lift, size, g: randomPull(random), lean });
};

/**
 * The next throw, chosen at random: a single body, a pair, a fan of comets from one spot, a row of comets raining down, a skull with comets
 * beside it, a rain with skulls hidden in it, two streams crossing, a swarm of small fast comets, a ladder of comets falling at different
 * paces, or a mix. Every throw is independent: there is no ramp-up, so a calm one can follow a wild one. Inside a throw, every body has its
 * own size, pace and pull, so a group never falls in step.
 */
export function throwWave(random: () => number): { kind: WaveKind; bodies: Body[] } {
  const entries = Object.entries(tune.waves) as [WaveKind, number][];
  let roll = random() * entries.reduce((s, [, n]) => s + n, 0);
  let kind: WaveKind = entries[0][0];
  for (const [k, n] of entries) {
    if ((roll -= n) < 0) {
      kind = k;
      break;
    }
  }
  const x = () => COMET_R + random() * (W - 2 * COMET_R);
  /** How many bodies in a group: the full count on hard, fewer on the gentler levels. */
  const count = (min: number, extra: number) => Math.max(2, Math.round((min + Math.floor(random() * (extra + 1))) * tune.crowd));
  // This throw's own chance of a skull: sometimes none to speak of, sometimes plenty.
  const bombs = tune.bombs * (0.4 + random() * 1.4);
  switch (kind) {
    case 'single':
      return { kind, bodies: [throwBody(random, bombs)] };
    case 'pair':
      return { kind, bodies: [throwBody(random, bombs), throwBody(random, bombs)] };
    case 'fan': {
      // A fan: comets from the same spot, spreading out as they fall, each at its own pace.
      const n = count(3, 2);
      const cx = x();
      return { kind, bodies: Array.from({ length: n }, (_, i) => comet(cx, random, i * 14)) };
    }
    case 'rain': {
      // Rain: a row of comets across the width, staggered, no two at the same pace.
      const n = count(4, 2);
      return { kind, bodies: Array.from({ length: n }, (_, i) => comet(COMET_R + ((W - 2 * COMET_R) * (i + 0.5)) / n, random, random() * 90)) };
    }
    case 'trap': {
      // A trap: a skull with comets right beside it, so a careless swipe costs the run.
      const cx = SKULL_R + 60 + random() * (W - 2 * SKULL_R - 120);
      const vy = Math.min(tune.maxSpeed * 0.75, randomSpeed(random) * tune.speed);
      const g = randomPull(random);
      const side = (dx: number, lift: number) => makeBody('comet', cx + dx, vy, random, { lift, g, size: randomSize(random) });
      return { kind, bodies: [makeBody('bomb', cx, vy, random, { g }), side(-70, 20), side(70, 40)] };
    }
    case 'decoy': {
      // A decoy: a rain like any other, but one or two of its bodies are skulls.
      const n = count(5, 1);
      const bad = new Set([Math.floor(random() * n), Math.floor(random() * n)]);
      return {
        kind,
        bodies: Array.from({ length: n }, (_, i) => {
          const bx = COMET_R + ((W - 2 * COMET_R) * (i + 0.5)) / n;
          return bad.has(i) ? skull(bx, random, random() * 90) : comet(bx, random, random() * 90);
        }),
      };
    }
    case 'cross': {
      // Two streams crossing: comets from each side slanting across, with a skull down the middle.
      const n = tune.crowd < 1 ? 2 : 2 + Math.floor(random() * 2);
      const bodies: Body[] = [];
      for (let i = 0; i < n; i++) {
        bodies.push(comet(COMET_R + random() * 70, random, i * 55, 1));
        bodies.push(comet(W - COMET_R - random() * 70, random, i * 55 + 25, 0));
      }
      if (random() < 0.7) bodies.push(skull(W / 2 + (random() - 0.5) * 60, random, 30));
      return { kind, bodies };
    }
    case 'swarm': {
      // A swarm: a handful of small, fast comets, sometimes with a skull among them.
      const n = count(5, 2);
      const bodies = Array.from({ length: n }, () => comet(COMET_R + random() * (W - 2 * COMET_R), random, random() * 120, undefined, 'small'));
      if (random() < 0.5) bodies.push(skull(x(), random, random() * 60));
      return { kind, bodies };
    }
    case 'ladder': {
      // A ladder: a column of bodies one above the other, each falling at its own pace, so they bunch up and spread out.
      const cx = x();
      const n = count(3, 1);
      return { kind, bodies: Array.from({ length: n }, (_, i) => (random() < bombs ? skull(cx, random, i * 50) : comet(cx, random, i * 50))) };
    }
    default: {
      const n = count(3, 2);
      return { kind: 'mixed', bodies: Array.from({ length: n }, () => throwBody(random, bombs * 1.4)) };
    }
  }
}

/** Moves a body forward by `dt` seconds. */
export function advance(b: Body, dt: number): void {
  b.age += dt;
  b.vy += GRAVITY * b.g * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  if (!b.sliced && b.vy > 0 && b.y - b.r > H) b.missed = true;
}
