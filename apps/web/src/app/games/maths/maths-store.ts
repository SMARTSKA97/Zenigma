import { computed, Injectable, signal } from '@angular/core';
import { Level, TRICKS, tricksOf } from './maths-data';

export interface DrillRecord {
  plays: number;
  /** Most right answers in one drill (out of 10). */
  best: number;
  /** Fastest drill with the best score, in milliseconds. */
  bestMs: number;
}

/** A drill counts as "got it" at this many right out of 10. */
export const MASTERY = 8;
const KEY = 'zenigma.maths.v1';

/** Maths practice progress, kept on this device: a record per trick and level. */
@Injectable({ providedIn: 'root' })
export class MathsStore {
  private readonly all = signal<Record<string, DrillRecord>>(this.read());

  record(trick: string, level: Level): DrillRecord {
    return this.all()[`${trick}:${level}`] ?? { plays: 0, best: 0, bestMs: 0 };
  }

  /** Saves a finished drill. True when it beats the previous best. */
  add(trick: string, level: Level, correct: number, ms: number): boolean {
    const cur = this.record(trick, level);
    const better = correct > cur.best || (correct === cur.best && (cur.bestMs === 0 || ms < cur.bestMs));
    const next: DrillRecord = { plays: cur.plays + 1, best: better ? correct : cur.best, bestMs: better ? ms : cur.bestMs };
    this.all.update((a) => ({ ...a, [`${trick}:${level}`]: next }));
    try {
      localStorage.setItem(KEY, JSON.stringify(this.all()));
    } catch {
      /* the record just does not persist */
    }
    return better && correct > 0;
  }

  /** Levels (0 to 3) of a trick that have been got. */
  got(trick: string): number {
    return ([1, 2, 3] as Level[]).filter((l) => this.record(trick, l).best >= MASTERY).length;
  }

  readonly totalGot = computed(() => TRICKS.reduce((n, t) => n + this.got(t.id), 0));
  readonly totalPossible = TRICKS.length * 3;

  topicGot(topic: string): number {
    return tricksOf(topic).reduce((n, t) => n + this.got(t.id), 0);
  }

  private read(): Record<string, DrillRecord> {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, DrillRecord>;
    } catch {
      return {};
    }
  }
}
