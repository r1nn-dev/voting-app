-- 목록 공개 (true) or 링크 전용 (false). Existing polls stay listed.
ALTER TABLE polls ADD COLUMN listed boolean NOT NULL DEFAULT true;
