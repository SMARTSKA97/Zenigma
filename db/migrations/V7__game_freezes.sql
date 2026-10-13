-- Streak freezes are now earned per game: every 7 days you play a game earns one freeze for that game (up to two held).
-- The old single pool in user_rewards is no longer used.
CREATE TABLE game_freezes (
    user_id         text        NOT NULL,
    game            varchar(32) NOT NULL,
    freezes         integer     NOT NULL DEFAULT 0,
    credited_blocks integer     NOT NULL DEFAULT 0,   -- how many sets of 7 played days were already paid out
    CONSTRAINT pk_game_freezes PRIMARY KEY (user_id, game),
    CONSTRAINT ck_game_freezes_freezes CHECK (freezes BETWEEN 0 AND 2),
    CONSTRAINT fk_game_freezes_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);
