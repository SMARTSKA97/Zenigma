import { computed, Injectable, signal } from '@angular/core';
import { GAMES, MindGameId, Skill } from '../catalog';
import { MIND_META } from './mind-meta';

export interface MindRecord {
  best: number;
  plays: number;
  /** The last 20 scores, oldest first. */
  recent: number[];
  /** When the last 60 games were played (ms), for challenges and badges. */
  times?: number[];
}

const KEY = (id: string) => `zenigma.mind.${id}`;

/** Best scores and play counts for the mind-training games. Kept on this device. */
@Injectable({ providedIn: 'root' })
export class MindStore {
  private readonly all = signal<Record<string, MindRecord>>(this.read());

  record(id: string): MindRecord {
    return this.all()[id] ?? { best: 0, plays: 0, recent: [] };
  }

  /** Saves a score. True when it is a new best. */
  add(id: string, score: number): boolean {
    const cur = this.record(id);
    const next: MindRecord = { best: Math.max(cur.best, score), plays: cur.plays + 1, recent: [...cur.recent, score].slice(-20), times: [...(cur.times ?? []), Date.now()].slice(-60) };
    this.all.update((a) => ({ ...a, [id]: next }));
    try {
      localStorage.setItem(KEY(id), JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return score > cur.best;
  }

  /** Every play with its time, newest last. */
  readonly plays = computed(() => Object.entries(this.all()).flatMap(([id, r]) => (r.times ?? []).map((at) => ({ id, at }))));

  /** How many different mind games have been played, and plays in all. */
  readonly gamesPlayed = computed(() => Object.values(this.all()).filter((r) => r.plays > 0).length);
  readonly totalPlays = computed(() => Object.values(this.all()).reduce((n, r) => n + r.plays, 0));

  /** A 0 to 100 mark per skill: the average of its games' bests against their "excellent" score. Games not played yet count as 0. */
  readonly skills = computed(() => {
    const out = new Map<Skill, { mark: number; played: number; total: number }>();
    for (const g of GAMES) {
      const meta = MIND_META[g.id as MindGameId];
      if (!meta) continue;
      const rec = this.record(g.id);
      const mark = Math.min(100, (rec.best / meta.scale) * 100);
      const cur = out.get(meta.skill) ?? { mark: 0, played: 0, total: 0 };
      out.set(meta.skill, { mark: cur.mark + mark, played: cur.played + (rec.plays > 0 ? 1 : 0), total: cur.total + 1 });
    }
    return [...out.entries()].map(([skill, v]) => ({ skill, mark: Math.round(v.mark / v.total), played: v.played, total: v.total }));
  });

  private read(): Record<string, MindRecord> {
    const out: Record<string, MindRecord> = {};
    for (const id of Object.keys(MIND_META)) {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY(id)) ?? 'null') as MindRecord | null;
        if (raw && typeof raw.best === 'number') out[id] = { best: raw.best, plays: raw.plays ?? 0, recent: Array.isArray(raw.recent) ? raw.recent : [], times: Array.isArray(raw.times) ? raw.times : [] };
      } catch {
        /* no storage */
      }
    }
    return out;
  }
}
