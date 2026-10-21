import { advance, branchesFor, buildYard, Branch, COLOURS, gapMs, liveTracks, offsetPts, planTrains, pointAt, routeFrom, spawn, speedFor, stationsOf, trainsInRound } from './switchyard-engine';

const SETS: Branch[][] = [['station'], ['station', 'station'], ['station', 'fork', 'station'], ['fork', 'siding', 'station'], ['station', 'fork', 'siding', 'fork']];

describe('Switchyard', () => {
  it('builds yards where every track leads to a station', () => {
    for (const branches of SETS) {
      const yard = buildYard(branches);
      const stations = stationsOf(yard);
      expect(stations.length).toBe(branches.reduce((n, b) => n + (b === 'station' ? 1 : b === 'fork' ? 2 : 0), 1));
      for (const n of yard.nodes) {
        if (n.kind === 'station') expect(n.out.length).toBe(0);
        else expect([1, 2]).toContain(n.out.length);
        for (const e of n.out) {
          expect(e.len).toBeGreaterThan(0);
          expect(e.pts[0]).toEqual([n.u, n.v]);
          const to = yard.nodes[e.to];
          expect(e.pts[e.pts.length - 1]).toEqual([to.u, to.v]);
        }
      }
      // Every station can be reached from the gate.
      const reached = new Set<number>([0]);
      for (const n of yard.nodes) if (reached.has(n.id)) n.out.forEach((e) => reached.add(e.to));
      for (const s of stations) expect(reached.has(s.id)).toBe(true);
    }
  });

  it('scatters the colours: distinct while there are enough, and different from one yard to the next', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const yard = buildYard(SETS[3]);
      const colours = stationsOf(yard).map((s) => s.colour as number);
      expect(new Set(colours).size).toBe(colours.length);
      colours.forEach((c) => expect(c).toBeLessThan(COLOURS));
      seen.add(colours.join(','));
    }
    expect(seen.size).toBeGreaterThan(5);
  });

  it('has joiners where a siding rejoins the main line', () => {
    expect(buildYard(SETS[0]).nodes.some((n) => n.into === 2)).toBe(false);
    expect(buildYard(SETS[3]).nodes.some((n) => n.into === 2)).toBe(true);
  });

  it('sends a train the way a switch is set when it gets there', () => {
    const yard = buildYard(['station']);
    const sw = yard.nodes.find((n) => n.out.length === 2)!;
    for (const way of [0, 1]) {
      const settings: number[] = [];
      settings[sw.id] = way;
      const train = spawn(yard, 1, 0, settings);
      let arrived: number | null = null;
      for (let i = 0; i < 400 && arrived === null; i++) arrived = advance(yard, settings, train, 1);
      expect(arrived).toBe(sw.out[way].to);
    }
  });

  it('lets a tap that comes after the train passed the switch change nothing for it', () => {
    const yard = buildYard(['station']);
    const sw = yard.nodes.find((n) => n.out.length === 2)!;
    const settings: number[] = [];
    settings[sw.id] = 0;
    const train = spawn(yard, 1, 0, settings);
    advance(yard, settings, train, sw.u + 1); // just past the switch
    settings[sw.id] = 1;
    let arrived: number | null = null;
    for (let i = 0; i < 400 && arrived === null; i++) arrived = advance(yard, settings, train, 1);
    expect(arrived).toBe(sw.out[0].to);
    expect(routeFrom(yard, sw.id, settings)).toBe(sw.out[1]);
  });

  it('lights the tracks a train would take, and works out positions and sideways rails', () => {
    const yard = buildYard(['station']);
    const sw = yard.nodes.find((n) => n.out.length === 2)!;
    const settings: number[] = [];
    settings[sw.id] = 1;
    const live = liveTracks(yard, settings);
    expect(live.has(sw.out[1])).toBe(true);
    expect(live.has(sw.out[0])).toBe(false);
    const edge = sw.out[1];
    const mid = pointAt(edge, edge.len / 2);
    expect(Math.abs(mid.v)).toBeGreaterThan(0);
    expect(pointAt(yard.nodes[0].out[0], 1).angle).toBeCloseTo(90);
    expect(offsetPts([[0, 0], [10, 0], [10, 10]], 2)).toEqual([[0, 2], [8, 2], [8, 10]]);
  });

  it('plans trains only for colours that have a station, and gets quicker and busier', () => {
    const yard = buildYard(SETS[1]);
    const colours = new Set(stationsOf(yard).map((s) => s.colour));
    for (const c of planTrains(yard, 40)) expect(colours.has(c)).toBe(true);
    expect(speedFor(10)).toBeGreaterThan(speedFor(1));
    expect(gapMs(10)).toBeLessThan(gapMs(1));
    expect(trainsInRound(3)).toBeGreaterThan(trainsInRound(1));
    expect(branchesFor(1)).toEqual(['station']);
    expect(branchesFor(40)).toContain('fork');
  });
});
