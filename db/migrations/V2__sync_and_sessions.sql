-- Offline-first sync: an append-only event log keyed by client-generated ids,
-- plus hashed refresh tokens so an offline app can stay signed in for a long time.

CREATE TABLE devices (
    id           uuid        NOT NULL,
    user_id      text        NOT NULL,
    platform     varchar(16) NOT NULL DEFAULT 'web',
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_devices PRIMARY KEY (id),
    CONSTRAINT fk_devices_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);
CREATE INDEX ix_devices_user ON devices (user_id);

CREATE TABLE sync_events (
    seq               bigint      GENERATED ALWAYS AS IDENTITY,
    id                uuid        NOT NULL,           -- generated on the device; makes pushes idempotent
    user_id           text        NOT NULL,
    device_id         uuid        NOT NULL,
    kind              varchar(64) NOT NULL,
    payload           jsonb       NOT NULL,
    client_created_at timestamptz NOT NULL,
    received_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_sync_events PRIMARY KEY (seq),
    CONSTRAINT uq_sync_events_user_id UNIQUE (user_id, id),
    CONSTRAINT fk_sync_events_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE,
    CONSTRAINT fk_sync_events_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
    CONSTRAINT ck_sync_events_kind CHECK (length(kind) > 0)
);
CREATE INDEX ix_sync_events_user_seq ON sync_events (user_id, seq);

CREATE TABLE refresh_tokens (
    id          uuid        NOT NULL,
    user_id     text        NOT NULL,
    device_id   uuid,
    token_hash  text        NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL,
    revoked_at  timestamptz,
    replaced_by uuid,
    CONSTRAINT pk_refresh_tokens PRIMARY KEY (id),
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);
CREATE INDEX ix_refresh_tokens_user ON refresh_tokens (user_id);
