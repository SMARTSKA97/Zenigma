-- Streak freezes: a freeze covers one missed day so a streak survives it. Earned weekly, held up to two.
CREATE TABLE streak_freezes (
    user_id      text        NOT NULL,
    game         varchar(32) NOT NULL,
    covered_date date        NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_streak_freezes PRIMARY KEY (user_id, game, covered_date),
    CONSTRAINT fk_streak_freezes_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);

CREATE TABLE user_rewards (
    user_id         text    NOT NULL,
    freezes         integer NOT NULL DEFAULT 0,
    last_award_week date,                      -- the Monday of the last week that earned a freeze
    CONSTRAINT pk_user_rewards PRIMARY KEY (user_id),
    CONSTRAINT ck_user_rewards_freezes CHECK (freezes BETWEEN 0 AND 2),
    CONSTRAINT fk_user_rewards_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);
