/**
 * Switchyard: coloured trains roll down a main line from the gate at the top. Where the track forks there is a switch, and the player taps
 * it to choose the way the next train takes. Some branches end in a station, some fork again, and some are sidings that rejoin the main line
 * (a joiner). Every train has to reach a station of its own colour. Stations are scattered: their colours are shuffled every round.
 *
 * Positions are `[u, v]`: u runs down the main line, v is across it (negative to the left).
 */

export type Pt = [number, number];
export type Kind = 'gate' | 'switch' | 'join' | 'station';
/** What hangs off a junction on the main line: a station, a fork with two stations, or a siding that rejoins the main line. */
export type Branch = 'station' | 'fork' | 'siding';

export interface Edge {
  to: number;
  /** The track as a polyline of right-angled turns, starting at the node it leaves and ending at the node it reaches. */
  pts: Pt[];
  len: number;
}

export interface YardNode {
  id: number;
  u: number;
  v: number;
  kind: Kind;
  /** Where the track goes on from here: none for a station, one for the gate and joiners, two for a switch (the first is the straight way). */
  out: Edge[];
  /** How many tracks run into this node (two means a joiner). */
  into: number;
  /** The colour of the station (null for everything else). */
  colour: number | null;
}

export interface Yard {
  nodes: YardNode[];
  /** How far the main line runs, top to bottom. */
  length: number;
}

export const COLOURS = 5;
/** Distance between junctions on the main line, and how far branches reach to the side. */
export const SPACING = 24;
export const ROW = 26;
const FORK_HUB = 15;
const FORK_REACH = 40;
const FORK_SPREAD = 11.5;
const SIDING_REACH = 10;
const SIDING_LENGTH = 12;

const lengthOf = (pts: Pt[]): number => {
  let sum = 0;
  for (let i = 1; i < pts.length; i++) sum += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return sum;
};

/** The branches of the yard of a round: they get longer and more tangled, and a fork always shows up by round 3. */
export function branchesFor(round: number, random: () => number = Math.random): Branch[] {
  const table: Branch[][] = [['station'], ['station', 'station'], ['station', 'fork', 'station'], ['fork', 'siding', 'station'], ['station', 'fork', 'siding', 'fork']];
  if (round <= table.length) return table[round - 1];
  const pool: Branch[] = ['station', 'fork', 'siding', 'fork'];
  const out = Array.from({ length: 4 }, () => pool[Math.floor(random() * pool.length)]);
  if (!out.includes('fork')) out[Math.floor(random() * out.length)] = 'fork';
  return out;
}

/** Builds a yard: a gate, one junction per branch (sides alternate), and a station where the main line ends. Station colours are shuffled. */
export function buildYard(branches: readonly Branch[], random: () => number = Math.random): Yard {
  const nodes: YardNode[] = [];
  const add = (u: number, v: number, kind: Kind): number => {
    nodes.push({ id: nodes.length, u, v, kind, out: [], into: 0, colour: null });
    return nodes.length - 1;
  };
  const link = (from: number, to: number, pts: Pt[], straight = false): void => {
    const edge: Edge = { to, pts, len: lengthOf(pts) };
    if (straight) nodes[from].out.unshift(edge);
    else nodes[from].out.push(edge);
    nodes[to].into++;
  };
  let tail = add(0, 0, 'gate');
  let tailU = 0;
  let side = random() < 0.5 ? -1 : 1;
  branches.forEach((type, j) => {
    const u = (j + 1) * SPACING;
    const s = add(u, 0, 'switch');
    link(tail, s, [[tailU, 0], [u, 0]], true);
    tail = s;
    tailU = u;
    if (type === 'station') {
      const st = add(u, side * ROW, 'station');
      link(s, st, [[u, 0], [u, side * ROW]]);
    } else if (type === 'fork') {
      const hub = add(u, side * FORK_HUB, 'switch');
      link(s, hub, [[u, 0], [u, side * FORK_HUB]]);
      const a = add(u - FORK_SPREAD, side * FORK_REACH, 'station');
      const c = add(u + FORK_SPREAD, side * FORK_REACH, 'station');
      link(hub, a, [[u, side * FORK_HUB], [u - FORK_SPREAD, side * FORK_HUB], [u - FORK_SPREAD, side * FORK_REACH]]);
      link(hub, c, [[u, side * FORK_HUB], [u + FORK_SPREAD, side * FORK_HUB], [u + FORK_SPREAD, side * FORK_REACH]]);
    } else {
      // A siding leaves the main line, runs alongside it and joins it again a little further on.
      const m = add(u + SIDING_LENGTH, 0, 'join');
      link(s, m, [[u, 0], [u, side * SIDING_REACH], [u + SIDING_LENGTH, side * SIDING_REACH], [u + SIDING_LENGTH, 0]]);
      link(s, m, [[u, 0], [u + SIDING_LENGTH, 0]], true);
      tail = m;
      tailU = u + SIDING_LENGTH;
    }
    side = -side;
  });
  const length = (branches.length + 1) * SPACING;
  const end = add(length, 0, 'station');
  link(tail, end, [[tailU, 0], [length, 0]], true);
  const stations = nodes.filter((n) => n.kind === 'station');
  const pool = shuffle(Array.from({ length: COLOURS }, (_, c) => c), random);
  stations.forEach((n, k) => (n.colour = k < pool.length ? pool[k] : Math.floor(random() * COLOURS)));
  return { nodes, length };
}

