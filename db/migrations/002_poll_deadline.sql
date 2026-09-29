-- Every poll gets a deadline (ADR-0006). Existing polls: a closed poll's deadline
-- is when it was closed; an open poll gets seven days from now.
ALTER TABLE polls ADD COLUMN deadline timestamptz;

UPDATE polls SET deadline = coalesce(closed_at, now() + interval '7 days');

ALTER TABLE polls ALTER COLUMN deadline SET NOT NULL;

CREATE INDEX polls_deadline_idx ON polls (deadline);
