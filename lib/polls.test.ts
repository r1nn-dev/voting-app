import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testSql } from "@/tests/db";
import { createPolls } from "./polls";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Every test runs at T0 unless it moves the clock with pollsAt(). */
const T0 = new Date("2030-01-01T00:00:00Z");
const at = (offsetMs: number) => new Date(T0.getTime() + offsetMs);
const pollsAt = (now: Date) => createPolls(testSql, { now: () => now });
const polls = pollsAt(T0);

beforeEach(async () => {
  await resetDatabase();
});

// Leave no test polls behind, in case the test database is also the dev one.
afterAll(async () => {
  await resetDatabase();
});

async function createOpenPoll(
  question = "점심 뭐 먹지?",
  options = ["김밥", "라면", "돈가스"],
  deadline = at(DAY),
) {
  const result = await polls.createPoll({ question, options, deadline });
  if (!result.ok) throw new Error(`투표 생성 실패: ${JSON.stringify(result.errors)}`);
  return result.id;
}

describe("listPolls", () => {
  it("투표가 없으면 빈 목록을 반환한다", async () => {
    expect(await polls.listPolls()).toEqual([]);
  });

  it("투표를 최신순으로, 진행 중 상태로 보여준다", async () => {
    const first = await createOpenPoll("첫 번째");
    const second = await createOpenPoll("두 번째");

    const list = await polls.listPolls();

    expect(list.map((poll) => [poll.id, poll.question, poll.isClosed])).toEqual([
      [second, "두 번째", false],
      [first, "첫 번째", false],
    ]);
  });
});

describe("getPollForVoter", () => {
  it("없는 투표는 null을 반환한다", async () => {
    expect(await polls.getPollForVoter("nope000000", null)).toBeNull();
  });
});

const alice = "00000000-0000-4000-8000-00000000000a";
const bob = "00000000-0000-4000-8000-00000000000b";

async function optionIds(pollId: string) {
  const poll = await polls.getPollForVoter(pollId, null);
  return poll!.options.map((option) => option.id);
}

