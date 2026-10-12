-- Daily attempts for the grid puzzles (Queens, Tango, Mini Sudoku) and the practice levels each player has solved.
-- Daily puzzles live in daily_puzzles (V3). Word Guess keeps its own attempts table because it is guess-by-guess.

CREATE TABLE puzzle_attempts (
    id             uuid        NOT NULL,
    user_id        text        NOT NULL,
    game           varchar(32) NOT NULL,
    puzzle_date    date        NOT NULL,
    device_id      uuid        NOT NULL,       -- the one device currently allowed to play this attempt
    status         varchar(16) NOT NULL DEFAULT 'playing',
    started_at     timestamptz NOT NULL DEFAULT now(),   -- the timer starts when the server reveals the puzzle
    last_active_at timestamptz NOT NULL DEFAULT now(),
    finished_at    timestamptz,
    elapsed_ms     integer,                    -- measured by the server, never reported by the app
    CONSTRAINT pk_puzzle_attempts PRIMARY KEY (id),
    CONSTRAINT uq_puzzle_attempts_once UNIQUE (user_id, game, puzzle_date),   -- single use
    CONSTRAINT ck_puzzle_attempts_status CHECK (status IN ('playing', 'solved')),
    CONSTRAINT fk_puzzle_attempts_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE,
    CONSTRAINT fk_puzzle_attempts_device FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE
);
CREATE INDEX ix_puzzle_attempts_board ON puzzle_attempts (game, puzzle_date, elapsed_ms) WHERE status = 'solved';

-- One row per practice level a player has solved. The API checks the submitted solution against the level itself.
CREATE TABLE practice_solves (
    user_id    text        NOT NULL,
    game       varchar(32) NOT NULL,
    level_key  varchar(64) NOT NULL,           -- the level number, or the answer word for Word Guess
    solved_at  timestamptz NOT NULL DEFAULT now(),
    elapsed_ms integer,
    CONSTRAINT pk_practice_solves PRIMARY KEY (user_id, game, level_key),
    CONSTRAINT fk_practice_solves_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);
CREATE INDEX ix_practice_solves_board ON practice_solves (game, solved_at);
