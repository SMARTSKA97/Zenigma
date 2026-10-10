// Prints SQL that loads upcoming daily Word Guess puzzles.
//
//   PUZZLE_SEED=<secret> node schedule.mjs [--from 2026-10-10] [--days 21] | psql "$DATABASE_URL"
//
// Each day's answer is chosen by ordering the answer pool by HMAC-SHA256(seed, word) and walking that order one word
// per day from a fixed start date. Without the seed (a repository secret) the order cannot be predicted from this
// public code, and because the order is a pure function of the seed, no state is needed and no word repeats until the
// whole pool has been used. Never change the seed once players are active: it would reshuffle the future.
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const EPOCH = Date.UTC(2026, 9, 1); // 2026-10-01, day 0
const DAY_MS = 86_400_000;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};

const seed = process.env.PUZZLE_SEED;
if (!seed || seed.length < 16) {
  console.error('PUZZLE_SEED must be set (at least 16 characters).');
  process.exit(1);
}

const answers = readFileSync(new URL('./answers.txt', import.meta.url), 'utf8').split('\n').filter(Boolean);
const order = answers
  .map((word) => ({ word, key: createHmac('sha256', seed).update(word).digest('hex') }))
  .sort((a, b) => (a.key < b.key ? -1 : 1))
  .map((x) => x.word);

/** Today's date in India Standard Time (UTC+5:30, no daylight saving). */
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const startDate = arg('from', istToday());
const days = Number(arg('days', '21'));

export const answerFor = (isoDate) => {
  const day = Math.round((Date.parse(`${isoDate}T00:00:00Z`) - EPOCH) / DAY_MS);
  return order[((day % order.length) + order.length) % order.length];
};

const rows = [];
for (let i = 0; i < days; i++) {
  const date = new Date(Date.parse(`${startDate}T00:00:00Z`) + i * DAY_MS).toISOString().slice(0, 10);
  rows.push(`('word-guess', '${date}', '{"answer":"${answerFor(date)}"}')`);
}

console.log('INSERT INTO daily_puzzles (game, puzzle_date, puzzle) VALUES');
console.log(rows.join(',\n'));
console.log('ON CONFLICT (game, puzzle_date) DO NOTHING;');
