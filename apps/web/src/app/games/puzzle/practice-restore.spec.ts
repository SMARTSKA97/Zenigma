import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { LocalStore } from '../../core/local-store';
import { MemoryStore } from '../../core/memory-store';
import { PracticeStore } from './practice.store';

describe('PracticeStore.restore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), { provide: LocalStore, useValue: new MemoryStore() }] });
  });

  const solved = (game: string, level: number, elapsedMs: number, hinted = false, variant?: string) => ({
    kind: 'puzzle.practice.solved',
    payload: { game, level, elapsedMs, hinted, variant },
  });

  it('brings back solved levels and best times from the account events', async () => {
    const store = TestBed.inject(PracticeStore);
    await store.restore([solved('queens', 1, 9000), solved('queens', 2, 8000, true), solved('queens', 1, 7000), solved('sudoku', 1, 5000, false, 'easy'), { kind: 'note.created', payload: {} }]);
    expect(store.isSolved('queens', 1)).toBe(true);
    expect(store.isSolved('queens', 2)).toBe(true);
    expect(store.bestMs('queens', 1)).toBe(7000);
    expect(store.isHinted('queens', 2)).toBe(true);
    expect(store.isHinted('queens', 1)).toBe(false);
    expect(store.isSolved('sudoku-easy', 1)).toBe(true);
    expect(store.frontier('queens')).toBe(3);
  });

  it('never loses what is already here', async () => {
    const store = TestBed.inject(PracticeStore);
    await store.markSolved('queens', 5, 4000);
    await store.restore([solved('queens', 1, 9000)]);
    expect(store.isSolved('queens', 5)).toBe(true);
    expect(store.isSolved('queens', 1)).toBe(true);
  });
});
