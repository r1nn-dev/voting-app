import { randomInt } from "node:crypto";
import type { Sql } from "./db";
import { POLL_LIMITS } from "./poll-limits";

export type PollSummary = {
  id: string;
  question: string;
  isClosed: boolean;
  deadline: Date;
  /** When the poll closed (마감 시각); null while open. */
  closedAt: Date | null;
  createdAt: Date;
};

export type PollOption = { id: string; label: string };

type OptionVotes = PollOption & { votes: number };

export type OptionTally = OptionVotes & {
  /** Share of all votes, rounded to one decimal place. */
  percent: number;
  /** Has the most votes (ties all count); false for every option at zero votes. */
  isTop: boolean;
};

/**
 * Vote counts per option. Shown to voters as the 결과 of a closed poll, and to
 * the admin as 득표 현황 at any time (CONTEXT.md).
 */
export type VoteTally = { total: number; options: OptionTally[] };

export type AdminPollSummary = PollSummary & { tally: VoteTally };

/**
 * 결과 as voters see it: each option's share, largest first (ties keep
 * creation order), with the voter's own choice marked.
 */
export type ShareResults = {
  total: number;
  /** `position` is the option's creation index, so its color can stay tied to the option. */
  options: (OptionTally & { position: number; isMine: boolean })[];
};

type VoterPollBase = {
  id: string;
  question: string;
  options: PollOption[];
  /** Option id this voter chose, or null if they have not voted. */
  myChoice: string | null;
};

/** Results exist only once closed: an open poll carries no numbers at all (ADR-0002). */
export type VoterPoll =
  | (VoterPollBase & { status: "open"; deadline: Date })
  | (VoterPollBase & { status: "closed"; closedAt: Date; results: ShareResults });

/** `deadline` is an absolute instant (null when the form sent nothing usable). */
export type CreatePollInput = { question: string; options: string[]; deadline: Date | null };

export type CreatePollErrors = {
  question?: string;
  deadline?: string;
  /** Problem with the option list as a whole (count). */
  options?: string;
  /** Problems with individual options, keyed by index. */
  optionErrors?: Record<number, string>;
};

export type CreatePollResult =
  | { ok: true; id: string }
  | { ok: false; errors: CreatePollErrors };

export type AdminPoll = {
  id: string;
  question: string;
  status: "open" | "closed";
  deadline: Date;
  /** 마감 시각; null while open. */
  closedAt: Date | null;
};

export type ExtendDeadlineFailure = "not_found" | "closed" | "not_later" | "out_of_range";

export type ExtendDeadlineResult = { ok: true } | { ok: false; reason: ExtendDeadlineFailure };

export type CastVoteFailure = "not_found" | "closed" | "already_voted" | "invalid_option";

export type CastVoteResult = { ok: true } | { ok: false; reason: CastVoteFailure };

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

type PollsOptions = {
  /** Test-only clock. Without it every judgement uses the database's now() (ADR-0006). */
  now?: () => Date;
};

type PollStateRow = { is_closed: boolean; deadline: Date; closed_at: Date | null };