describe("castVote", () => {
  it("표를 던지면 그 투표자의 선택으로 조회된다", async () => {
    const id = await createOpenPoll();
    const [, ramen] = await optionIds(id);

    expect(await polls.castVote(id, ramen, alice)).toEqual({ ok: true });

    expect((await polls.getPollForVoter(id, alice))?.myChoice).toBe(ramen);
    expect((await polls.getPollForVoter(id, bob))?.myChoice).toBeNull();
  });

  it("같은 투표자의 두 번째 표는 거부하고 첫 선택을 유지한다", async () => {
    const id = await createOpenPoll();
    const [kimbap, ramen] = await optionIds(id);
    await polls.castVote(id, kimbap, alice);

    expect(await polls.castVote(id, ramen, alice)).toEqual({ ok: false, reason: "already_voted" });
    expect((await polls.getPollForVoter(id, alice))?.myChoice).toBe(kimbap);
  });

  it("다른 투표의 선택지에는 표를 넣을 수 없다", async () => {
    const id = await createOpenPoll();
    const [otherOption] = await optionIds(await createOpenPoll("다른 투표"));

    expect(await polls.castVote(id, otherOption, alice)).toEqual({
      ok: false,
      reason: "invalid_option",
    });
    expect((await polls.getPollForVoter(id, alice))?.myChoice).toBeNull();
  });

  it("형식이 잘못된 선택지 ID도 잘못된 선택지로 거부한다", async () => {
    const id = await createOpenPoll();

    expect(await polls.castVote(id, "not-a-number", alice)).toEqual({
      ok: false,
      reason: "invalid_option",
    });
  });

  it("없는 투표에는 표를 넣을 수 없다", async () => {
    const [option] = await optionIds(await createOpenPoll());

    expect(await polls.castVote("nope000000", option, alice)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("같은 투표자도 다른 투표에는 각각 한 표씩 던질 수 있다", async () => {
    const first = await createOpenPoll("첫 번째");
    const second = await createOpenPoll("두 번째");

    expect(await polls.castVote(first, (await optionIds(first))[0], alice)).toEqual({ ok: true });
    expect(await polls.castVote(second, (await optionIds(second))[1], alice)).toEqual({ ok: true });
  });

  it("진행 중인 투표의 투표자 시점에는 어떤 수치도 없다", async () => {
    const id = await createOpenPoll();
    const [kimbap] = await optionIds(id);
    await polls.castVote(id, kimbap, alice);
    await polls.castVote(id, kimbap, bob);

    const poll = await polls.getPollForVoter(id, alice);

    expect(poll?.status).toBe("open");
    expect(poll).not.toHaveProperty("results");
    expect(JSON.stringify(poll)).not.toMatch(/count|votes|total|percent/i);
  });
});

const voters = Array.from(
  { length: 12 },
  (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
);

/** Casts one vote per entry: votesPerOption[i] voters choose option i. */
async function castVotes(pollId: string, votesPerOption: number[]) {
  const ids = await optionIds(pollId);
  let voter = 0;
  for (const [index, count] of votesPerOption.entries()) {
    for (let i = 0; i < count; i++) await polls.castVote(pollId, ids[index], voters[voter++]);
  }
}

describe("closePoll", () => {
  it("마감하면 목록에 마감으로 보이고, 결과가 공개되고, 이후 표는 거부된다", async () => {
    const id = await createOpenPoll();
    const [kimbap] = await optionIds(id);
    await polls.castVote(id, kimbap, alice);

    expect(await polls.closePoll(id)).toEqual({ ok: true });

    expect((await polls.listPolls())[0].isClosed).toBe(true);
    const poll = await polls.getPollForVoter(id, alice);
    expect(poll?.status).toBe("closed");
    expect(poll?.myChoice).toBe(kimbap);
    expect(await polls.castVote(id, kimbap, bob)).toEqual({ ok: false, reason: "closed" });
  });

  /** castVotes gives voters[0] the first option that has any votes. */
  async function closedResults(votesPerOption: number[], voterId: string | null = null) {
    const id = await createOpenPoll("점심?", ["김밥", "라면", "돈가스"]);
    await castVotes(id, votesPerOption);
    await polls.closePoll(id);
    const poll = await polls.getPollForVoter(id, voterId);
    if (poll?.status !== "closed") throw new Error("마감되지 않음");
    return poll.results;
  }

  it("결과는 득표순으로 득표수, 소수점 첫째 자리 비율, 최다 득표를 담는다", async () => {
    const results = await closedResults([1, 2, 0]);

    expect(results.total).toBe(3);
    expect(results.options.map(({ label, votes, percent, isTop }) => [label, votes, percent, isTop]))
      .toEqual([
        ["라면", 2, 66.7, true],
        ["김밥", 1, 33.3, false],
        ["돈가스", 0, 0, false],
      ]);
  });

  it("동점이면 최다 득표를 모두 표시하고, 동점끼리는 생성 순서를 따른다", async () => {
    const results = await closedResults([1, 0, 1]);

    expect(results.options.map((option) => [option.label, option.percent, option.isTop])).toEqual([
      ["김밥", 50, true],
      ["돈가스", 50, true],
      ["라면", 0, false],
    ]);
  });

  it("결과에서 이 투표자가 고른 선택지를 표시한다", async () => {
    const results = await closedResults([1, 2, 0], voters[0]);

    expect(results.options.map((option) => [option.label, option.isMine])).toEqual([
      ["라면", false],
      ["김밥", true],
      ["돈가스", false],
    ]);
  });

  it("투표하지 않은 사람의 결과에는 내 선택이 없다", async () => {
    const results = await closedResults([1, 2, 0], bob);

    expect(results.options.map((option) => option.isMine)).toEqual([false, false, false]);
  });

  it("결과의 각 선택지는 생성 순번을 갖고, 투표의 선택지 목록은 생성 순서를 유지한다", async () => {
    const id = await createOpenPoll("점심?", ["김밥", "라면", "돈가스"]);
    await castVotes(id, [0, 1, 2]);
    await polls.closePoll(id);

    const poll = await polls.getPollForVoter(id, null);

    expect(poll?.options.map((option) => option.label)).toEqual(["김밥", "라면", "돈가스"]);
    expect(
      poll?.status === "closed" && poll.results.options.map((o) => [o.label, o.position]),
    ).toEqual([
      ["돈가스", 2],
      ["라면", 1],
      ["김밥", 0],
    ]);
  });

  it("이미 마감된 투표를 다시 마감해도 성공하고, 없는 투표는 없음을 알린다", async () => {
    const id = await createOpenPoll();
    await polls.closePoll(id);

    expect(await polls.closePoll(id)).toEqual({ ok: true });
    expect(await polls.closePoll("nope000000")).toEqual({ ok: false, reason: "not_found" });
  });

  it("표가 없으면 총 0표, 모든 비율 0, 최다 득표 없음", async () => {
    const results = await closedResults([0, 0, 0]);

    expect(results.total).toBe(0);
    expect(
      results.options.map((option) => [option.votes, option.percent, option.isTop, option.isMine]),
    ).toEqual([
      [0, 0, false, false],
      [0, 0, false, false],
      [0, 0, false, false],
    ]);
  });
});

describe("자동 마감", () => {
  it("마감 예정 시각 전에는 진행 중이고 표를 받는다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));
    const [a] = await optionIds(id);
    const justBefore = pollsAt(at(HOUR - 1000));

    expect((await justBefore.getPollForVoter(id, null))?.status).toBe("open");
    expect(await justBefore.castVote(id, a, alice)).toEqual({ ok: true });
  });

  it("마감 예정 시각이 지나면 마감되어 결과가 공개되고, 표를 거부하며, 마감 시각은 마감 예정 시각이다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));
    await castVotes(id, [2, 1]);
    const later = pollsAt(at(2 * HOUR));

    const poll = await later.getPollForVoter(id, null);

    expect(poll?.status).toBe("closed");
    expect(poll?.status === "closed" && poll.closedAt).toEqual(at(HOUR));
    expect(poll?.status === "closed" && poll.results.total).toBe(3);
    expect(await later.castVote(id, (await optionIds(id))[0], bob)).toEqual({
      ok: false,
      reason: "closed",
    });
    expect((await later.listPolls())[0]).toMatchObject({ isClosed: true, closedAt: at(HOUR) });
  });

  it("마감 예정 시각 전에 직접 마감하면 마감 시각은 직접 마감한 시각이다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(DAY));

    await pollsAt(at(HOUR)).closePoll(id);

    const poll = await pollsAt(at(2 * HOUR)).getPollForVoter(id, null);
    expect(poll?.status === "closed" && poll.closedAt).toEqual(at(HOUR));
  });

  it("마감 예정 시각이 지난 뒤 직접 마감해도 성공하고, 마감 시각은 그대로다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));
    const later = pollsAt(at(3 * HOUR));

    expect(await later.closePoll(id)).toEqual({ ok: true });

    const poll = await later.getPollForVoter(id, null);
    expect(poll?.status === "closed" && poll.closedAt).toEqual(at(HOUR));
  });
});

