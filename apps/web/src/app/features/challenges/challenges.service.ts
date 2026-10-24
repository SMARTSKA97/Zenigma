import { computed, inject, Injectable, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { HintsService } from '../../core/hints.service';
import { Stats, StatsService } from '../../core/stats.service';
import { SyncService } from '../../core/sync.service';
import { MindStore } from '../../games/mind/mind-store';
import { Activity, ChallengeState, Period, progressFor, windowOf } from './challenge-engine';

const CLAIMED_KEY = 'zenigma.challenges.claimed';
const PAID_KEY = 'zenigma.challenges.paid';

/** What the player solved, from the event log (practice, Word Guess) and the daily stats (signed in). */
export function activityFrom(events: { kind: string; payload: unknown; clientCreatedAt: string }[], stats: Stats | null, mind: { id: string; at: number }[] = []): Activity[] {
  const out: Activity[] = mind.map((m) => ({ at: new Date(m.at), game: m.id, kind: 'mind' as const, id: `${m.id}:${m.at}` }));
  for (const e of events) {
    const at = new Date(e.clientCreatedAt);
    if (Number.isNaN(at.getTime())) continue;
    const p = e.payload as { game?: string; variant?: string; level?: number; hinted?: boolean; mode?: string; status?: string; answer?: string } | null;
    if (e.kind === 'puzzle.practice.solved' && p?.game && p.level) {
      out.push({ at, game: p.game, variant: p.variant, kind: 'practice', clean: p.hinted === undefined ? undefined : !p.hinted, id: `${p.game}:${p.variant ?? ''}:${p.level}` });
    } else if (e.kind === 'wordguess.finished' && p?.mode === 'practice' && p.status === 'won') {
      out.push({ at, game: 'word-guess', kind: 'practice', id: `word-guess::${p.answer ?? at.getTime()}` });
    }
  }
  // Dailies come from the server's stats: each game lists the days it was solved in the last five weeks.
  for (const g of stats?.games ?? []) {
    for (const day of g.recent) out.push({ at: new Date(`${day}T12:00:00`), game: g.game, kind: 'daily', id: `${g.game}:${day}` });
  }
  return out;
}

/** Weekly, weekend and monthly goals with their progress, and collecting the hints they earn. */
@Injectable({ providedIn: 'root' })
export class ChallengesService {
  private readonly sync = inject(SyncService);
  private readonly auth = inject(AuthService);
  private readonly statsApi = inject(StatsService);
  private readonly hints = inject(HintsService);
  private readonly mind = inject(MindStore);

  readonly stats = signal<Stats | null>(null);
  readonly now = signal(new Date());
  private readonly claimed = signal<string[]>(this.readClaimed());
  /** Hints already paid out for a goal whose reward did not fit in the stash (the rest stays collectable). */
  private readonly paid = signal<Record<string, number>>(this.readPaid());

  readonly activity = computed(() => activityFrom(this.sync.events(), this.stats(), this.mind.plays()));

  readonly sets = computed<Record<Period, ChallengeState[]>>(() => {
    const now = this.now();
    const activity = this.activity();
    return {
      weekly: progressFor(windowOf('weekly', now), activity),
      weekend: progressFor(windowOf('weekend', now), activity),
      monthly: progressFor(windowOf('monthly', now), activity),
    };
  });

  /** Goals finished but not yet collected (the number on the badge in the app). */
  readonly toCollect = computed(() => Object.values(this.sets()).flat().filter((c) => c.done && !this.isClaimed(c)).length);
  /** All goals ever collected on this device. */
  readonly collected = computed(() => this.claimed().length);

  async load(): Promise<void> {
    this.now.set(new Date());
    if (!this.auth.signedIn()) return;
    try {
      this.stats.set(await this.statsApi.load());
    } catch {
      /* offline: practice goals still work */
    }
  }

  isClaimed(c: ChallengeState): boolean {
    return this.claimed().includes(c.claimKey);
  }

  /** Hints still to collect for a goal (its reward minus anything already paid). */
  owed(c: ChallengeState): number {
    return this.isClaimed(c) ? 0 : c.template.reward - (this.paid()[c.claimKey] ?? 0);
  }


  /**
   * Collects the hints for a finished goal. Earned rewards are always paid in full, even when the stash is at its cap. Returns how many were added.
   */
  claim(c: ChallengeState): number {
    if (!c.done || this.isClaimed(c)) return 0;
    const added = this.hints.grant(this.owed(c), 'challenge', undefined, true);
    if (added === 0) return 0;
    const paid = { ...this.paid(), [c.claimKey]: (this.paid()[c.claimKey] ?? 0) + added };
    if (paid[c.claimKey] >= c.template.reward) {
      delete paid[c.claimKey];
      const next = [...this.claimed(), c.claimKey].slice(-400);
      this.claimed.set(next);
      this.store(CLAIMED_KEY, next);
    }
    this.paid.set(paid);
    this.store(PAID_KEY, paid);
    return added;
  }

  private store(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }

  private readPaid(): Record<string, number> {
    try {
      const raw = JSON.parse(localStorage.getItem(PAID_KEY) ?? '{}') as unknown;
      return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, number>) : {};
    } catch {
      return {};
    }
  }

  private readClaimed(): string[] {
    try {
      const raw = JSON.parse(localStorage.getItem(CLAIMED_KEY) ?? '[]') as unknown;
      return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
}
