import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth.service';
import { ConnectionService } from '../../core/connection.service';
import { LocalStore } from '../../core/local-store';
import { SyncService } from '../../core/sync.service';
import { levelCountOf, trackOf } from '../catalog';

/** Levels come in zones of ten: each climbs from easy (the first) to hard (the tenth). */
export const ZONE_SIZE = 10;

interface Progress {
  /** Level numbers solved on this device. */
  solved: number[];
  /** Best time in ms for each solved level. */
  best: Record<number, number>;
  /** Levels solved with the help of a hint (they earn at most two stars). */
  hinted?: number[];
  /** Levels up to this one are open even though they were skipped ("skip ahead" after a run of quick, clean wins). */
  skip?: number;
  /** Quick, clean wins in a row (3-star levels without a hint). */
  quick?: number;
}

interface SavedBoard {
  level: number;
  state: unknown;
  elapsedMs: number;
  /** Hints used on this level so far. */
  hints?: number;
  /** When it was saved (ms), so Home can offer the most recent board. */
  savedAt?: number;
}

/**
 * The furthest level reached: the unbroken run of solved levels from the start (or from a "skip ahead"), so a level solved out of
 * turn (a friend's challenge link, the featured level of the week) never opens the levels in between.
 */
export function reach(p: Pick<Progress, 'solved' | 'skip'> | undefined): number {
  const solved = new Set(p?.solved ?? []);
  let top = p?.skip ?? 0;
  while (solved.has(top + 1)) top++;
  return top;
}

const progressKey = (game: string) => `puzzle.progress.${game}`;
const saveKey = (game: string) => `puzzle.save.${game}`;

/** Which practice levels this device (per track: a game, or a game's variant, see `trackOf`) has solved, and the board in progress. Stays on the device, works offline. */
@Injectable({ providedIn: 'root' })
export class PracticeStore {
  private readonly store = inject(LocalStore);
  private readonly sync = inject(SyncService);
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly conn = inject(ConnectionService);
  private pulled = false;
  private readonly all = signal<Partial<Record<string, Progress>>>({});
  private restoring = false;
  private again: { kind: string; payload: unknown }[] | null = null;

  constructor() {
    // Every solved level is an event in the account's log, and it comes back with sign-in. So a new device (or the installed iPhone app,
    // whose storage is apart from Safari's) gets its solved levels and best times back, instead of starting from level 1.
    effect(() => {
      const events = this.sync.events();
      untracked(() => void this.restore(events));
    });
    // The server keeps every verified solve, so signed in and online, ask it too (once per session): it covers solves whose events
    // this device never pulled, and it is what "Sync now" in Settings runs again.
    effect(() => {
      const ready = this.conn.serverReady() && this.auth.signedIn();
      if (ready) untracked(() => void this.pullFromServer());
    });
  }

  /** Brings the account's solved levels from the server into this device. Returns how many levels were new here, or null when it could not be reached. */
  async pullFromServer(force = false): Promise<number | null> {
    if (this.pulled && !force) return 0;
    this.pulled = true;
    try {
      const res = await firstValueFrom(
        this.http.get<{ solves: { game: string; variant: string | null; level: number; elapsedMs: number | null }[] }>(`${environment.apiBaseUrl}/practice/progress`),
      );
      const before = this.count();
      await this.restore(
        res.solves.map((s) => ({
          kind: 'puzzle.practice.solved',
          payload: { game: s.game, variant: s.variant ?? undefined, level: s.level, elapsedMs: s.elapsedMs ?? undefined, hinted: true },
        })),
      );
      return Math.max(0, this.count() - before);
    } catch {
      this.pulled = false;
      return null;
    }
  }

  private count(): number {
    return Object.values(this.all()).reduce((n, p) => n + (p?.solved.length ?? 0), 0);
  }

