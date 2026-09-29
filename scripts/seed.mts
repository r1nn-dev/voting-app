// Fills an empty database with a few everyday sample polls for local development.
// Does nothing if any poll already exists; pass --reset to wipe all polls first.
//
// Usage: npm run db:seed [-- --reset]   (DATABASE_URL)
import { randomInt, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

type SamplePoll = {
  question: string;
  options: string[];
  /** 단일 선택 votes per option, in the same order. */
  votes?: number[];
  /** 마감 예정 시각 relative to now; negative means it has already passed. */
  deadlineIn: number;
  /** Set when the admin closed it by hand, this long ago. */
  closedAgo?: number;
  /** Overrides the staggered creation time, for polls that must be older. */
  createdAgo?: number;
  /** 링크 전용 when false. */
  listed?: boolean;
  /** 시작 예정 시각 relative to now; missing means it started when created. */
  opensIn?: number;
  /** 참여 코드 to issue; every seeded vote then spends one. */
  codes?: number;
  /** 복수 선택: each 표 lists option positions; replaces `votes`. */
  ballots?: number[][];
  maxChoices?: number;
};

const SAMPLE_POLLS: SamplePoll[] = [
  {
    question: "동아리 축제 때 운영할 부스를 골라 주세요 (복수 선택)",
    options: ["먹거리", "포토존", "보드게임", "플리마켓"],
    ballots: [[0, 1], [0, 2, 3], [1], [0, 1, 2], [2, 3], [0], [0, 3], [1, 2]],
    maxChoices: 3,
    closedAgo: 5 * HOUR,
    deadlineIn: -5 * HOUR,
  },
  {
    question: "우리 반 반장으로 누구를 뽑을까요?",
    options: ["김민준", "이서연", "박지호"],
    votes: [4, 3, 1],
    codes: 20,
    deadlineIn: 2 * DAY,
  },
  {
    question: "다음 학기 스터디 주제는 무엇이 좋을까요?",
    options: ["알고리즘", "웹 개발", "데이터 분석", "영어 회화"],
    votes: [0, 0, 0, 0],
    opensIn: 5 * HOUR,
    deadlineIn: 3 * DAY,
  },
  {
    question: "(링크 전용) 동아리 회식 날짜는 언제가 좋을까요?",
    options: ["금요일 저녁", "토요일 점심", "토요일 저녁"],
    votes: [2, 1, 3],
    deadlineIn: 4 * DAY,
    listed: false,
  },
  {
    question: "오늘 점심 뭐 먹을까요?",
    options: ["김밥", "라면", "돈가스", "제육볶음"],
    votes: [3, 2, 4, 1],
    deadlineIn: 3 * HOUR,
  },
  {
    question: "다음 정기 모임은 무슨 요일이 좋을까요?",
    options: ["월요일", "화요일", "수요일", "목요일", "금요일"],
    votes: [1, 0, 4, 2, 3],
    deadlineIn: 2 * DAY,
  },
  {
    question: "회의는 대면과 온라인 중 어느 쪽이 좋나요?",
    options: ["대면", "온라인", "상관없음"],
    votes: [0, 0, 0],
    deadlineIn: 6 * DAY,
  },
  {
    question: "MT 장소는 어디로 갈까요?",
    options: ["가평", "강릉", "부산"],
    votes: [6, 4, 2],
    // Closed by hand before its deadline.
    deadlineIn: DAY,
    closedAgo: 2 * HOUR,
  },
  {
    question: "가장 좋아하는 계절은?",
    options: ["봄", "여름", "가을", "겨울"],
    votes: [5, 2, 5, 1],
    // Closed on its own when the deadline passed.
    deadlineIn: -DAY,
  },
  {
    question: "올해 송년회 장소는 어디가 좋을까요?",
    options: ["학교 앞 고깃집", "호텔 뷔페", "동아리방 파티"],
    votes: [7, 3, 4],
    // Closed 40 days ago, so it is past the 30-day public period: 보관.
    deadlineIn: -40 * DAY,
    createdAgo: 45 * DAY,
  },
];

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const newPollId = () =>
  Array.from({ length: 10 }, () => ID_ALPHABET[randomInt(ID_ALPHABET.length)]).join("");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("환경변수 DATABASE_URL이(가) 설정되지 않았습니다.");
  process.exit(1);
}
const sql = neon(url);

