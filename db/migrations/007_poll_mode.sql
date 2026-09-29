-- 투표 모드 (ADR-0008): 단일 선택, or 복수 선택 with a 최대 선택 수 of at least
-- 2. "At most the number of options" spans tables; createPoll validates it
-- before inserting both, and neither can change afterwards. Existing polls are
-- 단일 선택.
ALTER TABLE polls
  ADD COLUMN mode text NOT NULL DEFAULT 'single',
  ADD COLUMN max_choices integer,
  ADD CONSTRAINT polls_mode_check CHECK (
    (mode = 'single' AND max_choices IS NULL) OR (mode = 'multiple' AND max_choices >= 2)
  );
