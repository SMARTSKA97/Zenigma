// Adds more levels to every track (default 1000) and regenerates everything. Run weekly:
//   node grow-levels.mjs [amount]
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const amount = Number(process.argv[2] ?? 1000);
if (!Number.isInteger(amount) || amount < 1) throw new Error('amount must be a positive whole number');
const file = new URL('./level-counts.json', import.meta.url);
const counts = JSON.parse(readFileSync(file, 'utf8'));
for (const track of Object.keys(counts)) counts[track] += amount;
writeFileSync(file, JSON.stringify(counts, null, 1) + '\n');
const build = spawnSync(process.execPath, [new URL('./build-levels.mjs', import.meta.url).pathname], { stdio: 'inherit' });
if (build.status !== 0) process.exit(build.status ?? 1);
const vectors = spawnSync(process.execPath, [new URL('./gen-vectors.mjs', import.meta.url).pathname], { stdio: 'inherit' });
process.exit(vectors.status ?? 0);