if (process.argv.includes("--reset")) {
  await sql`TRUNCATE polls RESTART IDENTITY CASCADE`;
}

const [{ count }] = (await sql`SELECT count(*)::int AS count FROM polls`) as { count: number }[];
if (count > 0) {
  console.log(`이미 투표가 ${count}개 있어 예시를 넣지 않았습니다. 지우고 넣으려면 -- --reset`);
  process.exit(0);
}

// Staggered created_at so the newest-first list shows them in the order above.
for (const [index, poll] of [...SAMPLE_POLLS].reverse().entries()) {
  const id = newPollId();
  const now = Date.now();
  const createdAt = new Date(now - (poll.createdAgo ?? (SAMPLE_POLLS.length - index) * DAY));
  const deadline = new Date(now + poll.deadlineIn);
  const closedAt = poll.closedAgo === undefined ? null : new Date(now - poll.closedAgo);
  await sql`
    INSERT INTO polls (
      id, question, created_at, opens_at, deadline, closed_at, listed, uses_codes, mode, max_choices
    )
    VALUES (
      ${id}, ${poll.question}, ${createdAt},
      ${poll.opensIn === undefined ? createdAt : new Date(now + poll.opensIn)},
      ${deadline}, ${closedAt}, ${poll.listed ?? true}, ${(poll.codes ?? 0) > 0},
      ${poll.ballots ? "multiple" : "single"}, ${poll.ballots ? (poll.maxChoices ?? poll.options.length) : null}::int
    )
  `;
  const optionRows = (await sql`
    INSERT INTO options (poll_id, label, position)
    SELECT ${id}, label, ordinality - 1
    FROM unnest(${poll.options}::text[]) WITH ORDINALITY AS o (label, ordinality)
    RETURNING id::text AS id, position
  `) as { id: string; position: number }[];
  const optionIdAt = new Map(optionRows.map((row) => [row.position, row.id]));

  // Every 표 as the option positions it chose.
  const ballots =
    poll.ballots ??
    (poll.votes ?? []).flatMap((count, position) => Array.from({ length: count }, () => [position]));
  const codes = sampleCodes(poll.codes ?? 0);
  if (codes.length > 0) {
    // The first codes are the ones the seeded votes spent.
    await sql`
      INSERT INTO participation_codes (poll_id, code, used_at)
      SELECT ${id}, code, CASE WHEN ordinality <= ${ballots.length} THEN now() END
      FROM unnest(${codes}::text[]) WITH ORDINALITY AS c (code, ordinality)
    `;
  }

  for (const positions of ballots) {
    await sql`
      WITH ballot AS (
        INSERT INTO ballots (poll_id, voter_id, by_code)
        VALUES (${id}, ${randomUUID()}::uuid, ${codes.length > 0})
        RETURNING id
      )
      INSERT INTO ballot_choices (ballot_id, poll_id, option_id)
      SELECT ballot.id, ${id}, option_id
      FROM ballot, unnest(${positions.map((position) => optionIdAt.get(position))}::bigint[]) AS option_id
    `;
  }
}

console.log(`예시 투표 ${SAMPLE_POLLS.length}개를 넣었습니다.`);

/** Same shape as the app's 참여 코드: 8 characters without 0, O, 1, I and L. */
function sampleCodes(count: number): string[] {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(Array.from({ length: 8 }, () => alphabet[randomInt(alphabet.length)]).join(""));
  }
  return [...codes];
}
