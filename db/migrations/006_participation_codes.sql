-- 참여 코드 (ADR-0007): one-time codes, one ballot each. A code only records
-- that it was used, never which ballot it cast.
ALTER TABLE polls ADD COLUMN uses_codes boolean NOT NULL DEFAULT false;

CREATE TABLE participation_codes (
  poll_id text NOT NULL REFERENCES polls (id) ON DELETE CASCADE,
  code text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  PRIMARY KEY (poll_id, code)
);
