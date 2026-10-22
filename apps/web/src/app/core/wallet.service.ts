import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { MindDailyService } from '../games/mind/mind-daily';
import { AuthService } from './auth.service';
import { ConnectionService } from './connection.service';
import { DayStreakService } from './day-streak.service';
import { HintsService, indiaDate } from './hints.service';
import { SoundService } from './sound.service';

/** What each way of earning pays. The server holds the same table and has the last word. */
export const EARNS: Record<string, number> = { daily: 1, mindset: 3, perfect: 5, level: 1, boss: 3, quest: 1, chest: 3, streak: 10 };

export interface StoreItem {
  id: string;
  kind: 'hints' | 'accent' | 'skin';
  name: string;
  price: number;
  amount: number;
}
interface StoreState {
  coins: number;
  hints: number | null;
  owned: string[];
  spunToday: boolean;
  catalog: StoreItem[];
  today: string;
}
interface Entry {
  id: string;
  reason: string;
  ref: string;
}
export interface Quest {
  id: 'daily' | 'levels' | 'mind';
  label: string;
  goal: number;
  count: number;
  done: boolean;
}
interface QuestDay {
  date: string;
  daily: number;
  levels: number;
  mind: number;
}
interface Saved {
  coins: number;
  owned: string[];
  outbox: Entry[];
  claimed: string[];
  quests: QuestDay;
  bestStreak: number;
  spunOn: string;
}

const KEY = 'zenigma.wallet';
export const PRIZE_SLICES: ('c1' | 'c2' | 'c3' | 'c5' | 'h1' | 'h2' | 'c20')[] = ['c1', 'c2', 'h1', 'c3', 'c1', 'c5', 'h2', 'c20'];

/** Things that unlock for free by playing (kept on this device; they are only colours). Streak days in a row, both halves of the day done. */
export const STREAK_UNLOCKS: { days: number; item: string }[] = [
  { days: 3, item: 'accent:teal' },
  { days: 7, item: 'accent:rose' },
  { days: 14, item: 'skin:paper' },
  { days: 30, item: 'skin:midnight' },
];

/** Free colours everyone has. */
export const FREE_ACCENTS = ['default', 'sunset', 'forest', 'orchid', 'gold'];

export interface Cosmetic {
  id: string;
  name: string;
  color: string;
  /** Store id; absent for the free ones. */
  item?: string;
  /** Not for sale: a thank-you for supporters. */
  supporter?: boolean;
}
export const ACCENTS: Cosmetic[] = [
  { id: 'default', name: 'Ocean', color: '#2b3dae' },
  { id: 'sunset', name: 'Sunset', color: '#c2410c' },
  { id: 'forest', name: 'Forest', color: '#15803d' },
  { id: 'orchid', name: 'Orchid', color: '#a21caf' },
  { id: 'gold', name: 'Gold', color: '#a16207' },
  ...[
    ['rose', 'Rose', '#be185d'], ['teal', 'Teal', '#0f766e'], ['coral', 'Coral', '#d9482b'], ['mint', 'Mint', '#0d9473'],
    ['lime', 'Lime', '#4d7c0f'], ['sky', 'Sky', '#0369a1'], ['cyan', 'Cyan', '#0e7490'], ['indigo', 'Indigo', '#4338ca'],
    ['crimson', 'Crimson', '#b91c1c'], ['plum', 'Plum', '#7e22ce'], ['graphite', 'Graphite', '#475569'], ['bronze', 'Bronze', '#92400e'],
  ].map(([id, name, color]) => ({ id, name, color, item: `accent:${id}` })),
  { id: 'patron', name: 'Patron', color: '#db2777', item: 'accent:patron', supporter: true },
];
export const SKINS: Cosmetic[] = [
  { id: 'none', name: 'Classic', color: '#2b3dae' },
  ...[
    ['paper', 'Paper', '#f4ecd9'], ['sakura', 'Sakura', '#f8c6d4'], ['lavender', 'Lavender', '#e0d4f7'], ['mono', 'Mono', '#111111'],
    ['midnight', 'Midnight', '#1a2268'], ['evergreen', 'Evergreen', '#123524'], ['dusk', 'Dusk', '#3b1632'], ['terminal', 'Terminal', '#0f2c17'],
  ].map(([id, name, color]) => ({ id, name, color, item: `skin:${id}` })),
  { id: 'aurora', name: 'Aurora', color: '#2dd4bf', item: 'skin:aurora', supporter: true },
];
export const swatchOf = (item: string): string => [...ACCENTS, ...SKINS].find((c) => c.item === item)?.color ?? '#888888';

/**
 * Coins. Earned by playing (even offline: earns wait in a queue), spent only in the store, which needs a connection so the server can
 * keep one balance for every device. The device shows an optimistic balance and takes the server's number whenever it answers.
 */
