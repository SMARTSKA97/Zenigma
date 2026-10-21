/**
 * Switchyard: coloured trains roll in from the top of a rail yard. Where the track forks there is a switch, and the player taps it to choose
 * which way the next train goes. Where two tracks meet there is a joiner, which simply merges them. Every train has to reach the station of
 * its own colour.
 */

export type Op = 'split' | 'merge' | 'straight';

export interface YardNode {
  id: number;
  /** 0 is the gate the trains enter by; the last layer is the stations. */
  layer: number;
  row: number;
  /** How many nodes share this layer (for placing them across the board). */
  width: number;
  /** Where the track goes on from here: none for a station, one for plain track and joiners, two for a switch. */
  next: number[];
  /** How many tracks run into this node (two means a joiner). */
  into: number;
  /** The colour of the station (null for everything else). */
  colour: number | null;
}

export interface Yard {
  nodes: YardNode[];
  layers: number;
}

export const COLOURS = 4;

/** The yards, easiest first. Each step is one layer of track: a switch splits every track in two, a joiner merges them in pairs. */
export const SHAPES: readonly (readonly Op[])[] = [
  ['split'],
  ['split', 'split'],
  ['split', 'split', 'merge', 'split'],
  ['split', 'merge', 'split', 'split'],
  ['split', 'split', 'merge', 'straight', 'split'],
];

/** The yard of a round: the shapes in order, then the harder ones at random. */
export const shapeForRound = (round: number, random: () => number = Math.random): readonly Op[] =>
  round <= SHAPES.length ? SHAPES[round - 1] : SHAPES[2 + Math.floor(random() * (SHAPES.length - 2))];

/**
 * Builds the yard for a shape. Layer 0 is the gate, then one plain track into the first switch, then one layer per step of the shape.
 * The last layer is the stations, each with its own colour.
 */
export function buildYard(shape: readonly Op[], random: () => number = Math.random): Yard {
  const nodes: YardNode[] = [];
  const layers: number[][] = [];
  const add = (layer: number, row: number, width: number): number => {
    const id = nodes.length;
    nodes.push({ id, layer, row, width, next: [], into: 0, colour: null });
    (layers[layer] ??= []).push(id);
    return id;
  };
  add(0, 0, 1);
  const ops: readonly Op[] = ['straight', ...shape];
  ops.forEach((op, i) => {
    const here = layers[i];
    const width = op === 'split' ? here.length * 2 : op === 'merge' ? Math.max(1, Math.floor(here.length / 2)) : here.length;
    for (let r = 0; r < width; r++) add(i + 1, r, width);
    const below = layers[i + 1];
    here.forEach((id, r) => {
      const targets = op === 'split' ? [below[2 * r], below[2 * r + 1]] : op === 'merge' ? [below[Math.min(width - 1, Math.floor(r / 2))]] : [below[r]];
      nodes[id].next = targets;
      for (const t of targets) nodes[t].into++;
    });
  });
  const last = layers[layers.length - 1];
  const colours = shuffle(Array.from({ length: COLOURS }, (_, c) => c), random).slice(0, last.length);
  last.forEach((id, k) => (nodes[id].colour = colours[k]));
  return { nodes, layers: layers.length };
}

export const stationsOf = (yard: Yard): YardNode[] => yard.nodes.filter((n) => n.colour !== null);

function shuffle<T>(list: T[], random: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The node a train takes from `node`, going by the switches' settings (a switch's setting is 0 or 1; plain track has no choice). */
export const routeFrom = (yard: Yard, node: number, settings: readonly number[]): number => {
  const n = yard.nodes[node];
  return n.next.length === 1 ? n.next[0] : n.next[settings[node] ?? 0];
};

export interface Train {
  id: number;
  colour: number;
  from: number;
  to: number;
  /** How far along the track from `from` to `to`, 0 to 1. */
  f: number;
}

/** A new train at the gate, on its way to the first node. */
export const spawn = (yard: Yard, id: number, colour: number, settings: readonly number[]): Train => ({ id, colour, from: 0, to: routeFrom(yard, 0, settings), f: 0 });

/**
 * Moves a train along by `df` of a track. A switch decides the way when the train reaches it, so a tap that comes too late changes nothing
 * for that train. Returns the station node when the train arrives at one.
 */
export function advance(yard: Yard, settings: readonly number[], train: Train, df: number): number | null {
  train.f += df;
  while (train.f >= 1) {
    train.f -= 1;
    train.from = train.to;
    if (yard.nodes[train.from].next.length === 0) return train.from;
    train.to = routeFrom(yard, train.from, settings);
  }
  return null;
}

/** Milliseconds a train takes from one layer to the next: it gets quicker every round. */
export const segmentMs = (round: number): number => Math.max(450, 1400 - 90 * (round - 1));

/** Trains in a round. */
export const trainsInRound = (round: number): number => Math.min(14, 3 + 2 * round);

/** Milliseconds between one train entering and the next: closer together as the rounds go on. */
export const gapMs = (round: number): number => Math.round(segmentMs(round) * Math.max(1.5, 2.6 - 0.2 * (round - 1)));

/** The colours of the trains of a round, only ever for stations that exist. */
export function planTrains(yard: Yard, count: number, random: () => number = Math.random): number[] {
  const colours = stationsOf(yard).map((s) => s.colour as number);
  return Array.from({ length: count }, () => colours[Math.floor(random() * colours.length)]);
}