describe("extendDeadline", () => {
  it("진행 중인 투표를 연장하면 투표자에게 바뀐 마감 예정 시각이 보인다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));

    expect(await polls.extendDeadline(id, at(3 * HOUR))).toEqual({ ok: true });

    const poll = await polls.getPollForVoter(id, null);
    expect(poll?.status === "open" && poll.deadline).toEqual(at(3 * HOUR));
  });

  it("원래 마감 예정 시각이 지나도, 연장된 시각 전이면 투표할 수 있다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));
    await polls.extendDeadline(id, at(3 * HOUR));
    const later = pollsAt(at(2 * HOUR));

    expect((await later.getPollForVoter(id, null))?.status).toBe("open");
    expect(await later.castVote(id, (await optionIds(id))[0], alice)).toEqual({ ok: true });
  });

  it("현재 마감 예정 시각보다 늦지 않으면 not_later로 거부하고 바꾸지 않는다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(3 * HOUR));

    expect(await polls.extendDeadline(id, at(3 * HOUR))).toEqual({ ok: false, reason: "not_later" });
    expect(await polls.extendDeadline(id, at(2 * HOUR))).toEqual({ ok: false, reason: "not_later" });
    const poll = await polls.getPollForVoter(id, null);
    expect(poll?.status === "open" && poll.deadline).toEqual(at(3 * HOUR));
  });

  it("지금부터 30일을 넘기면 out_of_range로 거부하고, 정확히 30일은 받아들인다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));

    expect(await polls.extendDeadline(id, at(30 * DAY + 1000))).toEqual({
      ok: false,
      reason: "out_of_range",
    });
    expect(await polls.extendDeadline(id, at(30 * DAY))).toEqual({ ok: true });
  });

  it("직접 마감한 투표는 closed로 거부한다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(DAY));
    await polls.closePoll(id);

    expect(await polls.extendDeadline(id, at(2 * DAY))).toEqual({ ok: false, reason: "closed" });
  });

  it("마감 예정 시각이 지난 투표는 closed로 거부하고 다시 열리지 않는다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));
    const later = pollsAt(at(2 * HOUR));

    expect(await later.extendDeadline(id, at(DAY))).toEqual({ ok: false, reason: "closed" });
    expect((await later.getPollForVoter(id, null))?.status).toBe("closed");
  });

  it("마감된 투표에 더 이른 시각을 주면 not_later가 아니라 closed로 거부한다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(DAY));
    await polls.closePoll(id);

    expect(await polls.extendDeadline(id, at(HOUR))).toEqual({ ok: false, reason: "closed" });
  });

  it("없는 투표는 not_found", async () => {
    expect(await polls.extendDeadline("nope000000", at(DAY))).toEqual({
      ok: false,
      reason: "not_found",
    });
  });
});