@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly conn = inject(ConnectionService);
  private readonly hints = inject(HintsService);
  private readonly sound = inject(SoundService);
  private readonly mind = inject(MindDailyService);
  private readonly dayStreak = inject(DayStreakService);

  private saved: Saved = { coins: 0, owned: [], outbox: [], claimed: [], quests: { date: '', daily: 0, levels: 0, mind: 0 }, bestStreak: 0, spunOn: '' };
  readonly coins = signal(0);
  readonly serverOwned = signal<string[]>([]);
  readonly catalog = signal<StoreItem[]>([]);
  readonly spunToday = signal(false);
  /** India date of the last wheel spin this device knows about. */
  private readonly spunOn = signal('');
  /** True while today's wheel spin has not been used: the header counter glows. */
  readonly wheelReady = computed(() => this.spunOn() !== indiaDate());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  /** The latest reward, for the coin animation. `n` changes every time so the same amount can play twice. */
  readonly burst = signal<{ n: number; amount: number; label: string } | null>(null);
  private readonly questDay = signal<QuestDay>(this.saved.quests);
  private readonly best = signal(0);
  private burstCount = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private running = false;

  /** Everything this player may use: bought in the store, or earned by streaks. */
  readonly owned = computed(() => {
    const free = STREAK_UNLOCKS.filter((u) => this.best() >= u.days).map((u) => u.item);
    return new Set([...this.serverOwned(), ...free]);
  });

  /** What this player gave back to Zenigma: kept with the owned items, so it shows offline and on every device. */
  readonly supporterTier = computed<'champion' | 'patron' | 'supporter' | null>(() => {
    const o = this.owned();
    return o.has('badge:champion') ? 'champion' : o.has('badge:patron') ? 'patron' : o.has('badge:supporter') ? 'supporter' : null;
  });

  readonly quests = computed<Quest[]>(() => {
    const q = this.questDay();
    const today = indiaDate();
    const c = q.date === today ? q : { date: today, daily: 0, levels: 0, mind: 0 };
    return [
      { id: 'daily', label: 'Solve a daily puzzle', goal: 1, count: c.daily },
      { id: 'levels', label: 'Clear 3 practice levels', goal: 3, count: c.levels },
      { id: 'mind', label: 'Play 2 mind games', goal: 2, count: c.mind },
    ].map((x) => ({ ...x, count: Math.min(x.count, x.goal), done: x.count >= x.goal })) as Quest[];
  });
  readonly questsDone = computed(() => this.quests().filter((q) => q.done).length);

  constructor() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.saved = { ...this.saved, ...(JSON.parse(raw) as Partial<Saved>) };
    } catch {
      /* start fresh */
    }
    this.coins.set(Math.max(0, this.saved.coins));
    this.serverOwned.set(this.saved.owned);
    this.questDay.set(this.saved.quests);
    this.best.set(this.saved.bestStreak);
    this.spunOn.set(this.saved.spunOn);

    // Earn queue goes out whenever the server is reachable and the player is signed in.
    effect(() => {
      const ready = this.conn.serverReady() && this.auth.signedIn();
      if (ready && untracked(() => this.saved.outbox.length)) untracked(() => this.schedule());
    });
    // Whole-day rewards.
    effect(() => {
      if (this.mind.complete()) untracked(() => this.earn('mindset', `mindset:${this.mind.date()}`, 'Mind set complete'));
    });
    effect(() => {
      if (this.dayStreak.todayDone()) untracked(() => this.earn('perfect', `perfect:${this.mind.date()}`, 'Perfect day'));
    });
    effect(() => {
      const streak = this.dayStreak.streak();
      untracked(() => {
        if (streak > this.saved.bestStreak) {
          this.saved.bestStreak = streak;
          this.best.set(streak);
          this.persist();
        }
      });
    });
  }

  private persist(): void {
    this.saved.coins = this.coins();
    try {
      localStorage.setItem(KEY, JSON.stringify(this.saved));
    } catch {
      /* ignore */
    }
  }

  /** Pays coins for something that happened. `ref` names it, so the same thing never pays twice (here or on the server). */
  earn(reason: keyof typeof EARNS, ref: string, label = 'Coins earned'): void {
    if (this.saved.claimed.includes(ref)) return;
    const amount = EARNS[reason];
    this.saved.claimed = [...this.saved.claimed, ref].slice(-400);
    this.saved.outbox = [...this.saved.outbox, { id: crypto.randomUUID(), reason, ref }].slice(-200);
    this.coins.update((c) => c + amount);
    this.persist();
    this.celebrate(amount, label);
    this.schedule();
  }

  /** Shows (and plays) a coin reward. */
  celebrate(amount: number, label: string): void {
    this.burst.set({ n: ++this.burstCount, amount, label });
    if (amount >= 20) this.sound.coins(Math.min(6, Math.ceil(amount / 10)));
    else this.sound.coin();
  }

  /** A quest counter went up: a practice level, a mind game, a daily. Finishing a quest pays; finishing all three pays the chest. */
  note(kind: 'daily' | 'levels' | 'mind'): void {
    const today = indiaDate();
    const q: QuestDay = this.saved.quests.date === today ? { ...this.saved.quests } : { date: today, daily: 0, levels: 0, mind: 0 };
    const before = this.questsFor(q);
    q[kind]++;
    this.saved.quests = q;
    this.questDay.set(q);
    this.persist();
    const after = this.questsFor(q);
    for (const [id, done] of Object.entries(after)) if (done && !before[id as keyof typeof before]) this.earn('quest', `quest:${today}:${id}`, 'Quest done');
    if (Object.values(after).every(Boolean) && !Object.values(before).every(Boolean)) this.earn('chest', `quest:${today}:chest`, 'Daily chest');
  }

  private questsFor(q: QuestDay) {
    return { daily: q.daily >= 1, levels: q.levels >= 3, mind: q.mind >= 2 };
  }

  // ---- the store (online only) ----

  private pendingCoins(): number {
    return this.saved.outbox.reduce((n, e) => n + (EARNS[e.reason] ?? 0), 0);
  }

  private apply(state: StoreState): void {
    this.coins.set(state.coins + this.pendingCoins());
    this.serverOwned.set(state.owned);
    this.catalog.set(state.catalog);
    this.spunToday.set(state.spunToday);
    if (state.spunToday) {
      this.saved.spunOn = state.today;
      this.spunOn.set(state.today);
    }
    this.saved.owned = state.owned;
    this.persist();
    if (state.hints != null) this.hints.applyServer([], state.hints);
  }

  /** Opens the store: sends waiting earns, then loads the catalog and the balance. */
  async refresh(): Promise<boolean> {
    if (!this.auth.signedIn() || !(await this.conn.wake())) {
      this.error.set(this.auth.signedIn() ? 'The store needs a connection.' : 'Sign in to use the store.');
      return false;
    }
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.flush();
      this.apply(await firstValueFrom(this.http.get<StoreState>(`${environment.apiBaseUrl}/store`)));
      return true;
    } catch {
      this.error.set('Could not load the store. Try again in a moment.');
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 2500);
  }

  async flush(): Promise<void> {
    if (this.running || !this.auth.signedIn() || !this.conn.serverReady() || !this.saved.outbox.length) return;
    this.running = true;
    try {
      const entries = this.saved.outbox.slice(0, 50);
      const response = await firstValueFrom(this.http.post<{ coins: number }>(`${environment.apiBaseUrl}/store/earn`, { entries }));
      const sent = new Set(entries.map((e) => e.id));
      this.saved.outbox = this.saved.outbox.filter((e) => !sent.has(e.id));
      this.coins.set(response.coins + this.pendingCoins());
      this.persist();
    } catch {
      /* offline or asleep: they go next time */
    } finally {
      this.running = false;
    }
  }

  async buy(item: StoreItem): Promise<{ ok: boolean; message?: string }> {
    try {
      await this.flush();
      this.apply(await firstValueFrom(this.http.post<StoreState>(`${environment.apiBaseUrl}/store/buy`, { item: item.id })));
      this.sound.win();
      return { ok: true };
    } catch (e) {
      return { ok: false, message: this.messageOf(e) };
    }
  }

  async spin(): Promise<{ kind: 'coins' | 'hints'; amount: number } | null> {
    try {
      const r = await firstValueFrom(this.http.post<{ prize: { kind: 'coins' | 'hints'; amount: number }; state: StoreState }>(`${environment.apiBaseUrl}/store/wheel`, {}));
      // Keep the old balance until the animation ends; `land()` shows the new one.
      this.landing = r.state;
      return r.prize;
    } catch (e) {
      this.error.set(this.messageOf(e));
      return null;
    }
  }

  private landing: StoreState | null = null;
  /** The wheel stopped: show what it paid. */
  land(prize: { kind: string; amount: number }): void {
    if (this.landing) this.apply(this.landing);
    this.landing = null;
    if (prize.kind === 'coins') this.celebrate(prize.amount, 'Wheel prize');
    else this.sound.win();
  }

  private messageOf(e: unknown): string {
    if (e instanceof HttpErrorResponse) return (e.error?.error as string | undefined) ?? (e.status === 0 ? 'The store needs a connection.' : 'Something went wrong. Try again.');
    return 'Something went wrong. Try again.';
  }
}
