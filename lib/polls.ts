import { randomInt } from "node:crypto";
import type { Sql } from "./db";
import { formatKst } from "./kst-time";
import { POLL_LIMITS } from "./poll-limits";

/** scheduled → open → closed (by hand or deadline) → archived (30 days after 마감 시각). */
export type PollStatus = "scheduled" | "open" | "closed" | "archived";

/** A poll's state as every list sees it; only closed and archived polls have a 마감 시각. */
type PollSummary = {
  id: string;
  question: string;
  opensAt: Date;
  deadline: Date;
  listed: boolean;
} & (
  | { status: "scheduled" | "open" }
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
  opensAt: Date;
  deadline: Date;
  /** 목록 공개 (true) or 링크 전용 (false). */
  listed: boolean;
  total: number;
  /** Options with the most votes (several when tied); empty when nobody has voted. */
  leaders: PollOption[];
};

export type AdminPollList = {
  /** 시작 전, by nearest 시작 예정 시각. */
  scheduled: AdminListItem[];
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
  /** Option IDs of this browser's ballot, in option order; empty before voting. */
  myChoices: string[];
};

/**
 * Results exist only once closed: an open poll carries no numbers at all
 * (ADR-0002). An archived poll carries nothing but its id.
 */
export type VoterPoll =
  | (VoterPollBase & { status: "scheduled"; opensAt: Date; deadline: Date })
  | (VoterPollBase & { status: "open"; deadline: Date })
  | (VoterPollBase & { status: "closed"; closedAt: Date; results: ShareResults })
  | { id: string; status: "archived" };

/**
 * The public list: 시작 전 polls by nearest 시작 예정 시각, open ones by nearest
 * deadline, closed ones by latest 마감 시각. Archived and 링크 전용 polls are left out.
 */
export type PublicPollList = {
  scheduled: { id: string; question: string; opensAt: Date }[];
  open: { id: string; question: string; deadline: Date }[];
  closed: { id: string; question: string; closedAt: Date }[];
};

/** `deadline` is an absolute instant (null when the form sent nothing usable). */
export type CreatePollInput = {
  question: string;
  options: string[];
  deadline: Date | null;
  /** 시작 예정 시각; missing or null starts the poll right away. */
  opensAt?: Date | null;
  /** 목록 공개 unless false (링크 전용). */
  listed?: boolean;
};

export type CreatePollErrors = {
  question?: string;
  opensAt?: string;
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
  opensAt: Date;
  deadline: Date;
  /** 마감 시각; null while open. */
  closedAt: Date | null;
  /** 득표 현황 while open, 결과 once closed; the admin sees it either way. */
  ranking: Ranking;
  /** What 복제 copies into a new poll form: never votes or times. */
  template: PollTemplate;
};

export type PollTemplate = { question: string; options: string[]; listed: boolean };

export type ExtendDeadlineFailure =
  | "not_found"
  | "not_started"
  | "closed"
  | "not_later"
  | "out_of_range";

export type RescheduleFailure = "not_found" | "started" | "out_of_range";

export type RescheduleResult = { ok: true } | { ok: false; reason: RescheduleFailure };

export type ExtendDeadlineResult = { ok: true } | { ok: false; reason: ExtendDeadlineFailure };

export type CastVoteFailure =
  | "not_found"
  | "not_started"
  | "closed"
  | "already_voted"
  | "invalid_choice";

export type CastVoteResult = { ok: true } | { ok: false; reason: CastVoteFailure };

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";

type PollsOptions = {
  /** Test-only clock. Without it every judgement uses the database's now() (ADR-0006). */
  now?: () => Date;
};

