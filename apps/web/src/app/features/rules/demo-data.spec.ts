import { MIND_LIVE } from '../../games/catalog';
import { parseCell } from './cell';
import { demoFor, MIND_DEMOS } from './demo-data';
import { GAME_RULES } from './rules-data';

describe('game demos', () => {
  const ids = [...GAME_RULES.map((g) => g.id), ...MIND_LIVE];

  it('has a demo for every game', () => {
    for (const id of ids) {
      const demo = demoFor(id);
      expect(demo, id).not.toBeNull();
      expect(demo!.frames.length, id).toBeGreaterThanOrEqual(3);
    }
  });

  it('says what is happening in every frame and has a board with something in it', () => {
    for (const id of ids) {
      for (const f of demoFor(id)!.frames) {
        expect(f.say.length, id).toBeGreaterThan(10);
        expect(f.rows.length, id).toBeGreaterThan(0);
        expect(f.rows.every((r) => r.length > 0), id).toBe(true);
      }
    }
  });

  it('points the finger at a cell that exists', () => {
    for (const id of ids) {
      for (const f of demoFor(id)!.frames) {
        for (const p of [f.point, f.to]) {
          if (!p) continue;
          expect(f.rows[p[0]], `${id}: ${f.say}`).toBeDefined();
          expect(p[1]).toBeLessThan(Math.max(...f.rows.map((r) => r.length)));
        }
      }
    }
  });

  it('calls out what to do in tricky situations, written "If … → do …", for every mind game', () => {
    for (const id of MIND_LIVE) {
      const whens = MIND_DEMOS[id].frames.map((f) => f.when).filter(Boolean) as string[];
      expect(whens.length, id).toBeGreaterThanOrEqual(1);
      for (const w of whens) expect(w, id).toMatch(/^If .+ → .+/);
    }
  });

  it('reads cell marks and colours', () => {
    expect(parseCell('?#2 Hi')).toEqual({ mark: '?', colour: '2', text: ' Hi' });
    expect(parseCell('+A')).toEqual({ mark: '+', colour: '', text: 'A' });
    expect(parseCell('.')).toEqual({ mark: '', colour: '', text: '' });
  });
});
