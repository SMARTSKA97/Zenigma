// Prints SQL that loads upcoming daily puzzles for Queens, Tango and Sudoku.
//   PUZZLE_SEED=<secret> node schedule-puzzles.mjs [--from 2026-10-12] [--days 21] | psql "$DATABASE_URL"
// Each day's puzzle is generated from an HMAC of the secret seed, so the public code cannot reveal future puzzles.
// The database stores the puzzle only; the API checks submissions against the rules, so no answer is stored.
import { dailySeed } from './rng.mjs';
import { GAMES, dailyPuzzle, solve, weekdayOf } from './games.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const secret = process.env.PUZZLE_SEED;
if (!secret || secret.length < 16) {
  console.error('PUZZLE_SEED must be set (at least 16 characters).');
  process.exit(1);
}
const istToday = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const from = arg('from', istToday());
const days = Number(arg('days', '21'));

const rows = [];
for (let i = 0; i < days; i++) {
  const date = new Date(Date.parse(`${from}T00:00:00Z`) + i * 86_400_000).toISOString().slice(0, 10);
  for (const game of GAMES) {
    const puzzle = dailyPuzzle(game, dailySeed(secret, game, date), weekdayOf(date));
    if (solve(game, puzzle).count !== 1) throw new Error(`${game} ${date} is not unique`);
    rows.push(`('${game}', '${date}', '${JSON.stringify(puzzle)}')`);
  }
}
console.log('INSERT INTO daily_puzzles (game, puzzle_date, puzzle) VALUES');
console.log(rows.join(',\n'));
// Re-running refreshes puzzles that nobody has started yet (for example after a difficulty change) and never touches one that has been played.
console.log(`ON CONFLICT (game, puzzle_date) DO UPDATE SET puzzle = EXCLUDED.puzzle
WHERE NOT EXISTS (SELECT 1 FROM puzzle_attempts a WHERE a.game = daily_puzzles.game AND a.puzzle_date = daily_puzzles.puzzle_date);`);