export function createPolls(sql: Sql, { now }: PollsOptions = {}) {
  // The single definition of "now", "closed" and "마감 시각" (ADR-0006). Each
  // public function reads the clock once and passes it to these fragments, so
  // every "now" inside one statement is the same instant. They expect a
  // `polls p` alias; nothing else may decide state from closed_at alone.
  type Instant = ReturnType<typeof sql>;
  const readClock = (): Instant =>
    sql`coalesce(${now ? now().toISOString() : null}::timestamptz, now())`;
  const isClosed = (at: Instant) => sql`(p.closed_at IS NOT NULL OR p.deadline <= ${at})`;
  const pollState = (at: Instant) => sql`
    ${isClosed(at)} AS is_closed,
    p.deadline,
    CASE WHEN ${isClosed(at)} THEN least(p.closed_at, p.deadline) END AS closed_at
  `;

  async function listPolls(): Promise<PollSummary[]> {
    const at = readClock();
    const rows = (await sql`
      SELECT p.id, p.question, p.created_at, ${pollState(at)}
      FROM polls p
      ORDER BY p.created_at DESC, p.id DESC
    `) as ({ id: string; question: string; created_at: Date } & PollStateRow)[];
    return rows.map((row) => ({
      id: row.id,
      question: row.question,
      isClosed: row.is_closed,
      deadline: row.deadline,
      closedAt: row.closed_at,
      createdAt: row.created_at,
    }));
  }

  async function createPoll(input: CreatePollInput): Promise<CreatePollResult> {
    const question = input.question.trim();
    const options = input.options.map((option) => option.trim());
    const errors = validatePoll(question, options, input.deadline);
    if (errors || !input.deadline) return { ok: false, errors: errors ?? {} };

    const id = newPollId();
    const at = readClock();
    // One statement, so a poll can never exist without its options. The
    // deadline range is checked here, against the same "now" as every judgement.
    const inserted = await sql`
      WITH poll AS (
        INSERT INTO polls (id, question, deadline)
        SELECT ${id}, ${question}, ${input.deadline.toISOString()}::timestamptz
        WHERE ${input.deadline.toISOString()}::timestamptz
          BETWEEN ${at} + ${`${POLL_LIMITS.deadlineMinMinutes} minutes`}::interval
              AND ${at} + ${`${POLL_LIMITS.deadlineMaxDays} days`}::interval
        RETURNING id
      )
      INSERT INTO options (poll_id, label, position)
      SELECT poll.id, option.label, option.ordinality - 1
      FROM poll, unnest(${options}::text[]) WITH ORDINALITY AS option (label, ordinality)
      RETURNING 1
    `;
    if (inserted.length === 0) {
      return {
        ok: false,
        errors: {
          deadline: `마감 예정 시각은 지금부터 ${POLL_LIMITS.deadlineMinMinutes}분 뒤 ~ ${POLL_LIMITS.deadlineMaxDays}일 뒤 사이여야 합니다.`,
        },
      };
    }
    return { ok: true, id };
  }

  async function getPollForVoter(pollId: string, voterId: string | null): Promise<VoterPoll | null> {
    const at = readClock();
    const [poll] = (await sql`
      SELECT
        p.id,
        p.question,
        ${pollState(at)},
        (SELECT v.option_id::text FROM votes v WHERE v.poll_id = p.id AND v.voter_id = ${voterId}::uuid) AS my_choice
      FROM polls p
      WHERE p.id = ${pollId}
    `) as ({ id: string; question: string; my_choice: string | null } & PollStateRow)[];
    if (!poll) return null;

    const base = { id: poll.id, question: poll.question, myChoice: poll.my_choice };

    if (!poll.is_closed) {
      const options = (await sql`
        SELECT id::text AS id, label FROM options WHERE poll_id = ${pollId} ORDER BY position
      `) as PollOption[];
      return { ...base, options, status: "open", deadline: poll.deadline };
    }

    const tally = computeTally((await countVotes(pollId)).get(pollId) ?? []);
    const options = tally.options.map(({ id, label }) => ({ id, label }));
    const results = computeShare(tally, poll.my_choice);
    return { ...base, options, status: "closed", closedAt: poll.closed_at!, results };
  }

  /** Admins see 득표 현황 at any time, to judge when to close. */
  async function listPollsForAdmin(): Promise<AdminPollSummary[]> {
    const summaries = await listPolls();
    const votesByPoll = await countVotes(null);
    return summaries.map((summary) => ({
      ...summary,
      tally: computeTally(votesByPoll.get(summary.id) ?? []),
    }));
  }

  /** Per-option vote counts in creation order, grouped by poll; null counts every poll. */
  async function countVotes(pollId: string | null): Promise<Map<string, OptionVotes[]>> {
    const rows = (await sql`
      SELECT o.poll_id, o.id::text AS id, o.label, count(v.voter_id)::int AS votes
      FROM options o
      LEFT JOIN votes v ON v.poll_id = o.poll_id AND v.option_id = o.id
      WHERE ${pollId}::text IS NULL OR o.poll_id = ${pollId}
      GROUP BY o.id
      ORDER BY o.poll_id, o.position
    `) as (OptionVotes & { poll_id: string })[];
    const byPoll = new Map<string, OptionVotes[]>();
    for (const { poll_id, ...option } of rows) {
      byPoll.set(poll_id, [...(byPoll.get(poll_id) ?? []), option]);
    }
    return byPoll;
  }

  /**
   * Irreversible (ADR-0002). Closing an already closed poll succeeds and keeps
   * its 마감 시각, including one whose deadline has already passed.
   */
  async function closePoll(pollId: string): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
    const at = readClock();
    const [closed] = await sql`
      UPDATE polls p SET closed_at = ${at}
      WHERE p.id = ${pollId} AND NOT ${isClosed(at)}
      RETURNING 1
    `;
    if (closed) return { ok: true };
    const [poll] = await sql`SELECT 1 FROM polls WHERE id = ${pollId}`;
    return poll ? { ok: true } : { ok: false, reason: "not_found" };
  }

  /** The admin sees every poll whatever its state. */
  async function getPollForAdmin(pollId: string): Promise<AdminPoll | null> {
    const at = readClock();
    const [poll] = (await sql`
      SELECT p.id, p.question, ${pollState(at)}
      FROM polls p
      WHERE p.id = ${pollId}
    `) as ({ id: string; question: string } & PollStateRow)[];
    if (!poll) return null;
    return {
      id: poll.id,
      question: poll.question,
      status: poll.is_closed ? "closed" : "open",
      deadline: poll.deadline,
      closedAt: poll.closed_at,
    };
  }

  /**
   * Moves an open poll's deadline later, up to 30 days from now. One statement,
   * so a close racing with an extension can never reopen the poll (ADR-0006).
   */
  async function extendDeadline(pollId: string, newDeadline: Date): Promise<ExtendDeadlineResult> {
    const at = readClock();
    const deadline = newDeadline.toISOString();
    const [extended] = await sql`
      UPDATE polls p SET deadline = ${deadline}::timestamptz
      WHERE p.id = ${pollId}
        AND NOT ${isClosed(at)}
        AND ${deadline}::timestamptz > p.deadline
        AND ${deadline}::timestamptz <= ${at} + ${`${POLL_LIMITS.deadlineMaxDays} days`}::interval
      RETURNING 1
    `;
    if (extended) return { ok: true };

    const [poll] = (await sql`
      SELECT ${isClosed(at)} AS is_closed, ${deadline}::timestamptz > p.deadline AS is_later
      FROM polls p
      WHERE p.id = ${pollId}
    `) as { is_closed: boolean; is_later: boolean }[];
    if (!poll) return { ok: false, reason: "not_found" };
    if (poll.is_closed) return { ok: false, reason: "closed" };
    return { ok: false, reason: poll.is_later ? "out_of_range" : "not_later" };
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

    const at = readClock();
    let inserted: unknown[];
    try {
      inserted = await sql`
        INSERT INTO votes (poll_id, option_id, voter_id)
        SELECT p.id, ${optionId}::bigint, ${voterId}::uuid
        FROM polls p
        WHERE p.id = ${pollId} AND NOT ${isClosed(at)}
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
    getPollForAdmin,
    extendDeadline,
    createPoll,
    getPollForVoter,
    castVote,
    closePoll,
    deletePoll,
  };
}

function computeTally(options: OptionVotes[]): VoteTally {
  const total = options.reduce((sum, option) => sum + option.votes, 0);
  const top = Math.max(0, ...options.map((option) => option.votes));
  return {
    total,
    options: options.map((option) => ({
      ...option,
      percent: total === 0 ? 0 : Math.round((option.votes / total) * 1000) / 10,
      isTop: top > 0 && option.votes === top,
    })),
  };
}

/** Sorts by votes, largest first; the sort is stable, so ties keep creation order. */
function computeShare(tally: VoteTally, myChoice: string | null): ShareResults {
  return {
    total: tally.total,
    options: tally.options
      .map((option, position) => ({ ...option, position, isMine: option.id === myChoice }))
      .toSorted((a, b) => b.votes - a.votes),
  };
}

/**
 * Expects trimmed input. Returns null when valid. Only checks that a deadline
 * is present; its range is checked in the INSERT, against the database clock.
 */
function validatePoll(
  question: string,
  options: string[],
  deadline: Date | null,
): CreatePollErrors | null {
  const { questionMaxLength, optionMaxLength, minOptions, maxOptions } = POLL_LIMITS;
  const errors: CreatePollErrors = {};

  if (!deadline || Number.isNaN(deadline.getTime()))
    errors.deadline = "마감 예정 시각을 입력하세요.";

  if (!question) errors.question = "질문을 입력하세요.";
  else if (charCount(question) > questionMaxLength)
    errors.question = `질문은 ${questionMaxLength}자 이하여야 합니다.`;

  if (options.length < minOptions || options.length > maxOptions)
    errors.options = `선택지는 ${minOptions}~${maxOptions}개여야 합니다.`;

  const optionErrors: Record<number, string> = {};
  const seen = new Set<string>();
  options.forEach((option, index) => {
    if (!option) optionErrors[index] = "선택지를 입력하세요.";
    else if (charCount(option) > optionMaxLength)
      optionErrors[index] = `선택지는 ${optionMaxLength}자 이하여야 합니다.`;
    else if (seen.has(option)) optionErrors[index] = "같은 선택지가 이미 있습니다.";
    seen.add(option);
  });
  if (Object.keys(optionErrors).length > 0) errors.optionErrors = optionErrors;

  return Object.keys(errors).length > 0 ? errors : null;
}

/** Length in characters (code points), not UTF-16 units. */
function charCount(text: string): number {
  return [...text].length;
}

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function newPollId(): string {
  let id = "";
  for (let i = 0; i < 10; i++) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return id;
}