  /** Merges the solved levels found in the event log into this device's progress. Never removes or worsens anything. */
  async restore(events: { kind: string; payload: unknown }[]): Promise<void> {
    if (this.restoring) {
      this.again = events; // events arrived mid-run: go through them once more afterwards
      return;
    }
    this.restoring = true;
    try {
      const found = new Map<string, { solved: Set<number>; best: Map<number, number>; clean: Set<number> }>();
      for (const e of events) {
        if (e.kind !== 'puzzle.practice.solved') continue;
        const p = e.payload as { game?: string; variant?: string; level?: number; elapsedMs?: number; hinted?: boolean } | null;
        if (!p?.game || !Number.isInteger(p.level) || (p.level as number) < 1) continue;
        const track = trackOf(p.game, p.variant);
        const f = found.get(track) ?? { solved: new Set<number>(), best: new Map<number, number>(), clean: new Set<number>() };
        const level = p.level as number;
        f.solved.add(level);
        if (typeof p.elapsedMs === 'number' && p.elapsedMs > 0) f.best.set(level, Math.min(f.best.get(level) ?? Infinity, p.elapsedMs));
        if (!p.hinted) f.clean.add(level);
        found.set(track, f);
      }
      for (const [track, f] of found) {
        const current = this.all()[track] ?? (await this.store.getMeta<Progress>(progressKey(track))) ?? { solved: [], best: {} };
        const solved = new Set(current.solved);
        let changed = false;
        for (const l of f.solved) if (!solved.has(l)) (solved.add(l), (changed = true));
        const best = { ...current.best };
        for (const [l, ms] of f.best) if (best[l] === undefined || ms < best[l]) (best[l] = ms, (changed = true));
        // Hinted unless it was ever solved clean.
        const hinted = new Set(current.hinted ?? []);
        for (const l of f.solved) {
          if (f.clean.has(l)) hinted.delete(l);
          else if (!current.solved.includes(l)) hinted.add(l);
        }
        if (!changed) continue;
        const next: Progress = { ...current, solved: [...solved].sort((a, b) => a - b), best, hinted: [...hinted] };
        this.all.update((all) => ({ ...all, [track]: next }));
        await this.store.setMeta(progressKey(track), next);
      }
    } finally {
      this.restoring = false;
      const next = this.again;
      this.again = null;
      if (next) void this.restore(next);
    }
  }

  async load(game: string): Promise<void> {
    const saved = await this.store.getMeta<Progress>(progressKey(game));
    this.all.update((all) => ({ ...all, [game]: saved ?? { solved: [], best: {} } }));
  }

  solvedLevels(game: string) {
    return computed(() => new Set(this.all()[game]?.solved ?? []));
  }

  isSolved(game: string, level: number): boolean {
    return (this.all()[game]?.solved ?? []).includes(level);
  }

  isHinted(game: string, level: number): boolean {
    return (this.all()[game]?.hinted ?? []).includes(level);
  }

  bestMs(game: string, level: number): number | null {
    return this.all()[game]?.best[level] ?? null;
  }

  /** The level to play next: one past the furthest level solved (levels further on stay locked until it is solved). */
  frontier(game: string): number {
    return Math.min(levelCountOf(game), reach(this.all()[game]) + 1);
  }

  isUnlocked(game: string, level: number): boolean {
    return level >= 1 && level <= this.frontier(game);
  }

  /** The first level not solved yet (or the last level once everything is solved). */
  nextUnsolved(game: string): number {
    const solved = new Set(this.all()[game]?.solved ?? []);
    for (let level = 1; level <= levelCountOf(game); level++) if (!solved.has(level)) return level;
    return levelCountOf(game);
  }

  async markSolved(game: string, level: number, elapsedMs: number, hinted = false): Promise<void> {
    const current = this.all()[game] ?? { solved: [], best: {} };
    const solved = current.solved.includes(level) ? current.solved : [...current.solved, level].sort((a, b) => a - b);
    const best = { ...current.best, [level]: Math.min(current.best[level] ?? Infinity, elapsedMs) };
    // A level solved clean once stays clean; one solved with help is marked until it is replayed without.
    const was = current.hinted ?? [];
    const hintedList = hinted ? (was.includes(level) ? was : [...was, level]) : was.filter((l) => l !== level);
    const next = { ...current, solved, best, hinted: hintedList };
    this.all.update((all) => ({ ...all, [game]: next }));
    await this.store.setMeta(progressKey(game), next);
  }

  /** Quick, clean wins in a row on a track. */
  quickWins(game: string): number {
    return this.all()[game]?.quick ?? 0;
  }

  /** Counts a win towards the "skip ahead" offer: three stars with no hint adds one, anything else starts again. */
  async noteWin(game: string, stars: number, hinted: boolean): Promise<void> {
    const current = this.all()[game] ?? { solved: [], best: {} };
    const next = { ...current, quick: stars >= 3 && !hinted ? (current.quick ?? 0) + 1 : 0 };
    this.all.update((all) => ({ ...all, [game]: next }));
    await this.store.setMeta(progressKey(game), next);
  }

  /** Opens the next `count` levels after the furthest one solved, for players who are finding it too easy. */
  async skipAhead(game: string, count = 5): Promise<void> {
    const current = this.all()[game] ?? { solved: [], best: {} };
    const top = reach(current);
    const next = { ...current, skip: Math.min(levelCountOf(game) - 1, top + count), quick: 0 };
    this.all.update((all) => ({ ...all, [game]: next }));
    await this.store.setMeta(progressKey(game), next);
  }

  saveBoard(game: string, board: SavedBoard): Promise<void> {
    return this.store.setMeta(saveKey(game), { ...board, savedAt: Date.now() });
  }

  loadBoard(game: string): Promise<SavedBoard | undefined> {
    return this.store.getMeta<SavedBoard>(saveKey(game));
  }

  clearBoard(game: string): Promise<void> {
    return this.store.deleteMeta(saveKey(game));
  }
}
