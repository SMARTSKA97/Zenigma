// Adds levels to the practice tracks and regenerates what is missing. Run weekly:
//   node grow-levels.mjs [amount] [--reach reach.csv] [--margin 100] [track-prefix ...]
// amount   levels added to each track that grows (default 100).
// --reach  a CSV of `track,furthest-level-any-player-has-solved` (see reach.sql). With it, a track grows only when a player is within
//          `--margin` levels of its end (default 100), so nothing is generated, stored or shipped that nobody is about to need.
//          Without it every matching track grows (use for a manual top-up).
// prefixes only the tracks that start with one of them can grow, so a big run can be split.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const take = (flag) => {
  const at = args.indexOf(flag);
  if (at < 0) return null;
  const [, value] = args.splice(at, 2);
  return value;
};
const reachFile = take('--reach');
const margin = Number(take('--margin') ?? 100);
const amount = Number(/^\d+$/.test(args[0] ?? '') ? args.shift() : 100);
const prefixes = args;
if (!Number.isInteger(amount) || amount < 1) throw new Error('amount must be a positive whole number');
if (!Number.isInteger(margin) || margin < 0) throw new Error('--margin must be a whole number');

const file = new URL('./level-counts.json', import.meta.url);
const counts = JSON.parse(readFileSync(file, 'utf8'));
const reach = new Map();
if (reachFile) {
  for (const line of readFileSync(reachFile, 'utf8').split('\n')) {
    const [track, level] = line.trim().split(',');
    if (track && /^\d+$/.test(level ?? '')) reach.set(track, Number(level));
  }
}

const candidates = Object.keys(counts).filter((t) => prefixes.length === 0 || prefixes.some((p) => t.startsWith(p)));
if (candidates.length === 0) throw new Error('no track matches ' + prefixes.join(', '));
const grown = reachFile ? candidates.filter((t) => (reach.get(t) ?? 0) >= counts[t] - margin) : candidates;
for (const t of candidates) {
  const note = reachFile ? ` (furthest player: ${reach.get(t) ?? 0} of ${counts[t]})` : '';
  console.log(`${grown.includes(t) ? 'grow' : 'keep'} ${t}${note}`);
}
if (grown.length === 0) {
  console.log('Nobody is near the end of any track. Nothing to add this week.');
  process.exit(0);
}
for (const track of grown) counts[track] += amount;
writeFileSync(file, JSON.stringify(counts, null, 1) + '\n');
const build = spawnSync(process.execPath, [new URL('./build-levels.mjs', import.meta.url).pathname, ...grown], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const vectors = spawnSync(process.execPath, [new URL('./gen-vectors.mjs', import.meta.url).pathname], { stdio: 'inherit' });
process.exit(vectors.status ?? 0);
