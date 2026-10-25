import { TestBed } from '@angular/core/testing';
import { MIND_META } from './mind-meta';
import { MindStore } from './mind-store';

describe('MindStore.restore', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('brings back plays and a best worked from the mark, and never lowers what is here', () => {
    const store = TestBed.inject(MindStore);
    const id = Object.keys(MIND_META)[0];
    store.restore([{ game: id, pct: 50, plays: 7 }]);
    expect(store.record(id).plays).toBe(7);
    expect(store.record(id).best).toBeGreaterThan(0);
    store.restore([{ game: id, pct: 10, plays: 2 }]);
    expect(store.record(id).plays).toBe(7);
  });

  it('ignores games it does not know', () => {
    const store = TestBed.inject(MindStore);
    store.restore([{ game: 'nope', pct: 80, plays: 3 }]);
    expect(store.gamesPlayed()).toBe(0);
  });
});
