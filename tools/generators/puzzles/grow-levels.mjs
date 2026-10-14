// Adds more levels to every track (default 1000) and regenerates everything. Run weekly:
//   node grow-levels.mjs [amount] [track-prefix ...]
// With prefixes (for example `sudoku` or `zip-walls`) only the tracks that start with one of them grow, so a big run can be split.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const amount = Number(/^\d+$/.test(args[0] ?? '') ? args.shift() : 1000);
const prefixes = args;
if (!Number.isInteger(amount) || amount < 1) throw new Error('amount must be a positive whole number');
const file = new URL('./level-counts.json', import.meta.url);
const counts = JSON.parse(readFileSync(file, 'utf8'));
const grown = Object.keys(counts).filter((t) => prefixes.length === 0 || prefixes.some((p) => t.startsWith(p)));
if (grown.length === 0) throw new Error('no track matches ' + prefixes.join(', '));
for (const track of grown) counts[track] += amount;
writeFileSync(file, JSON.stringify(counts, null, 1) + '\n');
const build = spawnSync(process.execPath, [new URL('./build-levels.mjs', import.meta.url).pathname, ...grown], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const vectors = spawnSync(process.execPath, [new URL('./gen-vectors.mjs', import.meta.url).pathname], { stdio: 'inherit' });
process.exit(vectors.status ?? 0);
