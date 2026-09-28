import { randomInt } from "node:crypto";
import type { Sql } from "./db";
import { POLL_LIMITS } from "./poll-limits";

export type PollSummary = {
  id: string;
  question: string;
  isClosed: boolean;
  createdAt: Date;
};

export type PollOption = { id: string; label: string };

export type OptionResult = PollOption & {
  votes: number;
  /** Share of all votes, rounded to one decimal place. */
  percent: number;
  /** Has the most votes (ties all count); false for every option at zero votes. */
  isTop: boolean;
};

export type PollResults = { total: number; options: OptionResult[] };

export type AdminPollSummary = PollSummary & { results: PollResults };

type VoterPollBase = {
  id: string;
  question: string;
  options: PollOption[];
  /** Option id this voter chose, or null if they have not voted. */
  myChoice: string | null;
};

/** Results exist only once closed: an open poll carries no numbers at all (ADR-0002). */
export type VoterPoll =
  | (VoterPollBase & { status: "open" })
  | (VoterPollBase & { status: "closed"; results: PollResults });

export type CreatePollInput = { question: string; options: string[] };

export type CreatePollErrors = {
  question?: string;
  /** Problem with the option list as a whole (count). */
  options?: string;
  /** Problems with individual options, keyed by index. */
  optionErrors?: Record<number, string>;
};

export type CreatePollResult =
  | { ok: true; id: string }
  | { ok: false; errors: CreatePollErrors };

export type CastVoteFailure = "not_found" | "closed" | "already_voted" | "invalid_option";

export type CastVoteResult = { ok: true } | { ok: false; reason: CastVoteFailure };

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

export function createPolls(sql: Sql) {
  async function listPolls(): Promise<PollSummary[]> {
    const rows = (await sql`
      SELECT id, question, closed_at, created_at
      FROM polls
      ORDER BY created_at DESC, id DESC
    `) as { id: string; question: string; closed_at: Date | null; created_at: Date }[];
    return rows.map((row) => ({
      id: row.id,
      question: row.question,
      isClosed: row.closed_at !== null,
      createdAt: row.created_at,
    }));
  }

  async function createPoll(input: CreatePollInput): Promise<CreatePollResult> {
    const question = input.question.trim();
    const options = input.options.map((option) => option.trim());
    const errors = validatePoll(question, options);
    if (errors) return { ok: false, errors };

    const id = newPollId();
    // One statement, so a poll can never exist without its options.
    await sql`
      WITH poll AS (
        INSERT INTO polls (id, question) VALUES (${id}, ${question})
        RETURNING id
      )
      INSERT INTO options (poll_id, label, position)
      SELECT poll.id, option.label, option.ordinality - 1
      FROM poll, unnest(${options}::text[]) WITH ORDINALITY AS option (label, ordinality)
    `;
    return { ok: true, id };
  }

  async function getPollForVoter(pollId: string, voterId: string | null): Promise<VoterPoll | null> {
    const [poll] = (await sql`
      SELECT
        p.id,
        p.question,
        p.closed_at,
        (SELECT v.option_id::text FROM votes v WHERE v.poll_id = p.id AND v.voter_id = ${voterId}::uuid) AS my_choice
      FROM polls p
      WHERE p.id = ${pollId}
    `) as { id: string; question: string; closed_at: Date | null; my_choice: string | null }[];
    if (!poll) return null;

    const base = { id: poll.id, question: poll.question, myChoice: poll.my_choice };

    if (poll.closed_at === null) {
      const options = (await sql`
        SELECT id::text AS id, label FROM options WHERE poll_id = ${pollId} ORDER BY position
      `) as PollOption[];
      return { ...base, options, status: "open" };
    }

    const results = computeResults(await tally(pollId));
    const options = results.options.map(({ id, label }) => ({ id, label }));
    return { ...base, options, status: "closed", results };
  }

  /** Admins see vote counts at any time, to judge when to close. */
  async function listPollsForAdmin(): Promise<AdminPollSummary[]> {
    const summaries = await listPolls();
    const tallies = (await sql`
      SELECT o.poll_id, o.id::text AS id, o.label, count(v.voter_id)::int AS votes
      FROM options o
      LEFT JOIN votes v ON v.poll_id = o.poll_id AND v.option_id = o.id
      GROUP BY o.id
      ORDER BY o.poll_id, o.position
    `) as (PollOption & { poll_id: string; votes: number })[];
    const byPoll = Map.groupBy(tallies, (row) => row.poll_id);
    return summaries.map((summary) => ({
      ...summary,
      results: computeResults(
        (byPoll.get(summary.id) ?? []).map(({ id, label, votes }) => ({ id, label, votes })),
      ),
    }));
  }

  async function tally(pollId: string): Promise<(PollOption & { votes: number })[]> {
    return (await sql`
      SELECT o.id::text AS id, o.label, count(v.voter_id)::int AS votes
      FROM options o
      LEFT JOIN votes v ON v.poll_id = o.poll_id AND v.option_id = o.id
      WHERE o.poll_id = ${pollId}
      GROUP BY o.id
      ORDER BY o.position
    `) as (PollOption & { votes: number })[];
  }

  /** Irreversible (ADR-0002). Closing an already closed poll succeeds. */
  async function closePoll(pollId: string): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
    const [poll] = await sql`
      UPDATE polls SET closed_at = coalesce(closed_at, now())
      WHERE id = ${pollId}
      RETURNING 1
    `;
    return poll ? { ok: true } : { ok: false, reason: "not_found" };
  }

  /** Hard delete; options and votes cascade. Deleting a missing poll succeeds. */
  async function deletePoll(pollId: string): Promise<{ ok: true }> {
    await sql`DELETE FROM polls WHERE id = ${pollId}`;
    return { ok: true };
  }

  // The database enforces every rule (ADR-0005): the WHERE clause rejects
  // closed polls atomically, the PK rejects a second vote, and the composite
  // FK rejects options from another poll.
  async function castVote(pollId: string, optionId: string, voterId: string): Promise<CastVoteResult> {
    if (!/^\d{1,18}$/.test(optionId)) return { ok: false, reason: "invalid_option" };

    let inserted: unknown[];
    try {
      inserted = await sql`
        INSERT INTO votes (poll_id, option_id, voter_id)
        SELECT p.id, ${optionId}::bigint, ${voterId}::uuid
        FROM polls p
        WHERE p.id = ${pollId} AND p.closed_at IS NULL
        RETURNING 1
      `;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === UNIQUE_VIOLATION) return { ok: false, reason: "already_voted" };
      if (code === FOREIGN_KEY_VIOLATION) return { ok: false, reason: "invalid_option" };
      throw error;
    }
    if (inserted.length > 0) return { ok: true };

    const [poll] = await sql`SELECT 1 FROM polls WHERE id = ${pollId}`;
    return { ok: false, reason: poll ? "closed" : "not_found" };
  }

  return {
    listPolls,
    listPollsForAdmin,
    createPoll,
    getPollForVoter,
    castVote,
    closePoll,
    deletePoll,
  };
}

