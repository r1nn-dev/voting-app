-- 시작 예정 시각 (ADR-0006). Existing polls started when they were created.
ALTER TABLE polls ADD COLUMN opens_at timestamptz;

UPDATE polls SET opens_at = created_at;

ALTER TABLE polls ALTER COLUMN opens_at SET NOT NULL;

CREATE INDEX polls_opens_at_idx ON polls (opens_at);
