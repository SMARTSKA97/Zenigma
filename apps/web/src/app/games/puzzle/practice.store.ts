import { computed, inject, Injectable, signal } from '@angular/core';
import { LocalStore } from '../../core/local-store';
import { PuzzleGameId } from '../catalog';

export const LEVEL_COUNT = 200;

interface Progress {
  /** Level numbers solved on this device. */
  solved: number[];
  /** Best time in ms for each solved level. */
  best: Record<number, number>;
}

interface SavedBoard {
  level: number;
  state: unknown;
  elapsedMs: number;
}

const progressKey = (game: string) => `puzzle.progress.${game}`;
const saveKey = (game: string) => `puzzle.save.${game}`;

/** Which practice levels this device has solved, and the board in progress. Stays on the device, works offline. */
@Injectable({ providedIn: 'root' })
export class PracticeStore {
  private readonly store = inject(LocalStore);
  private readonly all = signal<Partial<Record<string, Progress>>>({});

  async load(game: PuzzleGameId): Promise<void> {
    const saved = await this.store.getMeta<Progress>(progressKey(game));
    this.all.update((all) => ({ ...all, [game]: saved ?? { solved: [], best: {} } }));
  }

  solvedLevels(game: string) {
    return computed(() => new Set(this.all()[game]?.solved ?? []));
  }

  isSolved(game: string, level: number): boolean {
    return (this.all()[game]?.solved ?? []).includes(level);
  }

  bestMs(game: string, level: number): number | null {
    return this.all()[game]?.best[level] ?? null;
  }

  /** The first level not solved yet (or the last level once everything is solved). */
  nextUnsolved(game: string): number {
    const solved = new Set(this.all()[game]?.solved ?? []);
    for (let level = 1; level <= LEVEL_COUNT; level++) if (!solved.has(level)) return level;
    return LEVEL_COUNT;
  }

  async markSolved(game: PuzzleGameId, level: number, elapsedMs: number): Promise<void> {
    const current = this.all()[game] ?? { solved: [], best: {} };
    const solved = current.solved.includes(level) ? current.solved : [...current.solved, level].sort((a, b) => a - b);
    const best = { ...current.best, [level]: Math.min(current.best[level] ?? Infinity, elapsedMs) };
    const next = { solved, best };
    this.all.update((all) => ({ ...all, [game]: next }));
    await this.store.setMeta(progressKey(game), next);
  }

  saveBoard(game: PuzzleGameId, board: SavedBoard): Promise<void> {
    return this.store.setMeta(saveKey(game), board);
  }

  loadBoard(game: PuzzleGameId): Promise<SavedBoard | undefined> {
    return this.store.getMeta<SavedBoard>(saveKey(game));
  }

  clearBoard(game: PuzzleGameId): Promise<void> {
    return this.store.deleteMeta(saveKey(game));
  }
}
