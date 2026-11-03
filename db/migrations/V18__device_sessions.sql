-- Signed-in devices: each session records a readable device name and when it was last used, and whether the player ended it themselves
-- (so a signed-out device that comes back is simply refused, and is not mistaken for a stolen token).
ALTER TABLE refresh_tokens ADD COLUMN device_name   varchar(80);
ALTER TABLE refresh_tokens ADD COLUMN last_used_at  timestamptz;
ALTER TABLE refresh_tokens ADD COLUMN ended_by_user boolean NOT NULL DEFAULT false;
CREATE INDEX ix_refresh_tokens_user_active ON refresh_tokens (user_id) WHERE revoked_at IS NULL;
