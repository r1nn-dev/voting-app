-- A 표 is one ballot row plus the options it chose (ADR-0008). The old votes
-- table's (poll, voter) key would block both 참여 코드 (several ballots per
-- browser) and 복수 선택 (several options per ballot).
CREATE TABLE ballots (
  id bigserial PRIMARY KEY,
  poll_id text NOT NULL REFERENCES polls (id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  by_code boolean NOT NULL DEFAULT false,
  cast_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, id)
);

-- One ballot per browser, except ballots cast with a 참여 코드 (ADR-0007).
CREATE UNIQUE INDEX ballots_one_per_voter_idx ON ballots (poll_id, voter_id) WHERE NOT by_code;

CREATE TABLE ballot_choices (
  ballot_id bigint NOT NULL,
  poll_id text NOT NULL,
  option_id bigint NOT NULL,
  PRIMARY KEY (ballot_id, option_id),
  FOREIGN KEY (poll_id, ballot_id) REFERENCES ballots (poll_id, id) ON DELETE CASCADE,
  FOREIGN KEY (poll_id, option_id) REFERENCES options (poll_id, id) ON DELETE CASCADE
);

CREATE INDEX ballot_choices_option_idx ON ballot_choices (poll_id, option_id);

-- Each old vote becomes a ballot with one choice; (poll, voter) was its key.
WITH moved AS (
  INSERT INTO ballots (poll_id, voter_id, cast_at)
  SELECT poll_id, voter_id, created_at FROM votes
  RETURNING id, poll_id, voter_id
)
INSERT INTO ballot_choices (ballot_id, poll_id, option_id)
SELECT m.id, m.poll_id, v.option_id
FROM moved m
JOIN votes v ON v.poll_id = m.poll_id AND v.voter_id = m.voter_id;

DROP TABLE votes;
