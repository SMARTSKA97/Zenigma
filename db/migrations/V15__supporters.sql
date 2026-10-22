-- People who chip in for the running costs. One row per contribution. `user_id` links it to an account when the supporter's email is known,
-- and that account gets its cosmetic perks as owned_items rows (so they work offline and on every device).
CREATE TABLE supporter_contributions (
    id          uuid         NOT NULL,
    user_id     text,
    name        varchar(40)  NOT NULL,
    amount_inr  integer      NOT NULL,
    source      varchar(16)  NOT NULL DEFAULT 'manual',
    show_amount boolean      NOT NULL DEFAULT true,
    created_at  timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT pk_supporter_contributions PRIMARY KEY (id),
    CONSTRAINT ck_supporter_amount CHECK (amount_inr > 0),
    CONSTRAINT fk_supporter_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE SET NULL
);
CREATE INDEX ix_supporter_user ON supporter_contributions (user_id);
