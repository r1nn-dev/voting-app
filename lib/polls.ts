import { randomInt } from "node:crypto";
import type { Sql } from "./db";
import { formatKst } from "./kst-time";
import { POLL_LIMITS } from "./poll-limits";

/** open → closed (by hand or deadline) → archived (30 days after 마감 시각). */
export type PollStatus = "open" | "closed" | "archived";

/** A poll's state as every list sees it; only closed and archived polls have a 마감 시각. */
type PollSummary = { id: string; question: string; deadline: Date; listed: boolean } & (
  | { status: "open" }
  | { status: "closed" | "archived"; closedAt: Date; archivesAt: Date }
);

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

/** One row of the admin list: enough to judge a poll at a glance. */
export type AdminListItem = {
  id: string;
  question: string;
  deadline: Date;
  /** 목록 공개 (true) or 링크 전용 (false). */
  listed: boolean;
  total: number;
  /** Options with the most votes (several when tied); empty when nobody has voted. */
  leaders: PollOption[];
};

export type AdminPollList = {
  /** By nearest deadline. */
  open: AdminListItem[];
  /** Closed and still public, by latest 마감 시각; `archivesAt` is when it becomes 보관. */
  closed: (AdminListItem & { closedAt: Date; archivesAt: Date })[];
  /** Past the public period, by latest 마감 시각. */
  archived: (AdminListItem & { closedAt: Date })[];
};

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

/**
 * Results exist only once closed: an open poll carries no numbers at all
 * (ADR-0002). An archived poll carries nothing but its id.
 */
export type VoterPoll =
  | (VoterPollBase & { status: "open"; deadline: Date })
  | (VoterPollBase & { status: "closed"; closedAt: Date; results: ShareResults })
  | { id: string; status: "archived" };

/** The public list: open polls by nearest deadline, closed ones by latest 마감 시각. Archived polls are left out. */
export type PublicPollList = {
  open: { id: string; question: string; deadline: Date }[];
  closed: { id: string; question: string; closedAt: Date }[];
};

/** `deadline` is an absolute instant (null when the form sent nothing usable). */
export type CreatePollInput = {
  question: string;
  options: string[];
  deadline: Date | null;
  /** 목록 공개 unless false (링크 전용). */
  listed?: boolean;
};

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

/**
 * Options by votes, largest first; tied options share a rank and the next rank
 * is skipped (1, 1, 3). With no votes at all every option is rank 1, but none
 * is highlighted (isTop stays false).
 */
export type RankedOption = OptionTally & { rank: number };

/** Who is ahead: nobody has voted, one option leads, or the top is tied. */
export type RankSummary =
  | { kind: "empty"; total: 0 }
  | {
      kind: "decided";
      total: number;
      leader: PollOption;
      /** 1위 minus 2위, %p computed from the raw shares. */
      gap: { votes: number; percentPoints: number };
    }
  | { kind: "tied"; total: number; leaders: PollOption[] };

export type Ranking = { options: RankedOption[]; summary: RankSummary };

export type AdminPoll = {
  id: string;
  question: string;
  status: PollStatus;
  listed: boolean;
  deadline: Date;
  /** 마감 시각; null while open. */
  closedAt: Date | null;
  /** 득표 현황 while open, 결과 once closed; the admin sees it either way. */
  ranking: Ranking;
  /** What 복제 copies into a new poll form: never votes or times. */
  template: PollTemplate;
};

export type PollTemplate = { question: string; options: string[]; listed: boolean };

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

type PollStateRow = {
  status: PollStatus;
  deadline: Date;
  closed_at: Date | null;
  archives_at: Date | null;
};

