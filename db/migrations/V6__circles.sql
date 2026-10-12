-- Circles: private groups of friends with their own leaderboards, joined with a short share code.
CREATE TABLE circles (
    id         uuid        NOT NULL,
    name       varchar(40) NOT NULL,
    code       varchar(8)  NOT NULL,
    owner_id   text        NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_circles PRIMARY KEY (id),
    CONSTRAINT uq_circles_code UNIQUE (code),
    CONSTRAINT fk_circles_owner FOREIGN KEY (owner_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);

CREATE TABLE circle_members (
    circle_id uuid        NOT NULL,
    user_id   text        NOT NULL,
    joined_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT pk_circle_members PRIMARY KEY (circle_id, user_id),
    CONSTRAINT fk_circle_members_circle FOREIGN KEY (circle_id) REFERENCES circles (id) ON DELETE CASCADE,
    CONSTRAINT fk_circle_members_user FOREIGN KEY (user_id) REFERENCES "AspNetUsers" ("Id") ON DELETE CASCADE
);
CREATE INDEX ix_circle_members_user ON circle_members (user_id);
