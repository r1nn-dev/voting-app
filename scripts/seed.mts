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
  /** Votes per option, in the same order. */
  votes: number[];
  /** 마감 예정 시각 relative to now; negative means it has already passed. */
  deadlineIn: number;
  /** Set when the admin closed it by hand, this long ago. */
  closedAgo?: number;
};

const SAMPLE_POLLS: SamplePoll[] = [
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
  const createdAt = new Date(now - (SAMPLE_POLLS.length - index) * DAY);
  const deadline = new Date(now + poll.deadlineIn);
  const closedAt = poll.closedAgo === undefined ? null : new Date(now - poll.closedAgo);
  await sql`
    INSERT INTO polls (id, question, created_at, deadline, closed_at)
    VALUES (${id}, ${poll.question}, ${createdAt}, ${deadline}, ${closedAt})
  `;
  const optionRows = (await sql`
    INSERT INTO options (poll_id, label, position)
    SELECT ${id}, label, ordinality - 1
    FROM unnest(${poll.options}::text[]) WITH ORDINALITY AS o (label, ordinality)
    RETURNING id::text AS id, position
  `) as { id: string; position: number }[];
  const optionIdAt = new Map(optionRows.map((row) => [row.position, row.id]));

  for (const [position, voteCount] of poll.votes.entries()) {
    for (let i = 0; i < voteCount; i++) {
      await sql`
        INSERT INTO votes (poll_id, option_id, voter_id)
        VALUES (${id}, ${optionIdAt.get(position)}::bigint, ${randomUUID()}::uuid)
      `;
    }
  }
}

console.log(`예시 투표 ${SAMPLE_POLLS.length}개를 넣었습니다.`);
