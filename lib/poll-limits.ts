// Shared with client forms, so it must not import server-only code.
export const POLL_LIMITS = {
  questionMaxLength: 200,
  optionMaxLength: 100,
  minOptions: 2,
  maxOptions: 10,
} as const;
