import { Injectable, signal } from '@angular/core';

/** One earn or spend, waiting to be sent to the server (which counts each id once). */
export interface HintEntry {
  id: string;
  delta: number;
  reason: string;
}

const KEY = 'zenigma.hints';
/** Hints from free sources never pile up beyond this, so a stash cannot trivialise the levels. */
export const FREE_CAP = 6;
export const START_HINTS = 3;

interface Saved {
  balance: number;
  /** India date (YYYY-MM-DD) of the last wheel spin. */
  spun: string;
  /** India date of the last "first win of the day" roll. */
  firstWin: string;
  /** `track:level` keys that already paid a milestone hint. */
  milestones: string[];
  /** India date of the last time the app was opened (for the comeback gift). */
  lastVisit: string;
  /** `game:days:streakStart` keys of streak rewards already paid. */
  streakAwards: string[];
  /** Earns and spends the server has not seen yet. */
  outbox: HintEntry[];
}

export interface WheelPrize {
  hints: 1 | 2 | 3;
}

/** India date, since every daily in Zenigma resets at midnight there. */
export const indiaDate = (now = Date.now()): string => new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);

/**
 * The hint balance. Hints exist only in practice, so nothing that can be earned here ever touches a daily or a leaderboard.
 * The device plays from its own copy (so it works offline); signed-in players also have a server balance that every device
 * follows. Each earn or spend is queued as an entry and sent by HintsSyncService, which hands back the balance to show.
 */
@Injectable({ providedIn: 'root' })
export class HintsService {
  readonly balance = signal(START_HINTS);
  private saved: Saved = { balance: START_HINTS, spun: '', firstWin: '', milestones: [], lastVisit: '', streakAwards: [], outbox: [] };
  /** Bumped whenever the date or wheel state changes, so the wheel button redraws. */
  readonly spunToday = signal(false);
  /** Bumped on every change, so the sync service knows when there is something to send. */
  readonly version = signal(0);
  /** A gift just received (comeback or streak), shown once on Home until dismissed. */
  readonly gift = signal<string | null>(null);

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
    this.version.update((v) => v + 1);
    this.persist();
  }

  private persist(): void {
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
    this.queue(-1, 'hint');
    this.save();
    return true;
  }

  /** True while there is room for more hints from free sources. */
  hasRoom(): boolean {
    return this.balance() < FREE_CAP;
  }

  /** Entries for the server, oldest first. */
  pending(max = 100): HintEntry[] {
    return this.saved.outbox.slice(0, max);
  }

  /** The server accepted these entries and says the balance is `balance`; entries made since still count. */
  applyServer(sent: string[], balance: number): void {
    const done = new Set(sent);
    this.saved.outbox = this.saved.outbox.filter((e) => !done.has(e.id));
    const waiting = this.saved.outbox.reduce((n, e) => n + e.delta, 0);
    this.balance.set(Math.max(0, Math.min(FREE_CAP + 90, balance + waiting)));
    this.persist(); // not a change the server needs to hear about
  }

  /** `id` is fixed for things that may happen only once (a day's spin), so a second device cannot be paid twice: the server counts each id once. */
  private queue(delta: number, reason: string, id: string = crypto.randomUUID()): void {
    this.saved.outbox = [...this.saved.outbox, { id, delta, reason }].slice(-300);
  }

  /**
   * Gives hints from a free source (capped at the stash size). A reward the player has earned and collects themselves
   * (a goal or a badge) passes `earned` and is paid in full, even over the cap. Returns how many were actually added.
   */
  grant(count: number, reason = 'earn', id?: string, earned = false): number {
    const room = earned ? count : Math.max(0, FREE_CAP - this.balance());
    const added = Math.min(count, room);
    if (added > 0) {
      this.balance.update((b) => b + added);
      this.queue(added, reason, id);
      this.save();
    }
    return added;
  }

  /** The daily spin is ready, and there is room to keep what it pays (a full stash never wastes a spin). */
  canSpin(): boolean {
    return this.saved.spun !== indiaDate() && this.hasRoom();
  }

  /** One spin a day. 1 hint is most common, 3 is rare; there is never an empty result. */
  spin(random = Math.random()): WheelPrize | null {
    if (!this.canSpin()) return null;
    const hints: 1 | 2 | 3 = random < 0.75 ? 1 : random < 0.95 ? 2 : 3;
    this.saved.spun = indiaDate();
    this.spunToday.set(true);
    this.grant(hints, 'wheel', `wheel:${indiaDate()}`);
    this.save();
    return { hints };
  }

  /** Every 10th level cleared (the zone boss) pays one hint, once. */
  milestone(track: string, level: number): boolean {
    if (level % 10 !== 0 || !this.hasRoom()) return false;
    const key = `${track}:${level}`;
    if (this.saved.milestones.includes(key)) return false;
    this.saved.milestones = [...this.saved.milestones, key].slice(-200);
    this.save();
    return this.grant(1, 'milestone') > 0;
  }

  /** First practice win of the day: a one in five chance of a hint. */
  firstWinOfDay(random = Math.random()): boolean {
    const today = indiaDate();
    if (this.saved.firstWin === today || !this.hasRoom()) return false;
    this.saved.firstWin = today;
    this.save();
    return random < 1 / 5 && this.grant(1, 'first-win') > 0;
  }

  /** Opening the app after a week or more away brings a free hint. */
  visit(now = Date.now()): void {
    const today = indiaDate(now);
    const last = this.saved.lastVisit;
    if (last === today) return;
    this.saved.lastVisit = today;
    this.save();
    if (last && daysBetween(last, today) >= 7 && this.grant(1, 'welcome-back') > 0) this.gift.set('Welcome back! Here is a free hint 💡');
  }

  /** A hint for reaching a 7-day and a 30-day streak in a game (once per streak). */
  claimStreaks(games: { name: string; game: string; current: number }[], today: string): void {
    const won: string[] = [];
    for (const g of games) {
      for (const days of [7, 30]) {
        if (g.current < days) continue;
        const key = `${g.game}:${days}:${shiftDate(today, -(g.current - 1))}`;
        if (this.saved.streakAwards.includes(key)) continue;
        this.saved.streakAwards = [...this.saved.streakAwards, key].slice(-100);
        if (this.grant(1, 'streak') > 0) won.push(`${days}-day ${g.name} streak`);
      }
    }
    this.save();
    if (won.length) this.gift.set(`${won.join(' and ')}: +${won.length} hint${won.length > 1 ? 's' : ''} 💡`);
  }
}

const daysBetween = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const shiftDate = (date: string, days: number): string => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
