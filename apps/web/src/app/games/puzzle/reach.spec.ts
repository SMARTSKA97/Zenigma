import { describe, expect, it } from 'vitest';
import { reach } from './practice.store';

describe('reach', () => {
  it('is the unbroken run of solved levels from the start', () => {
    expect(reach(undefined)).toBe(0);
    expect(reach({ solved: [1, 2, 3] })).toBe(3);
    expect(reach({ solved: [1, 2, 3, 7] })).toBe(3);
  });

  it('does not let a level solved out of turn open the ones before it', () => {
    expect(reach({ solved: [900] })).toBe(0);
    expect(reach({ solved: [1, 2, 500] })).toBe(2);
  });

  it('continues from a skip ahead', () => {
    expect(reach({ solved: [], skip: 5 })).toBe(5);
    expect(reach({ solved: [6, 7], skip: 5 })).toBe(7);
    expect(reach({ solved: [1, 2, 3, 4, 5, 6], skip: 5 })).toBe(6);
  });
});
