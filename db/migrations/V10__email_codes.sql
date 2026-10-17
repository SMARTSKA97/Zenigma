-- One-time codes sent by email: confirming an address ('verify') and resetting a forgotten password ('reset').
-- Only a keyed hash of the code is stored. A code works once, expires, and locks after a few wrong tries.
CREATE TABLE email_codes (
    id         uuid        NOT NULL,
    user_id    text        NOT NULL,
    purpose    varchar(12) NOT NULL,
    code_hash  text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    attempts   integer     NOT NULL DEFAULT 0,
    used_at    timestamptz,
    CONSTRAINT pk_email_codes PRIMARY KEY (id),
    CONSTRAINT ck_email_codes_purpose CHECK (purpose IN ('verify', 'reset')),
    CONSTRAINT fk_email_codes_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);
CREATE INDEX ix_email_codes_user_purpose ON email_codes (user_id, purpose, created_at DESC);
