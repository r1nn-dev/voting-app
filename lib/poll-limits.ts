// Shared with client forms, so it must not import server-only code.
export const POLL_LIMITS = {
  questionMaxLength: 200,
  optionMaxLength: 100,
  minOptions: 2,
  maxOptions: 10,
  /** 마감 예정 시각 must be at least this far from now... */
  deadlineMinMinutes: 10,
  /** ...and at most this far. */
  deadlineMaxDays: 30,
  /** A closed poll stays public this long after its 마감 시각, then it is 보관 (archived). */
  publicDays: 30,
} as const;
