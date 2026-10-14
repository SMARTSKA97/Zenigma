-- Indexes for the boards that read inside sync_events payloads, so they stay fast as the event log grows.
CREATE INDEX IF NOT EXISTS ix_sync_events_mind_daily
    ON sync_events ((payload->>'date'), user_id)
    WHERE kind = 'mind.daily.completed';

CREATE INDEX IF NOT EXISTS ix_sync_events_featured
    ON sync_events ((payload->>'featured'), user_id)
    WHERE kind = 'puzzle.practice.solved' AND (payload->>'featured') IS NOT NULL;

-- The home screen's "active players" counts look at recent devices.
CREATE INDEX IF NOT EXISTS ix_devices_last_seen ON devices (last_seen_at, user_id);