type PollStateRow = {
  status: PollStatus;
  opens_at: Date;
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
  const hasStarted = (at: Instant) => sql`(p.opens_at <= ${at})`;
  /** 진행 중: started and not closed, the only state that takes votes. */
  const acceptsVotes = (at: Instant) => sql`(${hasStarted(at)} AND NOT ${isClosed(at)})`;
  const pollState = (at: Instant) => sql`
    CASE
      WHEN NOT ${isClosed(at)} AND NOT ${hasStarted(at)} THEN 'scheduled'
      WHEN NOT ${isClosed(at)} THEN 'open'
      WHEN least(p.closed_at, p.deadline) + ${`${POLL_LIMITS.publicDays} days`}::interval <= ${at}
        THEN 'archived'
      ELSE 'closed'
    END AS status,
    p.opens_at,
    p.deadline,
    CASE WHEN ${isClosed(at)} THEN least(p.closed_at, p.deadline) END AS closed_at,
    CASE WHEN ${isClosed(at)}
      THEN least(p.closed_at, p.deadline) + ${`${POLL_LIMITS.publicDays} days`}::interval
    END AS archives_at
  `;

  /**
   * 시작 예정 시각 within 30 days from now; 마감 예정 시각 10 minutes to 30 days
   * after the 시작 예정 시각 (ADR-0006). Both as SQL booleans on the same clock.
   */
  function scheduleRanges(at: Instant, opens: Instant, deadline: Instant) {
    const minutes = `${POLL_LIMITS.deadlineMinMinutes} minutes`;
    const days = `${POLL_LIMITS.deadlineMaxDays} days`;
    return {
      opensOk: sql`(${opens} BETWEEN ${at} AND ${at} + ${days}::interval)`,
      deadlineOk: sql`(${deadline} BETWEEN ${opens} + ${minutes}::interval AND ${opens} + ${days}::interval)`,
    };
  }

  /** Every poll with its state, newest first. */
  async function listAll(): Promise<PollSummary[]> {
    const at = readClock();
    const rows = (await sql`
      SELECT p.id, p.question, p.listed, ${pollState(at)}
      FROM polls p
      ORDER BY p.created_at DESC, p.id DESC
    `) as ({ id: string; question: string; listed: boolean } & PollStateRow)[];
    // closed_at and archives_at are set exactly when the poll is not open (pollState).
    return rows.map(({ id, question, listed, status, opens_at, deadline, closed_at, archives_at }) => {
      const base = { id, question, opensAt: opens_at, deadline, listed };
      return status === "scheduled" || status === "open"
        ? { ...base, status }
        : { ...base, status, closedAt: closed_at!, archivesAt: archives_at! };
    });
  }

  /** 링크 전용 polls never appear here, whatever their state. */
  async function listPolls(): Promise<PublicPollList> {
    const { scheduled, open, closed } = groupByStatus(
      (await listAll()).filter((poll) => poll.listed),
    );
    return {
      scheduled: scheduled.map(({ id, question, opensAt }) => ({ id, question, opensAt })),
      open: open.map(({ id, question, deadline }) => ({ id, question, deadline })),
      closed: closed.map(({ id, question, closedAt }) => ({ id, question, closedAt })),
    };
  }

  async function createPoll(input: CreatePollInput): Promise<CreatePollResult> {
    const question = input.question.trim();
    const options = input.options.map((option) => option.trim());
    const errors = validatePoll(question, options, input.deadline, input.opensAt ?? null);
    if (errors || !input.deadline) return { ok: false, errors: errors ?? {} };

    const id = newPollId();
    const at = readClock();
    const opens = sql`coalesce(${input.opensAt?.toISOString() ?? null}::timestamptz, ${at})`;
    const deadline = sql`${input.deadline.toISOString()}::timestamptz`;
    const ranges = scheduleRanges(at, opens, deadline);
    // One statement, so a poll can never exist without its options. The time
    // ranges are checked here, against the same "now" as every judgement.
    const inserted = await sql`
      WITH poll AS (
        INSERT INTO polls (id, question, opens_at, deadline, listed)
        SELECT ${id}, ${question}, ${opens}, ${deadline}, ${input.listed ?? true}
        WHERE ${ranges.opensOk} AND ${ranges.deadlineOk}
        RETURNING id
      )
      INSERT INTO options (poll_id, label, position)
      SELECT poll.id, option.label, option.ordinality - 1
      FROM poll, unnest(${options}::text[]) WITH ORDINALITY AS option (label, ordinality)
      RETURNING 1
    `;
    if (inserted.length === 0) {
      // Only explains the refusal; the INSERT above already decided.
      const [check] = (await sql`
        SELECT ${ranges.opensOk} AS opens_ok
      `) as { opens_ok: boolean }[];
      return {
        ok: false,
        errors: check.opens_ok
          ? {
              deadline: `마감 예정 시각은 시작 예정 시각부터 ${POLL_LIMITS.deadlineMinMinutes}분 뒤 ~ ${POLL_LIMITS.deadlineMaxDays}일 뒤 사이여야 합니다.`,
            }
          : { opensAt: `시작 예정 시각은 지금부터 ${POLL_LIMITS.deadlineMaxDays}일 이내여야 합니다.` },
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
        ARRAY(
          SELECT c.option_id::text
          FROM ballots b
          JOIN ballot_choices c ON c.ballot_id = b.id
          JOIN options o ON o.id = c.option_id
          WHERE b.poll_id = p.id AND b.voter_id = ${voterId}::uuid AND NOT b.by_code
          ORDER BY o.position
        ) AS my_choices
      FROM polls p
      WHERE p.id = ${pollId}
    `) as ({ id: string; question: string; my_choices: string[] } & PollStateRow)[];
    if (!poll) return null;
    if (poll.status === "archived") return { id: poll.id, status: "archived" };

    const base = { id: poll.id, question: poll.question, myChoices: poll.my_choices };

    if (poll.status === "scheduled" || poll.status === "open") {
      const options = (await sql`
        SELECT id::text AS id, label FROM options WHERE poll_id = ${pollId} ORDER BY position
      `) as PollOption[];
      return poll.status === "scheduled"
        ? { ...base, options, status: "scheduled", opensAt: poll.opens_at, deadline: poll.deadline }
        : { ...base, options, status: "open", deadline: poll.deadline };
    }

    const tally = computeTally((await countVotes(pollId)).get(pollId) ?? []);
    const options = tally.options.map(({ id, label }) => ({ id, label }));
    const results = computeShare(tally, poll.my_choices);
    return { ...base, options, status: "closed", closedAt: poll.closed_at!, results };
  }

  /** The admin list in three groups, each row with its total and current leaders, before close too. */
  async function listPollsForAdmin(): Promise<AdminPollList> {
    const { scheduled, open, closed, archived } = groupByStatus(await listAll());
    const votesByPoll = await countVotes(null);
    const item = ({ id, question, opensAt, deadline, listed }: PollSummary): AdminListItem => {
      const tally = computeTally(votesByPoll.get(id) ?? []);
      return {
        id,
        question,
        opensAt,
        deadline,
        listed,
        total: tally.total,
        leaders: leadersOf(tally),
      };
    };
    return {
      scheduled: scheduled.map(item),
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
      SELECT o.poll_id, o.id::text AS id, o.label, count(c.ballot_id)::int AS votes
      FROM options o
      LEFT JOIN ballot_choices c ON c.poll_id = o.poll_id AND c.option_id = o.id
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
  async function closePoll(
    pollId: string,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" | "not_started" }> {
    const at = readClock();
    const [closed] = await sql`
      UPDATE polls p SET closed_at = ${at}
      WHERE p.id = ${pollId} AND ${acceptsVotes(at)}
      RETURNING 1
    `;
    if (closed) return { ok: true };
    // A 시작 전 poll is deleted, not closed (CONTEXT.md).
    const [poll] = (await sql`
      SELECT ${hasStarted(at)} AS started FROM polls p WHERE p.id = ${pollId}
    `) as { started: boolean }[];
    if (!poll) return { ok: false, reason: "not_found" };
    return poll.started ? { ok: true } : { ok: false, reason: "not_started" };
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
      opensAt: poll.opens_at,
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
      ["시작 예정 시각", formatKst(poll.opensAt)],
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
        AND ${acceptsVotes(at)}
        AND ${deadline}::timestamptz > p.deadline
        AND ${deadline}::timestamptz <= ${at} + ${`${POLL_LIMITS.deadlineMaxDays} days`}::interval
      RETURNING 1
    `;
    if (extended) return { ok: true };

    // Only explains the refusal; the UPDATE above already decided atomically.
    // In production this reads now() again, so a poll that closed in between
    // is reported as closed, which is still a true reason.
    const [poll] = (await sql`
      SELECT
        ${isClosed(at)} AS is_closed,
        ${hasStarted(at)} AS started,
        ${deadline}::timestamptz > p.deadline AS is_later
      FROM polls p
      WHERE p.id = ${pollId}
    `) as { is_closed: boolean; started: boolean; is_later: boolean }[];
    if (!poll) return { ok: false, reason: "not_found" };
    if (poll.is_closed) return { ok: false, reason: "closed" };
    if (!poll.started) return { ok: false, reason: "not_started" };
    return { ok: false, reason: poll.is_later ? "out_of_range" : "not_later" };
  }

  /**
   * Moves a 시작 전 poll's 시작 예정 시각 and 마감 예정 시각, earlier or later;
   * `opensAt` of now starts it right away. Allowed only before it starts, when
   * no vote exists yet (CONTEXT.md). One conditional statement.
   */
  async function reschedule(
    pollId: string,
    times: { opensAt: Date; deadline: Date },
  ): Promise<RescheduleResult> {
    const at = readClock();
    const opens = sql`${times.opensAt.toISOString()}::timestamptz`;
    const deadline = sql`${times.deadline.toISOString()}::timestamptz`;
    const ranges = scheduleRanges(at, opens, deadline);
    const [moved] = await sql`
      UPDATE polls p SET opens_at = ${opens}, deadline = ${deadline}
      WHERE p.id = ${pollId}
        AND NOT ${hasStarted(at)}
        AND NOT ${isClosed(at)}
        AND ${ranges.opensOk}
        AND ${ranges.deadlineOk}
      RETURNING 1
    `;
    if (moved) return { ok: true };

    // Only explains the refusal; the UPDATE above already decided.
    const [poll] = (await sql`
      SELECT (${hasStarted(at)} OR ${isClosed(at)}) AS started FROM polls p WHERE p.id = ${pollId}
    `) as { started: boolean }[];
    if (!poll) return { ok: false, reason: "not_found" };
    return { ok: false, reason: poll.started ? "started" : "out_of_range" };
  }

  /**
   * "지금 바로 시작": sets the 시작 예정 시각 to the database's now, so an app
   * clock slightly behind can never make it look like the past (ADR-0006). The
   * deadline stays: it is already more than 10 minutes after the old start.
   */
  async function startNow(pollId: string): Promise<{ ok: true } | { ok: false; reason: "not_found" | "started" }> {
    const at = readClock();
    const [started] = await sql`
      UPDATE polls p SET opens_at = ${at}
      WHERE p.id = ${pollId} AND NOT ${hasStarted(at)} AND NOT ${isClosed(at)}
      RETURNING 1
    `;
    if (started) return { ok: true };
    const [poll] = await sql`SELECT 1 FROM polls WHERE id = ${pollId}`;
    return { ok: false, reason: poll ? "started" : "not_found" };
  }

  /** 목록 공개 ↔ 링크 전용, in any state: it changes exposure, not the poll's content. */
  async function setListed(
    pollId: string,
    listed: boolean,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" }> {
    const [updated] = await sql`UPDATE polls SET listed = ${listed} WHERE id = ${pollId} RETURNING 1`;
    return updated ? { ok: true } : { ok: false, reason: "not_found" };
  }

  /** Hard delete; options and ballots cascade. Deleting a missing poll succeeds. */
  async function deletePoll(pollId: string): Promise<{ ok: true }> {
    await sql`DELETE FROM polls WHERE id = ${pollId}`;
    return { ok: true };
  }

  // The database enforces every rule (ADR-0005): one statement inserts the
  // ballot and its choices, so they succeed or fail together. The WHERE clause
  // rejects polls not taking votes, the partial unique index rejects a second
  // ballot from the same browser, and the composite FK rejects options from
  // another poll.
  async function castVote(
    pollId: string,
    optionIds: string[],
    voterId: string,
  ): Promise<CastVoteResult> {
    // 단일 선택: exactly one option.
    if (optionIds.length !== 1 || !optionIds.every((id) => /^\d{1,18}$/.test(id))) {
      return { ok: false, reason: "invalid_choice" };
    }

    const at = readClock();
    let inserted: unknown[];
    try {
      inserted = await sql`
        WITH ballot AS (
          INSERT INTO ballots (poll_id, voter_id)
          SELECT p.id, ${voterId}::uuid
          FROM polls p
          WHERE p.id = ${pollId} AND ${acceptsVotes(at)}
          RETURNING id, poll_id
        )
        INSERT INTO ballot_choices (ballot_id, poll_id, option_id)
        SELECT b.id, b.poll_id, c.option_id
        FROM ballot b CROSS JOIN unnest(${optionIds}::bigint[]) AS c (option_id)
        RETURNING 1
      `;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === UNIQUE_VIOLATION) return { ok: false, reason: "already_voted" };
      if (code === FOREIGN_KEY_VIOLATION) return { ok: false, reason: "invalid_choice" };
      throw error;
    }
    if (inserted.length > 0) return { ok: true };

    const [poll] = (await sql`
      SELECT ${hasStarted(at)} AS started FROM polls p WHERE p.id = ${pollId}
    `) as { started: boolean }[];
    if (!poll) return { ok: false, reason: "not_found" };
    return { ok: false, reason: poll.started ? "closed" : "not_started" };
  }

  return {
    listPolls,
    listPollsForAdmin,
    getPollForAdmin,
    extendDeadline,
    setListed,
    reschedule,
    startNow,
    resultsCsv,
    createPoll,
    getPollForVoter,
    castVote,
    closePoll,
    deletePoll,
  };
}

const STATUS_LABELS: Record<PollStatus, string> = {
  scheduled: "시작 전",
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

/**
 * 시작 전 by nearest 시작 예정 시각, open by nearest deadline, closed and
 * archived by latest 마감 시각. Sorts are stable.
 */
function groupByStatus(polls: PollSummary[]) {
  const scheduled = polls
    .filter((poll) => poll.status === "scheduled")
    .toSorted((a, b) => a.opensAt.getTime() - b.opensAt.getTime());
  const open = polls
    .filter((poll) => poll.status === "open")
    .toSorted((a, b) => a.deadline.getTime() - b.deadline.getTime());
  const byLatestClose = (a: Closed, b: Closed) => b.closedAt.getTime() - a.closedAt.getTime();
  const closedIn = (status: Closed["status"]) =>
    polls.filter((poll): poll is Closed => poll.status === status).toSorted(byLatestClose);
  return { scheduled, open, closed: closedIn("closed"), archived: closedIn("archived") };
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
function computeShare(tally: VoteTally, myChoices: string[]): ShareResults {
  return {
    total: tally.total,
    options: tally.options
      .map((option, position) => ({ ...option, position, isMine: myChoices.includes(option.id) }))
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
  opensAt: Date | null,
): CreatePollErrors | null {
  const { questionMaxLength, optionMaxLength, minOptions, maxOptions } = POLL_LIMITS;
  const errors: CreatePollErrors = {};

  if (opensAt && Number.isNaN(opensAt.getTime())) errors.opensAt = "시작 예정 시각이 올바르지 않습니다.";

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
