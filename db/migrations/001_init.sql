CREATE TABLE polls (
  id text PRIMARY KEY,
  question text NOT NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX polls_created_at_idx ON polls (created_at DESC);

CREATE TABLE options (
  id bigserial PRIMARY KEY,
  poll_id text NOT NULL REFERENCES polls (id) ON DELETE CASCADE,
  label text NOT NULL,
  position integer NOT NULL,
  UNIQUE (poll_id, position),
  UNIQUE (poll_id, id)
);

CREATE TABLE votes (
  poll_id text NOT NULL REFERENCES polls (id) ON DELETE CASCADE,
  option_id bigint NOT NULL,
  voter_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, voter_id),
  FOREIGN KEY (poll_id, option_id) REFERENCES options (poll_id, id) ON DELETE CASCADE
);