function computeResults(tallies: (PollOption & { votes: number })[]): PollResults {
  const total = tallies.reduce((sum, option) => sum + option.votes, 0);
  const top = Math.max(0, ...tallies.map((option) => option.votes));
  return {
    total,
    options: tallies.map((option) => ({
      ...option,
      percent: total === 0 ? 0 : Math.round((option.votes / total) * 1000) / 10,
      isTop: top > 0 && option.votes === top,
    })),
  };
}

/** Expects trimmed input. Returns null when valid. */
function validatePoll(question: string, options: string[]): CreatePollErrors | null {
  const { questionMaxLength, optionMaxLength, minOptions, maxOptions } = POLL_LIMITS;
  const errors: CreatePollErrors = {};

  if (!question) errors.question = "질문을 입력하세요.";
  else if (length(question) > questionMaxLength)
    errors.question = `질문은 ${questionMaxLength}자 이하여야 합니다.`;

  if (options.length < minOptions || options.length > maxOptions)
    errors.options = `선택지는 ${minOptions}~${maxOptions}개여야 합니다.`;

  const optionErrors: Record<number, string> = {};
  const seen = new Set<string>();
  options.forEach((option, index) => {
    if (!option) optionErrors[index] = "선택지를 입력하세요.";
    else if (length(option) > optionMaxLength)
      optionErrors[index] = `선택지는 ${optionMaxLength}자 이하여야 합니다.`;
    else if (seen.has(option)) optionErrors[index] = "같은 선택지가 이미 있습니다.";
    seen.add(option);
  });
  if (Object.keys(optionErrors).length > 0) errors.optionErrors = optionErrors;

  return Object.keys(errors).length > 0 ? errors : null;
}

/** Length in characters (code points), not UTF-16 units. */
function length(text: string): number {
  return [...text].length;
}

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function newPollId(): string {
  let id = "";
  for (let i = 0; i < 10; i++) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return id;
}
