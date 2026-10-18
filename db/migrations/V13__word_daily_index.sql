-- The word dailies' boards read inside sync_events payloads, like the mind board.
CREATE INDEX IF NOT EXISTS ix_sync_events_word_daily
    ON sync_events ((payload->>'date'), user_id)
    WHERE kind = 'wdaily.completed';