describe("getPollForAdmin", () => {
  it("진행 중인 투표의 질문, 상태, 마감 예정 시각을 보여준다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(DAY));

    expect(await polls.getPollForAdmin(id)).toMatchObject({
      id,
      question: "점심?",
      status: "open",
      deadline: at(DAY),
      closedAt: null,
    });
  });

  it("마감된 투표는 마감 시각을 함께 보여준다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(DAY));
    await pollsAt(at(HOUR)).closePoll(id);

    expect(await pollsAt(at(2 * HOUR)).getPollForAdmin(id)).toMatchObject({
      status: "closed",
      deadline: at(DAY),
      closedAt: at(HOUR),
    });
  });

  it("마감 예정 시각이 지나 마감된 투표는 마감 시각이 마감 예정 시각이다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));

    expect(await pollsAt(at(2 * HOUR)).getPollForAdmin(id)).toMatchObject({
      status: "closed",
      deadline: at(HOUR),
      closedAt: at(HOUR),
    });
  });

  it("없는 투표는 null", async () => {
    expect(await polls.getPollForAdmin("nope000000")).toBeNull();
  });
});

describe("getPollForAdmin 순위와 격차", () => {
  async function ranking(options: string[], votesPerOption: number[]) {
    const id = await createOpenPoll("점심?", options);
    await castVotes(id, votesPerOption);
    const poll = await polls.getPollForAdmin(id);
    return poll!.ranking;
  }

  it("선택지를 득표순으로 정렬하고 경쟁 순위를 붙인다 (동점은 같은 순위, 다음 순위는 건너뜀)", async () => {
    const { options } = await ranking(["a", "b", "c", "d"], [1, 3, 3, 0]);

    expect(options.map(({ label, rank, votes, percent, isTop }) => [label, rank, votes, percent, isTop]))
      .toEqual([
        ["b", 1, 3, 42.9, true],
        ["c", 1, 3, 42.9, true],
        ["a", 3, 1, 14.3, false],
        ["d", 4, 0, 0, false],
      ]);
  });

  it("요약에 총 표 수, 1위, 1위와 2위의 차이(표, 반올림 전 비율로 계산한 %p)를 담는다", async () => {
    const { summary } = await ranking(["a", "b", "c"], [2, 1, 0]);

    expect(summary).toEqual({
      total: 3,
      leaders: [expect.objectContaining({ label: "a" })],
      isTie: false,
      gap: { votes: 1, percentPoints: 33.3 },
    });
  });

  it("1위가 동점이면 동점인 선택지를 모두 1위로 두고, 차이는 0이다", async () => {
    const { summary } = await ranking(["a", "b", "c"], [2, 2, 1]);

    expect(summary.isTie).toBe(true);
    expect(summary.leaders.map((option) => option.label)).toEqual(["a", "b"]);
    expect(summary.gap).toEqual({ votes: 0, percentPoints: 0 });
  });

  it("표가 없으면 1위와 격차가 없다", async () => {
    const { summary } = await ranking(["a", "b"], [0, 0]);

    expect(summary).toEqual({ total: 0, leaders: [], isTie: false, gap: null });
  });

  it("마감 전에도 관리자에게는 득표 현황이 있고, 투표자에게는 여전히 수치가 없다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"]);
    await castVotes(id, [1, 2]);

    const admin = await polls.getPollForAdmin(id);
    const voter = await polls.getPollForVoter(id, null);

    expect(admin?.status).toBe("open");
    expect(admin?.ranking.summary.total).toBe(3);
    expect(voter).not.toHaveProperty("results");
    expect(JSON.stringify(voter)).not.toMatch(/votes|total|percent|rank/i);
  });
});