export function createPolls(sql: Sql, { now }: PollsOptions = {}) {
  // The single definition of "now", "closed", "마감 시각" and "archived" (ADR-0006). Each
  // public function reads the clock once and passes it to these fragments, so
  // every "now" inside one statement is the same instant. They expect a
  // `polls p` alias; nothing else may decide state from closed_at alone.
  type Instant = ReturnType<typeof sql>;
  const readClock = (): Instant =>
    sql`coalesce(${now ? now().toISOString() : null}::timestamptz, now())`;
  const isClosed = (at: Instant) => sql`(p.closed_at IS NOT NULL OR p.deadline <= ${at})`;
  const pollState = (at: Instant) => sql`
    CASE
      WHEN NOT ${isClosed(at)} THEN 'open'
      WHEN least(p.closed_at, p.deadline) + ${`${POLL_LIMITS.publicDays} days`}::interval <= ${at}
        THEN 'archived'
      ELSE 'closed'
    END AS status,
    p.deadline,
    CASE WHEN ${isClosed(at)} THEN least(p.closed_at, p.deadline) END AS closed_at,
    CASE WHEN ${isClosed(at)}
      THEN least(p.closed_at, p.deadline) + ${`${POLL_LIMITS.publicDays} days`}::interval
    END AS archives_at
  `;

  /** Every poll with its state, newest first. */
  async function listAll(): Promise<PollSummary[]> {
    const at = readClock();
    const rows = (await sql`
      SELECT p.id, p.question, p.listed, ${pollState(at)}
      FROM polls p
      ORDER BY p.created_at DESC, p.id DESC
    `) as ({ id: string; question: string; listed: boolean } & PollStateRow)[];
    // closed_at and archives_at are set exactly when the poll is not open (pollState).
    return rows.map(({ id, question, listed, status, deadline, closed_at, archives_at }) =>
      status === "open"
        ? { id, question, deadline, listed, status }
        : { id, question, deadline, listed, status, closedAt: closed_at!, archivesAt: archives_at! },
    );
  }

  /** 링크 전용 polls never appear here, whatever their state. */
  async function listPolls(): Promise<PublicPollList> {
    const { open, closed } = groupByStatus((await listAll()).filter((poll) => poll.listed));
    return {
      open: open.map(({ id, question, deadline }) => ({ id, question, deadline })),
      closed: closed.map(({ id, question, closedAt }) => ({ id, question, closedAt })),
    };
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
        INSERT INTO polls (id, question, deadline, listed)
        SELECT ${id}, ${question}, ${input.deadline.toISOString()}::timestamptz, ${input.listed ?? true}
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
    if (poll.status === "archived") return { id: poll.id, status: "archived" };

    const base = { id: poll.id, question: poll.question, myChoice: poll.my_choice };

    if (poll.status === "open") {
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

  /** The admin list in three groups, each row with its total and current leaders, before close too. */
  async function listPollsForAdmin(): Promise<AdminPollList> {
    const { open, closed, archived } = groupByStatus(await listAll());
    const votesByPoll = await countVotes(null);
    const item = ({ id, question, deadline, listed }: PollSummary): AdminListItem => {
      const tally = computeTally(votesByPoll.get(id) ?? []);
      return { id, question, deadline, listed, total: tally.total, leaders: leadersOf(tally) };
    };
    return {
      open: open.map(item),
      closed: closed.map((poll) => ({
        ...item(poll),
        closedAt: poll.closedAt,
        archivesAt: poll.archivesAt,
      })),
      archived: archived.map((poll) => ({ ...item(poll), closedAt: poll.closedAt })),
    };
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
      SELECT p.id, p.question, p.listed, ${pollState(at)}
      FROM polls p
      WHERE p.id = ${pollId}
    `) as ({ id: string; question: string; listed: boolean } & PollStateRow)[];
    if (!poll) return null;
    // countVotes returns options in creation order, which the template keeps.
    const votes = (await countVotes(pollId)).get(pollId) ?? [];
    return {
      id: poll.id,
      question: poll.question,
      status: poll.status,
      listed: poll.listed,
      deadline: poll.deadline,
      closedAt: poll.closed_at,
      ranking: computeRanking(votes),
      template: {
        question: poll.question,
        options: votes.map((option) => option.label),
        listed: poll.listed,
      },
    };
  }

  /**
   * 결과 (or 득표 현황 before close) as CSV for spreadsheets: a UTF-8 BOM so
   * Excel reads Korean, poll facts, then options by votes. No voter data.
   */
  async function resultsCsv(pollId: string): Promise<string | null> {
    const poll = await getPollForAdmin(pollId);
    if (!poll) return null;
    const { options, summary } = poll.ranking;
    const rows: (string | number)[][] = [
      ["질문", poll.question],
      ["상태", STATUS_LABELS[poll.status]],
      ["마감 예정 시각", formatKst(poll.deadline)],
      ["마감 시각", poll.closedAt ? formatKst(poll.closedAt) : ""],
      ["총 표 수", summary.total],
      [],
      ["순위", "선택지", "표 수", "비율(%)"],
      ...options.map((option) => [option.rank, option.label, option.votes, option.percent.toFixed(1)]),
    ];
    return "\uFEFF" + rows.map((row) => row.map(csvField).join(",")).join("\r\n");
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

    // Only explains the refusal; the UPDATE above already decided atomically.
    // In production this reads now() again, so a poll that closed in between
    // is reported as closed, which is still a true reason.
    const [poll] = (await sql`
      SELECT ${isClosed(at)} AS is_closed, ${deadline}::timestamptz > p.deadline AS is_later
      FROM polls p
      WHERE p.id = ${pollId}
    `) as { is_closed: boolean; is_later: boolean }[];
    if (!poll) return { ok: false, reason: "not_found" };
    if (poll.is_closed) return { ok: false, reason: "closed" };
    return { ok: false, reason: poll.is_later ? "out_of_range" : "not_later" };
  }

  /** 목록 공개 ↔ 링크 전용, in any state: it changes exposure, not the poll's content. */
  async function setListed(
    pollId: string,
    listed: boolean,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
    const [updated] = await sql`UPDATE polls SET listed = ${listed} WHERE id = ${pollId} RETURNING 1`;
    return updated ? { ok: true } : { ok: false, reason: "not_found" };
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
    setListed,
    resultsCsv,
    createPoll,
    getPollForVoter,
    castVote,
    closePoll,
    deletePoll,
  };
}

const STATUS_LABELS: Record<PollStatus, string> = {
  open: "진행 중",
  closed: "마감",
  archived: "보관",
};

/** One CSV field: quoted when it holds a comma, quote or line break, quotes doubled. */
function csvField(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** Every option with the most votes; empty when nobody has voted. */
function leadersOf(tally: VoteTally): PollOption[] {
  return tally.options.filter((option) => option.isTop).map(({ id, label }) => ({ id, label }));
}

type Closed = Extract<PollSummary, { closedAt: Date }>;

/** Open by nearest deadline; closed and archived by latest 마감 시각. Sorts are stable. */
function groupByStatus(polls: PollSummary[]) {
  const open = polls
    .filter((poll): poll is Extract<PollSummary, { status: "open" }> => poll.status === "open")
    .toSorted((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const byLatestClose = (a: Closed, b: Closed) => b.closedAt.getTime() - a.closedAt.getTime();
  const closedIn = (status: Closed["status"]) =>
    polls.filter((poll): poll is Closed => poll.status === status).toSorted(byLatestClose);
  return { open, closed: closedIn("closed"), archived: closedIn("archived") };
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

function computeRanking(votes: OptionVotes[]): Ranking {
  const tally = computeTally(votes);
  const sorted = tally.options.toSorted((a, b) => b.votes - a.votes);
  const options = sorted.map((option) => ({
    ...option,
    // Competition ranking: one more than the number of options with more votes.
    rank: 1 + sorted.filter((other) => other.votes > option.votes).length,
  }));

  if (tally.total === 0) return { options, summary: { kind: "empty", total: 0 } };

  const leaders = leadersOf(tally);
  if (leaders.length > 1) {
    return { options, summary: { kind: "tied", total: tally.total, leaders } };
  }
  const [first, second] = sorted;
  // From raw shares, not the rounded percents: 66.67 - 33.33 is 33.3, not 66.7 - 33.3.
  const rawGap = ((first.votes - second.votes) / tally.total) * 100;
  return {
    options,
    summary: {
      kind: "decided",
      total: tally.total,
      leader: leaders[0],
      gap: { votes: first.votes - second.votes, percentPoints: Math.round(rawGap * 10) / 10 },
    },
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
