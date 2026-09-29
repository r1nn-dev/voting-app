-- A code's used_at equalled its ballot's cast_at (same transaction), which
-- linked codes to ballots against ADR-0007. Keep only whether it was used.
ALTER TABLE participation_codes ADD COLUMN used boolean NOT NULL DEFAULT false;
UPDATE participation_codes SET used = used_at IS NOT NULL;
ALTER TABLE participation_codes DROP COLUMN used_at;

-- The 500-code cap as a counter: an UPDATE re-checks it on the latest row,
-- so concurrent issuances cannot both pass (ADR-0005).
ALTER TABLE polls ADD COLUMN codes_issued integer NOT NULL DEFAULT 0;
UPDATE polls p SET codes_issued = (SELECT count(*) FROM participation_codes c WHERE c.poll_id = p.id);
ALTER TABLE polls ADD CONSTRAINT polls_codes_issued_check CHECK (codes_issued BETWEEN 0 AND 500);