export const stationsOf = (yard: Yard): YardNode[] => yard.nodes.filter((n) => n.kind === 'station');

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The track a train takes from `node`, going by the switches' settings (0 is the straight way, 1 the other). Null at a station. */
export const routeFrom = (yard: Yard, node: number, settings: readonly number[]): Edge | null => {
  const n = yard.nodes[node];
  if (n.out.length === 0) return null;
  return n.out.length === 1 ? n.out[0] : n.out[settings[node] ? 1 : 0];
};

export interface Train {
  id: number;
  colour: number;
  /** The node it last passed, the track it is on, and how far along that track it is. */
  node: number;
  edge: Edge;
  d: number;
}

/** A new train at the gate, on its way down the main line. */
export const spawn = (yard: Yard, id: number, colour: number, settings: readonly number[]): Train => ({ id, colour, node: 0, edge: routeFrom(yard, 0, settings)!, d: 0 });

/**
 * Moves a train along by `dist`. A switch decides the way when the train reaches it, so a tap that comes too late changes nothing for that
 * train. Returns the station node when the train arrives at one.
 */
export function advance(yard: Yard, settings: readonly number[], train: Train, dist: number, k = 1): number | null {
  train.d += dist;
  // `d` and `dist` are measured on the screen, where the board is stretched `k` times down the page, so a train looks equally fast on every track.
  let len = edgeLen(train.edge, k);
  while (train.d >= len) {
    train.d -= len;
    train.node = train.edge.to;
    const next = routeFrom(yard, train.node, settings);
    if (!next) return train.node;
    train.edge = next;
    len = edgeLen(next, k);
  }
  return null;
}

/** The length of a track as it looks on the screen, where the board is stretched `k` times down the page. */
export function edgeLen(edge: Edge, k = 1): number {
  if (k === 1) return edge.len;
  let sum = 0;
  for (let i = 1; i < edge.pts.length; i++) sum += Math.hypot((edge.pts[i][0] - edge.pts[i - 1][0]) * k, edge.pts[i][1] - edge.pts[i - 1][1]);
  return sum;
}

/** The station a train would reach if the switches stayed as they are now. */
export function destinationOf(yard: Yard, train: Train, settings: readonly number[]): number {
  let node = train.edge.to;
  for (let guard = 0; guard < 64; guard++) {
    const next = routeFrom(yard, node, settings);
    if (!next) return node;
    node = next.to;
  }
  return node;
}