describe("deletePoll", () => {
  it("표가 있는 투표를 지우면 어디서도 조회되지 않고, 다른 투표는 그대로다", async () => {
    const doomed = await createOpenPoll("지울 투표");
    const kept = await createOpenPoll("남길 투표", ["a", "b"]);
    await castVotes(doomed, [2, 1, 0]);
    await castVotes(kept, [1, 1]);

    expect(await polls.deletePoll(doomed)).toEqual({ ok: true });

    expect(await polls.getPollForVoter(doomed, null)).toBeNull();
    const list = await polls.listPollsForAdmin();
    expect(list.map((poll) => [poll.id, poll.tally.total])).toEqual([[kept, 2]]);
  });

  it("없는 투표를 지워도 성공한다", async () => {
    const id = await createOpenPoll();
    await polls.deletePoll(id);

    expect(await polls.deletePoll(id)).toEqual({ ok: true });
  });
});

describe("listPollsForAdmin", () => {
  it("마감 여부와 관계없이 선택지별 득표 현황과 총 표 수를 보여준다", async () => {
    const open = await createOpenPoll("진행 중", ["a", "b"]);
    const closed = await createOpenPoll("마감", ["x", "y"]);
    await castVotes(open, [1, 2]);
    await castVotes(closed, [3, 0]);
    await polls.closePoll(closed);

    const list = await polls.listPollsForAdmin();

    expect(
      list.map((poll) => [
        poll.question,
        poll.isClosed,
        poll.tally.total,
        poll.tally.options.map((option) => [option.label, option.votes]),
      ]),
    ).toEqual([
      ["마감", true, 3, [["x", 3], ["y", 0]]],
      ["진행 중", false, 3, [["a", 1], ["b", 2]]],
    ]);
  });
});

