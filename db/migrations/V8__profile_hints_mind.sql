-- Profile details and what the player lets Zenigma do with them, the server-side hint balance, and mind-training scores.
ALTER TABLE "AspNetUsers" ADD COLUMN "HideName" boolean NOT NULL DEFAULT false;

CREATE TABLE user_profiles (
    user_id      text        NOT NULL,
    age_group    varchar(8),                     -- 18-24, 25-34, 35-44, 45-54, 55+ (optional)
    gender       varchar(12),                    -- female, male, other (optional)
    share_cohort boolean     NOT NULL DEFAULT false,  -- opt-in: count my mind scores in age and gender comparisons
    updated_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_user_profiles PRIMARY KEY (user_id),
    CONSTRAINT fk_user_profiles_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);

-- Hints are earned and spent in practice only. The balance lives here so it follows the player to every device.
CREATE TABLE hint_balances (
    user_id    text        NOT NULL,
    balance    integer     NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_hint_balances PRIMARY KEY (user_id),
    CONSTRAINT ck_hint_balances_balance CHECK (balance BETWEEN 0 AND 99),
    CONSTRAINT fk_hint_balances_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);

-- One row per earn or spend, keyed by a client-made id so a retried push is never counted twice.
CREATE TABLE hint_ledger (
    id         uuid        NOT NULL,
    user_id    text        NOT NULL,
    delta      integer     NOT NULL,
    reason     varchar(24) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_hint_ledger PRIMARY KEY (user_id, id),
    CONSTRAINT fk_hint_ledger_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);

-- Best mind-training result per game, as a 0 to 100 skill mark, for the comparison with other players.
CREATE TABLE mind_scores (
    user_id    text        NOT NULL,
    game       varchar(32) NOT NULL,
    skill      varchar(16) NOT NULL,
    pct        integer     NOT NULL,
    plays      integer     NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_mind_scores PRIMARY KEY (user_id, game),
    CONSTRAINT ck_mind_scores_pct CHECK (pct BETWEEN 0 AND 100),
    CONSTRAINT fk_mind_scores_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);
CREATE INDEX ix_mind_scores_skill ON mind_scores (skill);
