// Generates the practice levels shipped inside the app and the API (so both agree on every level).
//   node build-levels.mjs            (every track)
//   node build-levels.mjs patches    (only the named tracks)
//   node build-levels.mjs --all      (throw the shipped levels away and generate every level again)
//   node build-levels.mjs --verify   (CI: regenerate a sample of levels and check they match the shipped ones; writes nothing)
// By default only levels that are missing are generated (levels never change once they exist), so adding a week of levels is quick.
// How many levels each track has comes from level-counts.json (grow-levels.mjs adds more).
// Levels ship in packs of 1000: apps/web/public/levels/<track>-<n>.json and the same files embedded in the API.
// Output is deterministic: running it again changes nothing unless the generator changes (existing levels never change when more are added).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { TRACKS, levelsOf, PACK_SIZE, LEVEL_COUNTS, practiceLevel, solve } from './games.mjs';

if (!isMainThread) {
  const { game, levels } = workerData; // game here is a track
  const out = levels.map((level) => {
    const puzzle = practiceLevel(game, level);
    if (solve(game, puzzle).count !== 1) throw new Error(`${game} level ${level} does not have exactly one solution`);
    return puzzle;
  });
  parentPort.postMessage(out);
} else {
  const root = new URL('../../../', import.meta.url);
  const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
  const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const all = flags.includes('--all');
  const verify = flags.includes('--verify');
  const tracks = only.length ? TRACKS.filter((t) => only.includes(t)) : TRACKS;
  const workers = Math.max(1, availableParallelism());
  const webDir = new URL('apps/web/public/levels/', root);
  const apiDir = new URL('apps/api/Zenigma.Api/Games/Puzzles/levels/', root);
  if (!verify) {
    mkdirSync(webDir, { recursive: true });
    mkdirSync(apiDir, { recursive: true });
  }

  const packName = (game, p) => `${game}-${p}.json`;
  const readPack = (game, p) => {
    const url = new URL(packName(game, p), webDir);
    return existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : [];
  };
  /** The levels already shipped for a track (a sparse array, index = level - 1). */
  const shipped = (game) => {
    const levels = [];
    if (all) return levels;
    for (let p = 0; p < Math.ceil(levelsOf(game) / PACK_SIZE); p++) readPack(game, p).forEach((puzzle, i) => (levels[p * PACK_SIZE + i] = puzzle));
    return levels;
  };

  async function generate(game, wanted) {
    const jobs = [];
    for (let w = 0; w < workers; w++) {
      // Interleaved chunks, so every worker gets a similar mix of easy and hard levels.
      const levels = wanted.filter((_, i) => i % workers === w);
      if (!levels.length) continue;
      jobs.push(
        new Promise((resolve, reject) => {
          const worker = new Worker(new URL(import.meta.url), { workerData: { game, levels } });
          worker.once('message', (puzzles) => resolve({ levels, puzzles }));
          worker.once('error', reject);
        }),
      );
    }
    const out = new Map();
    for (const r of await Promise.all(jobs)) r.levels.forEach((level, i) => out.set(level, r.puzzles[i]));
    return out;
  }

  if (verify) {
    // Regenerate every 40th level plus the last 10 of each track, and check the packs hold exactly the right number of levels.
    let bad = 0;
    for (const game of tracks) {
      const have = shipped(game);
      const count = levelsOf(game);
      if (have.length !== count || have.some((l) => l === undefined)) {
        console.error(`${game}: expected ${count} levels, found ${have.filter(Boolean).length}`);
        bad++;
        continue;
      }
      const sample = [];
      for (let l = 1; l <= count; l += 40) sample.push(l);
      for (let l = Math.max(1, count - 9); l <= count; l++) sample.push(l);
      const fresh = await generate(game, [...new Set(sample)]);
      for (const [level, puzzle] of fresh) {
        if (JSON.stringify(puzzle) !== JSON.stringify(have[level - 1])) {
          console.error(`${game} level ${level} differs from the shipped one`);
          bad++;
        }
      }
      const api = JSON.parse(readFileSync(new URL(packName(game, 0), apiDir), 'utf8'));
      if (JSON.stringify(api) !== JSON.stringify(readPack(game, 0))) {
        console.error(`${game}: the API copy of pack 0 differs from the web copy`);
        bad++;
      }
      console.log(`${game}: ${count} levels, ${fresh.size} sampled OK`);
    }
    process.exit(bad ? 1 : 0);
  }

  for (const game of tracks) {
    const levels = shipped(game);
    const count = levelsOf(game);
    const wanted = [];
    for (let level = 1; level <= count; level++) if (levels[level - 1] === undefined) wanted.push(level);
    for (const [level, puzzle] of await generate(game, wanted)) levels[level - 1] = puzzle;
    levels.length = count;

    // Replace the track's packs.
    for (const dir of [webDir, apiDir]) for (const f of readdirSync(dir)) if (f.startsWith(`${game}-`) && f.slice(game.length + 1).match(/^\d+\.json$/)) rmSync(new URL(f, dir));
    const packs = Math.ceil(count / PACK_SIZE);
    for (let p = 0; p < packs; p++) {
      const json = JSON.stringify(levels.slice(p * PACK_SIZE, (p + 1) * PACK_SIZE));
      writeFileSync(new URL(packName(game, p), webDir), json);
      writeFileSync(new URL(packName(game, p), apiDir), json);
    }
    console.log(`${game}: ${count} levels (${wanted.length} new) in ${packs} pack(s)`);
  }

  // The counts, for the web app (compiled in, so the app knows how many levels exist without loading any) and the API.
  const counts = JSON.stringify(LEVEL_COUNTS);
  writeFileSync(new URL('apps/web/src/app/games/level-counts.data.ts', root), `// Generated by tools/generators/puzzles/build-levels.mjs from level-counts.json. Do not edit.\nexport const LEVEL_COUNTS: Record<string, number> = ${counts};\n`);
  writeFileSync(new URL('counts.json', apiDir), counts);
  writeFileSync(new URL('counts.json', webDir), counts);
}