describe("createPoll", () => {
  it("만든 투표를 질문과 선택지 순서 그대로 조회할 수 있다", async () => {
    const id = await createOpenPoll("점심 뭐 먹지?", ["김밥", "라면", "돈가스"]);

    const poll = await polls.getPollForVoter(id, null);

    expect(poll).toMatchObject({
      id,
      question: "점심 뭐 먹지?",
      status: "open",
      myChoice: null,
    });
    expect(poll?.options.map((option) => option.label)).toEqual(["김밥", "라면", "돈가스"]);
  });

  const badDeadlines: [string, Date | null][] = [
    ["없음", null],
    ["날짜가 아님", new Date("not a date")],
    ["지금부터 10분 미만", at(10 * MINUTE - 1000)],
    ["이미 지난 시각", at(-HOUR)],
    ["지금부터 30일 초과", at(30 * DAY + 1000)],
  ];

  it.each(badDeadlines)("마감 예정 시각이 %s이면 오류를 돌려주고 저장하지 않는다", async (_, deadline) => {
    const result = await polls.createPoll({ question: "q", options: ["a", "b"], deadline });

    expect(result).toEqual({ ok: false, errors: { deadline: expect.any(String) } });
    expect(await polls.listPolls()).toEqual([]);
  });

  it("마감 예정 시각 경계값(정확히 10분 뒤, 30일 뒤)은 받아들인다", async () => {
    const results = await Promise.all([
      polls.createPoll({ question: "q", options: ["a", "b"], deadline: at(10 * MINUTE) }),
      polls.createPoll({ question: "q", options: ["a", "b"], deadline: at(30 * DAY) }),
    ]);

    expect(results.map((result) => result.ok)).toEqual([true, true]);
  });

  it("다른 입력 오류와 마감 예정 시각 누락을 함께 알린다", async () => {
    const result = await polls.createPoll({ question: "", options: ["a", "b"], deadline: null });

    expect(result).toEqual({
      ok: false,
      errors: { question: expect.any(String), deadline: expect.any(String) },
    });
  });

  it("만든 투표는 정한 마감 예정 시각을 가진다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(3 * HOUR));

    const poll = await polls.getPollForVoter(id, null);

    expect(poll?.status === "open" && poll.deadline).toEqual(at(3 * HOUR));
  });

  it("질문과 선택지의 앞뒤 공백을 제거해 저장한다", async () => {
    const id = await createOpenPoll("  점심?  ", [" 김밥", "라면  "]);

    const poll = await polls.getPollForVoter(id, null);

    expect(poll?.question).toBe("점심?");
    expect(poll?.options.map((option) => option.label)).toEqual(["김밥", "라면"]);
  });

  const invalidInputs: [string, { question: string; options: string[] }, object][] = [
    ["질문이 비었음", { question: "", options: ["a", "b"] }, { question: expect.any(String) }],
    ["질문이 공백뿐", { question: "   ", options: ["a", "b"] }, { question: expect.any(String) }],
    ["질문이 200자 초과", { question: "가".repeat(201), options: ["a", "b"] }, { question: expect.any(String) }],
    ["선택지가 1개", { question: "q", options: ["a"] }, { options: expect.any(String) }],
    ["선택지가 11개", { question: "q", options: Array.from({ length: 11 }, (_, i) => `${i}`) }, { options: expect.any(String) }],
    ["선택지가 공백뿐", { question: "q", options: ["a", "  "] }, { optionErrors: { 1: expect.any(String) } }],
    ["선택지가 100자 초과", { question: "q", options: ["가".repeat(101), "b"] }, { optionErrors: { 0: expect.any(String) } }],
    ["공백 제거 후 중복", { question: "q", options: ["김밥", "라면", " 김밥 "] }, { optionErrors: { 2: expect.any(String) } }],
  ];

  it.each(invalidInputs)("%s이면 필드별 오류를 돌려주고 저장하지 않는다", async (_, input, errors) => {
    const result = await polls.createPoll({ ...input, deadline: at(DAY) });

    expect(result).toEqual({ ok: false, errors: expect.objectContaining(errors) });
    expect(await polls.listPolls()).toEqual([]);
  });

  it("경계값(질문 200자, 선택지 100자, 선택지 2개와 10개)은 받아들인다", async () => {
    const results = await Promise.all([
      polls.createPoll({ question: "가".repeat(200), options: ["가".repeat(100), "b"], deadline: at(DAY) }),
      polls.createPoll({ question: "q", options: Array.from({ length: 10 }, (_, i) => `${i}`), deadline: at(DAY) }),
    ]);
    expect(results.map((result) => result.ok)).toEqual([true, true]);
  });
});