/** Where a train is on its track, and which way it faces (degrees, 0 is across to the right, 90 is down the page). `k` is how much the board is stretched down the page. */
export function pointAt(edge: Edge, d: number, k = 1): { u: number; v: number; angle: number } {
  let left = Math.max(0, Math.min(edgeLen(edge, k), d));
  for (let i = 1; i < edge.pts.length; i++) {
    const [u0, v0] = edge.pts[i - 1];
    const [u1, v1] = edge.pts[i];
    const seg = Math.hypot((u1 - u0) * k, v1 - v0);
    if (left <= seg || i === edge.pts.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, left / seg);
      // u runs down the page and v across it, so the angle of (across, down) is the angle on screen.
      return { u: u0 + (u1 - u0) * t, v: v0 + (v1 - v0) * t, angle: (Math.atan2((u1 - u0) * k, v1 - v0) * 180) / Math.PI };
    }
    left -= seg;
  }
  return { u: 0, v: 0, angle: 90 };
}

/** The tracks a train would take from the gate with the switches as they are now (so the board can light them up). */
export function liveTracks(yard: Yard, settings: readonly number[]): Set<Edge> {
  const live = new Set<Edge>();
  const walk = (node: number): void => {
    const n = yard.nodes[node];
    const edges = n.out.length <= 1 ? n.out : [n.out[settings[node] ? 1 : 0]];
    for (const e of edges) {
      if (live.has(e)) continue;
      live.add(e);
      walk(e.to);
    }
  };
  walk(0);
  return live;
}

/** Sideways copy of a right-angled polyline, `d` to its left side. */
export function offsetPts(pts: Pt[], d: number): Pt[] {
  const normal = (a: Pt, b: Pt): Pt => {
    const du = b[0] - a[0];
    const dv = b[1] - a[1];
    const len = Math.hypot(du, dv) || 1;
    return [(-dv / len) * d, (du / len) * d];
  };
  return pts.map((p, i) => {
    const before = i > 0 ? normal(pts[i - 1], p) : null;
    const after = i < pts.length - 1 ? normal(p, pts[i + 1]) : null;
    const n: Pt = before && after ? [before[0] + after[0], before[1] + after[1]] : (before ?? after ?? [0, 0]);
    return [p[0] + n[0], p[1] + n[1]];
  });
}

/** An SVG path along a polyline (screen x is v + `cx`, screen y is u + `top`) with rounded corners. */
export function roundedPath(pts: Pt[], cx: number, top: number, radius = 3.5): string {
  const xy = pts.map(([u, v]) => [cx + v, top + u] as const);
  let d = `M${xy[0][0]} ${xy[0][1]}`;
  for (let i = 1; i < xy.length - 1; i++) {
    const [px, py] = xy[i - 1];
    const [x, y] = xy[i];
    const [nx, ny] = xy[i + 1];
    const r = Math.min(radius, Math.hypot(x - px, y - py) / 2, Math.hypot(nx - x, ny - y) / 2);
    const a = Math.hypot(x - px, y - py) || 1;
    const b = Math.hypot(nx - x, ny - y) || 1;
    d += ` L${x - ((x - px) / a) * r} ${y - ((y - py) / a) * r} Q${x} ${y} ${x + ((nx - x) / b) * r} ${y + ((ny - y) / b) * r}`;
  }
  const last = xy[xy.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}

/** Speed of the trains in units a second: faster every round. */
export const speedFor = (round: number): number => Math.min(48, 20 + 2.5 * (round - 1));

/** Trains in a round. */
export const trainsInRound = (round: number): number => Math.min(14, 3 + 2 * round);

/** Milliseconds between one train entering and the next: closer together as the rounds go on. */
export const gapMs = (round: number): number => Math.round(Math.max(1.5, 3.1 - 0.15 * (round - 1)) * 1000);

/** The colours of the trains of a round, only ever for colours that have a station. */
export function planTrains(yard: Yard, count: number, random: () => number = Math.random): number[] {
  const colours = [...new Set(stationsOf(yard).map((s) => s.colour as number))];
  return Array.from({ length: count }, () => colours[Math.floor(random() * colours.length)]);
}
