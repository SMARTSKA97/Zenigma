import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { indiaDate } from '../../core/hints.service';
import { SyncService } from '../../core/sync.service';
import { MIND_LIVE, MindGameId, Skill, SKILLS } from '../catalog';
import { markOf, MIND_META } from './mind-meta';
import { seeded } from './mind-util';

const STATE_KEY = 'zenigma.mind.daily';
const DAYS_KEY = 'zenigma.mind.daily.days';
/** Comet Slice has a daily of its own (one timed run), so it is not part of the daily set. */
const HAS_OWN_DAILY: readonly MindGameId[] = ['comet-slice'];

/** Today's mind-training set: one random game from each skill category (six games), the same for everyone on a given (India) day. */
export function mindSetFor(date: string): MindGameId[] {
  const rand = seeded(`mind-daily:${date}`);
  const pool = MIND_LIVE.filter((g) => !HAS_OWN_DAILY.includes(g));
  // Skills keep their catalogue order; each one gets one live game picked by the day's seed.
  return SKILLS.map((s) => s.id)
    .filter((id) => pool.some((g) => MIND_META[g]?.skill === id))
    .map((skill: Skill) => {
      const games = pool.filter((g) => MIND_META[g]?.skill === skill);
      return games[Math.floor(rand() * games.length)];
    });
}

interface DayState {
  date: string;
  done: Record<string, { score: number; mark: number }>;
}

/** The daily mind set: which games, what is done, the day's points and the streak of finished days. Kept on this device and in the event log. */
@Injectable({ providedIn: 'root' })
export class MindDailyService {
  private readonly sync = inject(SyncService);
  readonly date = signal(indiaDate());
  private readonly state = signal<DayState>(this.readState());
  private readonly days = signal<string[]>(this.readDays());

  readonly games = computed(() => mindSetFor(this.date()));
  readonly results = computed(() => (this.state().date === this.date() ? this.state().done : {}));
  readonly doneCount = computed(() => this.games().filter((g) => this.results()[g]).length);
  readonly complete = computed(() => this.doneCount() === this.games().length);
  /** Up to 100 per game; the day's total out of 100 for each game in the set (600 with six). */
  readonly points = computed(() => this.games().reduce((n, g) => n + (this.results()[g]?.mark ?? 0), 0));
  readonly maxPoints = computed(() => this.games().length * 100);

  /** Every day the whole set was finished (newest last). */
  readonly finishedDays = computed(() => this.days());

  /** Days in a row (up to today, or up to yesterday while today is unfinished) with the whole set done. */
  readonly streak = computed(() => {
    const done = new Set(this.days());
    let day = this.date();
    if (!done.has(day)) day = shift(day, -1);
    let n = 0;
    while (done.has(day)) {
      n++;
      day = shift(day, -1);
    }
    return n;
  });

  constructor() {
    // A finished day is in the event log, which comes back with the account: so a new device (or the installed iPhone app) shows it too.
    effect(() => {
      const events = this.sync.events();
      untracked(() => this.hydrate(events));
    });
  }

  private hydrate(events: { kind: string; payload: unknown }[]): void {
    const finished = events.filter((e) => e.kind === 'mind.daily.completed').map((e) => e.payload as { date?: string; points?: number });
    const known = new Set(this.days());
    const add = finished.map((p) => p.date).filter((d): d is string => typeof d === 'string' && !known.has(d));
    if (add.length) {
      const days = [...new Set([...this.days(), ...add])].sort().slice(-400);
      this.days.set(days);
      this.write(DAYS_KEY, days);
    }
    const today = this.date();
    const mine = finished.find((p) => p.date === today);
    if (!mine || this.complete()) return;
    const games = this.games();
    const total = Math.max(0, Math.min(600, Math.round(mine.points ?? 0)));
    const each = Math.floor(total / games.length);
    let extra = total - each * games.length;
    const current = this.state().date === today ? this.state() : { date: today, done: {} as DayState['done'] };
    const done = { ...current.done };
    for (const g of games) {
      if (done[g]) continue;
      const mark = Math.min(100, each + (extra-- > 0 ? 1 : 0));
      done[g] = { score: 0, mark };
    }
    const next: DayState = { date: today, done };
    this.state.set(next);
    this.write(STATE_KEY, next);
  }

  /** Checks the date again (the app may have stayed open past midnight in India). */
  refresh(): void {
    this.date.set(indiaDate());
  }

  inSet(game: string): boolean {
    return (this.games() as string[]).includes(game);
  }

  /** A finished game counts for the set when it is in it. Replays keep the better score. */
  record(game: string, score: number): void {
    this.refresh();
    if (!this.inSet(game)) return;
    const today = this.date();
    const current = this.state().date === today ? this.state() : { date: today, done: {} };
    const mark = markOf(game, score);
    const prev = current.done[game];
    if (prev && prev.mark >= mark) return;
    const next: DayState = { date: today, done: { ...current.done, [game]: { score, mark } } };
    this.state.set(next);
    this.write(STATE_KEY, next);
    if (this.games().every((g) => next.done[g])) {
      if (!this.days().includes(today)) {
        const days = [...this.days(), today].slice(-400);
        this.days.set(days);
        this.write(DAYS_KEY, days);
        void this.sync.record('mind.daily.completed', { date: today, games: this.games(), points: this.points() });
      }
    }
  }

  private write(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  private readState(): DayState {
    try {
      const raw = JSON.parse(localStorage.getItem(STATE_KEY) ?? 'null') as DayState | null;
      if (raw && typeof raw.date === 'string' && raw.done && typeof raw.done === 'object') return raw;
    } catch {
      /* no storage */
    }
    return { date: '', done: {} };
  }

  private readDays(): string[] {
    try {
      const raw = JSON.parse(localStorage.getItem(DAYS_KEY) ?? '[]') as unknown;
      return Array.isArray(raw) ? raw.filter((d): d is string => typeof d === 'string') : [];
    } catch {
      return [];
    }
  }
}

const shift = (date: string, days: number): string => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
