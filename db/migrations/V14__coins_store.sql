-- Coins, the store and the daily wheel. The balance lives here so every device of a player shows the same coins and the same items.
CREATE TABLE coin_balances (
    user_id    text        NOT NULL,
    balance    integer     NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_coin_balances PRIMARY KEY (user_id),
    CONSTRAINT ck_coin_balances_balance CHECK (balance >= 0),
    CONSTRAINT fk_coin_balances_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);

-- One row per earn or spend. `id` is made by the device so a retried push counts once; `ref` names the thing that paid
-- (a daily, a level, a spin) so the same thing can never pay twice, even from two devices.
CREATE TABLE coin_ledger (
    id         uuid        NOT NULL,
    user_id    text        NOT NULL,
    delta      integer     NOT NULL,
    reason     varchar(16) NOT NULL,
    ref        varchar(48),
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_coin_ledger PRIMARY KEY (user_id, id),
    CONSTRAINT fk_coin_ledger_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX ux_coin_ledger_ref ON coin_ledger (user_id, ref) WHERE ref IS NOT NULL;
CREATE INDEX ix_coin_ledger_recent ON coin_ledger (user_id, created_at);

-- Cosmetics a player has bought (colours and themes). Hints are consumables and go to hint_balances instead.
CREATE TABLE owned_items (
    user_id    text        NOT NULL,
    item       varchar(32) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_owned_items PRIMARY KEY (user_id, item),
    CONSTRAINT fk_owned_items_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);
