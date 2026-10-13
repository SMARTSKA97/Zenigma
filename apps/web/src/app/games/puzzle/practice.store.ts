import { computed, inject, Injectable, signal } from '@angular/core';
import { LocalStore } from '../../core/local-store';
import { levelCountOf } from '../catalog';

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

const progressKey = (game: string) => `puzzle.progress.${game}`;
const saveKey = (game: string) => `puzzle.save.${game}`;

/** Which practice levels this device (per track: a game, or a game's variant, see `trackOf`) has solved, and the board in progress. Stays on the device, works offline. */
@Injectable({ providedIn: 'root' })
export class PracticeStore {
  private readonly store = inject(LocalStore);
  private readonly all = signal<Partial<Record<string, Progress>>>({});

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
    const solved = this.all()[game]?.solved ?? [];
    const top = Math.max(solved.length ? Math.max(...solved) : 0, this.all()[game]?.skip ?? 0);
    return Math.min(levelCountOf(game), top + 1);
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
    const top = Math.max(current.solved.length ? Math.max(...current.solved) : 0, current.skip ?? 0);
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
