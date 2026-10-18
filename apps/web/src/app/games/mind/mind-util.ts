import { DestroyRef, inject, signal } from '@angular/core';
import { HapticsService } from '../../core/haptics.service';

/** A countdown in milliseconds that ticks ten times a second, can be docked (a wrong answer), and calls `onEnd` once at zero. */
export function useClock(total: number, onEnd: () => void) {
  const destroy = inject(DestroyRef);
  const haptics = inject(HapticsService);
  const left = signal(total);
  let id: ReturnType<typeof setInterval> | undefined;
  let ended = false;
  const stop = () => {
    if (id) clearInterval(id);
    id = undefined;
  };
  destroy.onDestroy(stop);
  return {
    left,
    start() {
      stop();
      ended = false;
      left.set(total);
      id = setInterval(() => {
        left.update((v) => Math.max(0, v - 100));
        if (left() <= 0 && !ended) {
          ended = true;
          stop();
          onEnd();
        }
      }, 100);
    },
    dock(ms: number) {
      haptics.error();
      left.update((v) => Math.max(0, v - ms));
    },
    stop,
  };
}

/** A timeout list that is cleared when the component goes away. */
export function useTimers() {
  const destroy = inject(DestroyRef);
  const ids = new Set<ReturnType<typeof setTimeout>>();
  destroy.onDestroy(() => ids.forEach(clearTimeout));
  return {
    after(ms: number, fn: () => void) {
      const id = setTimeout(() => {
        ids.delete(id);
        fn();
      }, ms);
      ids.add(id);
    },
    clear() {
      ids.forEach(clearTimeout);
      ids.clear();
    },
  };
}

export const pick = <T>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)];
export const randInt = (min: number, max: number): number => min + Math.floor(Math.random() * (max - min + 1));
export function shuffled<T>(list: readonly T[], random: () => number = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface MindResult {
  score: number;
  /** A line under the score, such as "5 flips in 40 s". */
  detail?: string;
}

/** A small seeded generator, so everyone gets the same set on the same day. */
export function seeded(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

