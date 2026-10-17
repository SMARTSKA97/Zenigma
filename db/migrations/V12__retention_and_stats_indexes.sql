-- Lets the retention job find old events of one kind without scanning the whole log.
CREATE INDEX IF NOT EXISTS ix_sync_events_kind_received ON sync_events (kind, received_at);

-- "Players active in the last day/week" and the per-player stats read only a player's own finished attempts.
CREATE INDEX IF NOT EXISTS ix_puzzle_attempts_user_solved ON puzzle_attempts (user_id, game) WHERE status = 'solved';
CREATE INDEX IF NOT EXISTS ix_daily_attempts_user_won ON daily_attempts (user_id) WHERE game = 'word-guess' AND status = 'won';
