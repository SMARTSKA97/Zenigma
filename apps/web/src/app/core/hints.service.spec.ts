import { beforeEach, describe, expect, it } from 'vitest';
import { FREE_CAP, HintsService, indiaDate, START_HINTS } from './hints.service';

describe('HintsService', () => {
  beforeEach(() => localStorage.removeItem('zenigma.hints'));

  it('starts with three hints and never goes below zero', () => {
    const hints = new HintsService();
    expect(hints.balance()).toBe(START_HINTS);
    for (let i = 0; i < START_HINTS; i++) expect(hints.spend()).toBe(true);
    expect(hints.spend()).toBe(false);
    expect(hints.balance()).toBe(0);
  });

  it('caps free hints and remembers the balance', () => {
    const hints = new HintsService();
    expect(hints.grant(50)).toBe(FREE_CAP - START_HINTS);
    expect(hints.balance()).toBe(FREE_CAP);
    expect(new HintsService().balance()).toBe(FREE_CAP);
  });

  it('spins once a day and always pays at least one hint', () => {
    const hints = new HintsService();
    hints.spend();
    hints.spend();
    expect(hints.spin(0.99)?.hints).toBe(3);
    expect(hints.balance()).toBe(START_HINTS - 2 + 3);
    expect(hints.canSpin()).toBe(false);
    expect(hints.spin(0.1)).toBeNull();
    expect(indiaDate(Date.UTC(2026, 9, 12, 19, 0))).toBe('2026-10-13'); // 00:30 in India is already the next day
  });

  it('pays a milestone hint once per tenth level', () => {
    const hints = new HintsService();
    hints.spend();
    expect(hints.milestone('queens', 7)).toBe(false);
    expect(hints.milestone('queens', 10)).toBe(true);
    expect(hints.milestone('queens', 10)).toBe(false);
    expect(hints.milestone('tango', 10)).toBe(true);
  });
});
