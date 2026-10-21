import { advance, buildYard, gapMs, planTrains, routeFrom, SHAPES, segmentMs, shapeForRound, spawn, stationsOf, trainsInRound } from './switchyard-engine';

describe('Switchyard', () => {
  it('builds yards where every track leads to a station and the stations have their own colours', () => {
    for (const shape of SHAPES) {
      const yard = buildYard(shape);
      const stations = stationsOf(yard);
      expect(stations.length).toBeGreaterThanOrEqual(2);
      expect(new Set(stations.map((s) => s.colour)).size).toBe(stations.length);
      for (const n of yard.nodes) {
        // A switch has two ways, a station none, everything else one.
        if (n.layer === yard.layers - 1) expect(n.next.length).toBe(0);
        else expect([1, 2]).toContain(n.next.length);
        for (const t of n.next) expect(yard.nodes[t].layer).toBe(n.layer + 1);
      }
      // Every station can be reached by some setting of the switches.
      const reached = new Set<number>([0]);
      for (const n of yard.nodes) if (reached.has(n.id)) n.next.forEach((t) => reached.add(t));
      for (const s of stations) expect(reached.has(s.id)).toBe(true);
    }
  });

  it('has joiners in the later yards', () => {
    expect(buildYard(SHAPES[0]).nodes.some((n) => n.into === 2)).toBe(false);
    expect(buildYard(SHAPES[2]).nodes.some((n) => n.into === 2)).toBe(true);
  });

  it('sends a train the way the switches are set when it gets to them', () => {
    const yard = buildYard(['split']);
    const switchNode = yard.nodes.find((n) => n.next.length === 2)!;
    for (const way of [0, 1]) {
      const settings: number[] = [];
      settings[switchNode.id] = way;
      const train = spawn(yard, 1, 0, settings);
      let arrived: number | null = null;
      for (let i = 0; i < 100 && arrived === null; i++) arrived = advance(yard, settings, train, 0.1);
      expect(arrived).toBe(switchNode.next[way]);
    }
  });

  it('lets a tap that comes after the train passed the switch change nothing for it', () => {
    const yard = buildYard(['split']);
    const sw = yard.nodes.find((n) => n.next.length === 2)!;
    const settings: number[] = [];
    settings[sw.id] = 0;
    const train = spawn(yard, 1, 0, settings);
    advance(yard, settings, train, 1.2); // past the switch
    settings[sw.id] = 1;
    let arrived: number | null = null;
    for (let i = 0; i < 100 && arrived === null; i++) arrived = advance(yard, settings, train, 0.1);
    expect(arrived).toBe(sw.next[0]);
    expect(routeFrom(yard, sw.id, settings)).toBe(sw.next[1]);
  });

  it('plans trains only for colours that have a station, and gets quicker and busier', () => {
    const yard = buildYard(SHAPES[1]);
    const colours = new Set(stationsOf(yard).map((s) => s.colour));
    for (const c of planTrains(yard, 40)) expect(colours.has(c)).toBe(true);
    expect(segmentMs(10)).toBeLessThan(segmentMs(1));
    expect(gapMs(10)).toBeLessThan(gapMs(1));
    expect(trainsInRound(3)).toBeGreaterThan(trainsInRound(1));
    expect(shapeForRound(1)).toBe(SHAPES[0]);
    expect(SHAPES).toContain(shapeForRound(40));
  });
});
