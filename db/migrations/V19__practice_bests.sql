-- Practice leaderboards by level: the fastest hint-free time on each level, and (Word Guess) the fewest guesses a word took.
-- elapsed_ms keeps the first solve as before; best_ms and tries are improved by later solves.
ALTER TABLE practice_solves ADD COLUMN best_ms integer;
ALTER TABLE practice_solves ADD COLUMN tries   smallint;
UPDATE practice_solves SET best_ms = elapsed_ms WHERE elapsed_ms IS NOT NULL;
CREATE INDEX ix_practice_solves_level ON practice_solves (game, level_key, best_ms) WHERE best_ms IS NOT NULL;
