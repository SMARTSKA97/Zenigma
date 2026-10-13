import { CanDeactivateFn } from '@angular/router';

/** A page that can stop a stray Back press, swipe or tap from walking out of a game in progress. */
export interface CanLeave {
  /** True to let the person go; or a promise that settles once they have answered "Leave this game?". */
  canLeave(): boolean | Promise<boolean>;
}

export const leaveGuard: CanDeactivateFn<CanLeave> = (page) => page.canLeave?.() ?? true;
