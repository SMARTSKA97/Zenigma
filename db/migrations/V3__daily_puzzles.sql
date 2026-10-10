-- Daily puzzles and the single-use attempt each player gets per game per day.
-- Puzzles are loaded ahead of time by the scheduled puzzle-batch workflow; the API never exposes a puzzle's answer
-- until the attempt is finished.

CREATE TABLE daily_puzzles (
    game        varchar(32) NOT NULL,
    puzzle_date date        NOT NULL,         -- the India Standard Time calendar day
    puzzle      jsonb       NOT NULL,         -- game-specific, e.g. {"answer":"crane"}
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_daily_puzzles PRIMARY KEY (game, puzzle_date)
);

CREATE TABLE daily_attempts (
    id             uuid        NOT NULL,
    user_id        text        NOT NULL,
    game           varchar(32) NOT NULL,
    puzzle_date    date        NOT NULL,
    device_id      uuid        NOT NULL,      -- the one device currently allowed to play this attempt
    hard           boolean     NOT NULL DEFAULT false,
    status         varchar(16) NOT NULL DEFAULT 'playing',
    guesses        text[]      NOT NULL DEFAULT '{}',
    started_at     timestamptz NOT NULL DEFAULT now(),
    first_guess_at timestamptz,               -- the timer starts here, measured by the server
    last_active_at timestamptz NOT NULL DEFAULT now(),
    finished_at    timestamptz,
    CONSTRAINT pk_daily_attempts PRIMARY KEY (id),
    CONSTRAINT uq_daily_attempts_once UNIQUE (user_id, game, puzzle_date),   -- single use
    CONSTRAINT ck_daily_attempts_status CHECK (status IN ('playing', 'won', 'lost')),
    CONSTRAINT fk_daily_attempts_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE,
    CONSTRAINT fk_daily_attempts_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
);
CREATE INDEX ix_daily_attempts_day ON daily_attempts (game, puzzle_date, status);
