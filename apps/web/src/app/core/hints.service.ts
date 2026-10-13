import { Injectable, signal } from '@angular/core';

const KEY = 'zenigma.hints';
/** Hints from free sources never pile up beyond this, so a stash cannot trivialise the levels. */
export const FREE_CAP = 10;
export const START_HINTS = 3;

interface Saved {
  balance: number;
  /** India date (YYYY-MM-DD) of the last wheel spin. */
  spun: string;
  /** India date of the last "first win of the day" roll. */
  firstWin: string;
  /** `track:level` keys that already paid a milestone hint. */
  milestones: string[];
}

export interface WheelPrize {
  hints: 1 | 2 | 3;
}

/** India date, since every daily in Zenigma resets at midnight there. */
export const indiaDate = (now = Date.now()): string => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);

/**
 * The hint balance. Hints exist only in practice, so nothing that can be earned here ever touches a daily or a leaderboard;
 * that is why the balance can live on the device (a future server balance is only needed for purchases).
 */
@Injectable({ providedIn: 'root' })
export class HintsService {
  readonly balance = signal(START_HINTS);
  private saved: Saved = { balance: START_HINTS, spun: '', firstWin: '', milestones: [] };
  /** Bumped whenever the date or wheel state changes, so the wheel button redraws. */
  readonly spunToday = signal(false);

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.saved = { ...this.saved, ...(JSON.parse(raw) as Partial<Saved>) };
    } catch {
      /* storage unavailable: start fresh each time */
    }
    this.balance.set(Math.max(0, this.saved.balance));
    this.spunToday.set(this.saved.spun === indiaDate());
  }

  private save(): void {
    this.saved.balance = this.balance();
    try {
      localStorage.setItem(KEY, JSON.stringify(this.saved));
    } catch {
      /* ignore */
    }
  }

  /** Spends one hint. False when there are none. */
  spend(): boolean {
    if (this.balance() < 1) return false;
    this.balance.update((b) => b - 1);
    this.save();
    return true;
  }

  /** Gives hints from a free source (capped). Returns how many were actually added. */
  grant(count: number): number {
    const room = Math.max(0, FREE_CAP - this.balance());
    const added = Math.min(count, room);
    if (added > 0) {
      this.balance.update((b) => b + added);
      this.save();
    }
    return added;
  }

  canSpin(): boolean {
    return this.saved.spun !== indiaDate();
  }

  /** One spin a day. 1 hint is most common, 3 is rare; there is never an empty result. */
  spin(random = Math.random()): WheelPrize | null {
    if (!this.canSpin()) return null;
    const hints: 1 | 2 | 3 = random < 0.6 ? 1 : random < 0.9 ? 2 : 3;
    this.saved.spun = indiaDate();
    this.spunToday.set(true);
    this.grant(hints);
    this.save();
    return { hints };
  }

  /** Every 10th level cleared (the zone boss) pays one hint, once. */
  milestone(track: string, level: number): boolean {
    if (level % 10 !== 0) return false;
    const key = `${track}:${level}`;
    if (this.saved.milestones.includes(key)) return false;
    this.saved.milestones = [...this.saved.milestones, key].slice(-200);
    this.save();
    return this.grant(1) > 0;
  }

  /** First practice win of the day: a one in three chance of a hint. */
  firstWinOfDay(random = Math.random()): boolean {
    const today = indiaDate();
    if (this.saved.firstWin === today) return false;
    this.saved.firstWin = today;
    this.save();
    return random < 1 / 3 && this.grant(1) > 0;
  }
}
