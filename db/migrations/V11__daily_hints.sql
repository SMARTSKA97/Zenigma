-- Hints used in a daily attempt, counted by the server so reloading cannot hide them.
-- A puzzle hint adds 30 seconds to the ranked time; a Word Guess hint counts as one extra guess.
ALTER TABLE puzzle_attempts ADD COLUMN hints integer NOT NULL DEFAULT 0;
ALTER TABLE daily_attempts  ADD COLUMN hints integer NOT NULL DEFAULT 0;
