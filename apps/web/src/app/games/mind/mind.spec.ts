import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { GAMES, MIND_LIVE } from '../catalog';
import { MIND_META } from './mind-meta';
import { MindStore } from './mind-store';
import { shuffled } from './mind-util';

describe('mind training', () => {
  it('has rules and a scale for every game that can be played', () => {
    for (const id of MIND_LIVE) {
      const m = MIND_META[id];
      expect(m, id).toBeTruthy();
      expect(m!.how.length).toBeGreaterThan(20);
      expect(m!.scale).toBeGreaterThan(0);
      expect(GAMES.find((g) => g.id === id)?.skill).toBe(m!.skill);
    }
  });

  it('keeps best scores and play counts, and reports a new best once', () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    const store = TestBed.inject(MindStore);
    expect(store.add('quick-sums', 10)).toBe(true);
    expect(store.add('quick-sums', 8)).toBe(false);
    expect(store.add('quick-sums', 12)).toBe(true);
    expect(store.record('quick-sums')).toMatchObject({ best: 12, plays: 3, recent: [10, 8, 12] });
    expect(store.record('quick-sums').times?.length).toBe(3);
    expect(store.gamesPlayed()).toBe(1);
  });

  it('marks a skill by the average of its games against their excellent score', () => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    const store = TestBed.inject(MindStore);
    const maths = MIND_LIVE.filter((id) => MIND_META[id]!.skill === 'math');
    for (const id of maths) store.add(id, MIND_META[id]!.scale);
    expect(store.skills().find((s) => s.skill === 'math')?.mark).toBe(100);
    expect(store.skills().find((s) => s.skill === 'memory')?.mark).toBe(0);
  });

  it('shuffles without losing items', () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffled(items).sort()).toEqual(items);
  });
});
