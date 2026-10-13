import { afterEach, describe, expect, it, vi } from 'vitest';
import { levelCountOf } from '../catalog';
import { levelAt, packOf, PACK_SIZE } from './level-source';

describe('level packs', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('puts 1000 levels in a pack', () => {
    expect(PACK_SIZE).toBe(1000);
    expect(packOf(1)).toBe(0);
    expect(packOf(1000)).toBe(0);
    expect(packOf(1001)).toBe(1);
  });

  it('knows how many levels each track has', () => {
    expect(levelCountOf('queens')).toBeGreaterThanOrEqual(1000);
    expect(levelCountOf('sudoku-mini-easy')).toBeGreaterThanOrEqual(200);
  });

  it('fetches the pack a level is in and picks the level out of it', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url);
      return { ok: true, json: async () => Array.from({ length: PACK_SIZE }, (_, i) => ({ n: i })) };
    });
    expect(await levelAt('spec-track', 1)).toEqual({ n: 0 });
    expect(await levelAt('spec-track', 1000)).toEqual({ n: 999 });
    expect(await levelAt('spec-track', 1001)).toEqual({ n: 0 });
    expect(calls).toEqual(['/levels/spec-track-0.json', '/levels/spec-track-1.json']); // each pack once
  });
});
