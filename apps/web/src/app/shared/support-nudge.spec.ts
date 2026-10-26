import { shouldNudge } from './support-nudge';

const DAY = 86_400_000;
const now = 100 * DAY;

describe('support nudge', () => {
  it('waits a week and some play', () => {
    expect(shouldNudge({ first: now - 3 * DAY, last: 0, never: false }, 100, now)).toBe(false);
    expect(shouldNudge({ first: now - 10 * DAY, last: 0, never: false }, 5, now)).toBe(false);
    expect(shouldNudge({ first: now - 10 * DAY, last: 0, never: false }, 30, now)).toBe(true);
  });
  it('asks at most once a month', () => {
    expect(shouldNudge({ first: 0, last: now - 10 * DAY, never: false }, 99, now)).toBe(false);
    expect(shouldNudge({ first: 0, last: now - 31 * DAY, never: false }, 99, now)).toBe(true);
  });
  it('stops for good after "Don\'t ask again"', () => {
    expect(shouldNudge({ first: 0, last: 0, never: true }, 999, now)).toBe(false);
  });
});
