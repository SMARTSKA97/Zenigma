import { createHash, createHmac } from 'node:crypto';

/** A small, fast, seedable random number generator (mulberry32). The same seed always gives the same puzzle. */
export function rngFrom(seedText) {
  const digest = createHash('sha256').update(seedText).digest();
  let a = digest.readUInt32LE(0);
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    pick: (list) => list[Math.floor(next() * list.length)],
    shuffle: (list) => {
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
  };
}

/** The seed for one daily puzzle: secret-keyed, so the public generator code cannot be used to see tomorrow's puzzle. */
export function dailySeed(secret, game, date) {
  return createHmac('sha256', secret).update(`${game}:${date}`).digest('hex');
}
