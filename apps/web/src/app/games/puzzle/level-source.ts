/** Practice levels live in packs of 1000 (public/levels/<track>-<n>.json), fetched when a player reaches them and kept by the service worker for offline play. */
export const PACK_SIZE = 1000;

const packs = new Map<string, Promise<unknown[]>>();

export const packOf = (level: number): number => Math.floor((level - 1) / PACK_SIZE);

/** One pack of levels (levels pack*1000+1 to pack*1000+1000 of a track). Retried on the next call if the fetch failed. */
export function loadPack(track: string, pack: number): Promise<unknown[]> {
  const key = `${track}-${pack}`;
  let found = packs.get(key);
  if (!found) {
    found = fetch(`/levels/${key}.json`).then((r) => {
      if (!r.ok) throw new Error(`Could not load levels (${r.status})`);
      return r.json() as Promise<unknown[]>;
    });
    found.catch(() => packs.delete(key));
    packs.set(key, found);
  }
  return found;
}

/** The puzzle of a level (numbered from 1), or null when there is no such level. */
export async function levelAt(track: string, level: number): Promise<unknown | null> {
  if (level < 1) return null;
  const pack = await loadPack(track, packOf(level));
  return pack[(level - 1) % PACK_SIZE] ?? null;
}
