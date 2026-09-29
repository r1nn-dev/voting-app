import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testSql } from "@/tests/db";
import { CODE_ALPHABET, createPolls } from "./polls";

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
  it("투표가 없으면 두 구역 모두 비어 있다", async () => {
    expect(await polls.listPolls()).toEqual({ scheduled: [], open: [], closed: [] });
  });

  it("진행 중 구역은 마감 예정 시각이 가까운 순이다", async () => {
    const later = await createOpenPoll("나중에 끝남", ["a", "b"], at(3 * DAY));
    const sooner = await createOpenPoll("곧 끝남", ["a", "b"], at(HOUR));

    const { open, closed } = await polls.listPolls();

    expect(open).toEqual([
      { id: sooner, question: "곧 끝남", deadline: at(HOUR) },
      { id: later, question: "나중에 끝남", deadline: at(3 * DAY) },
    ]);
    expect(closed).toEqual([]);
  });

  it("마감 구역은 마감 시각 최근순이다 (직접 마감과 기한 지남이 섞여도)", async () => {
    const byDeadline = await createOpenPoll("기한 지남", ["a", "b"], at(2 * HOUR));
    const byHand = await createOpenPoll("직접 마감", ["a", "b"], at(DAY));
    await pollsAt(at(HOUR)).closePoll(byHand);

    const { open, closed } = await pollsAt(at(3 * HOUR)).listPolls();

    expect(open).toEqual([]);
    expect(closed).toEqual([
      { id: byDeadline, question: "기한 지남", closedAt: at(2 * HOUR) },
      { id: byHand, question: "직접 마감", closedAt: at(HOUR) },
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

/** The voter view of a poll that is still public (open or closed, not archived). */
async function publicView(pollId: string, voterId: string | null) {
  const poll = await polls.getPollForVoter(pollId, voterId);
  if (!poll || poll.status === "archived") throw new Error(`공개 중인 투표가 아님: ${pollId}`);
  return poll;
}

async function optionIds(pollId: string) {
  const poll = await publicView(pollId, null);
  return poll.options.map((option) => option.id);
}

describe("castVote", () => {
  it("표를 던지면 그 투표자의 선택으로 조회된다", async () => {
    const id = await createOpenPoll();
    const [, ramen] = await optionIds(id);

    expect(await polls.castVote(id, [ramen], alice)).toEqual({ ok: true });

    expect((await publicView(id, alice)).myChoices).toEqual([ramen]);
    expect((await publicView(id, bob)).myChoices).toEqual([]);
  });

  it("같은 투표자의 두 번째 표는 거부하고 첫 선택을 유지한다", async () => {
    const id = await createOpenPoll();
    const [kimbap, ramen] = await optionIds(id);
    await polls.castVote(id, [kimbap], alice);

    expect(await polls.castVote(id, [ramen], alice)).toEqual({ ok: false, reason: "already_voted" });
    expect((await publicView(id, alice)).myChoices).toEqual([kimbap]);
  });

  it("다른 투표의 선택지에는 표를 넣을 수 없다", async () => {
    const id = await createOpenPoll();
    const [otherOption] = await optionIds(await createOpenPoll("다른 투표"));

    expect(await polls.castVote(id, [otherOption], alice)).toEqual({
      ok: false,
      reason: "invalid_choice",
    });
    expect((await publicView(id, alice)).myChoices).toEqual([]);
  });

  it("형식이 잘못된 선택지 ID도 잘못된 선택지로 거부한다", async () => {
    const id = await createOpenPoll();

    expect(await polls.castVote(id, ["not-a-number"], alice)).toEqual({
      ok: false,
      reason: "invalid_choice",
    });
  });

  it("단일 선택은 선택지가 정확히 하나여야 한다", async () => {
    const id = await createOpenPoll();
    const [kimbap, ramen] = await optionIds(id);

    expect(await polls.castVote(id, [], alice)).toEqual({ ok: false, reason: "invalid_choice" });
    expect(await polls.castVote(id, [kimbap, ramen], alice)).toEqual({
      ok: false,
      reason: "invalid_choice",
    });
    // Nothing was stored, so the browser can still vote.
    expect(await polls.castVote(id, [ramen], alice)).toEqual({ ok: true });
  });

  it("다른 투표의 선택지로 실패한 표는 남지 않는다", async () => {
    const id = await createOpenPoll();
    const [otherOption] = await optionIds(await createOpenPoll("다른 투표"));
    const [kimbap] = await optionIds(id);
    await polls.castVote(id, [otherOption], alice);

    expect(await polls.castVote(id, [kimbap], alice)).toEqual({ ok: true });
    expect((await publicView(id, alice)).myChoices).toEqual([kimbap]);
  });

  it("없는 투표에는 표를 넣을 수 없다", async () => {
    const [option] = await optionIds(await createOpenPoll());

    expect(await polls.castVote("nope000000", [option], alice)).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("같은 투표자도 다른 투표에는 각각 한 표씩 던질 수 있다", async () => {
    const first = await createOpenPoll("첫 번째");
    const second = await createOpenPoll("두 번째");

    expect(await polls.castVote(first, [(await optionIds(first))[0]], alice)).toEqual({ ok: true });
    expect(await polls.castVote(second, [(await optionIds(second))[1]], alice)).toEqual({ ok: true });
  });

  it("진행 중인 투표의 투표자 시점에는 어떤 수치도 없다", async () => {
    const id = await createOpenPoll();
    const [kimbap] = await optionIds(id);
    await polls.castVote(id, [kimbap], alice);
    await polls.castVote(id, [kimbap], bob);

    const poll = await publicView(id, alice);

    expect(poll?.status).toBe("open");
    expect(poll).not.toHaveProperty("results");
    expect(JSON.stringify(poll)).not.toMatch(/count|votes|total|percent/i);
  });
});

const voters = Array.from(
  { length: 12 },
  (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
);

/** Casts one vote per entry: votesPerOption[i] voters choose option i, on `client`'s clock. */
async function castVotes(pollId: string, votesPerOption: number[], client = polls) {
  const ids = await optionIds(pollId);
  let voter = 0;
  for (const [index, count] of votesPerOption.entries()) {
    for (let i = 0; i < count; i++) await client.castVote(pollId, [ids[index]], voters[voter++]);
  }
}

describe("closePoll", () => {
  it("마감하면 목록에 마감으로 보이고, 결과가 공개되고, 이후 표는 거부된다", async () => {
    const id = await createOpenPoll();
    const [kimbap] = await optionIds(id);
    await polls.castVote(id, [kimbap], alice);

    expect(await polls.closePoll(id)).toEqual({ ok: true });

    expect((await polls.listPolls()).closed.map((poll) => poll.id)).toEqual([id]);
    const poll = await publicView(id, alice);
    expect(poll?.status).toBe("closed");
    expect(poll?.myChoices).toEqual([kimbap]);
    expect(await polls.castVote(id, [kimbap], bob)).toEqual({ ok: false, reason: "closed" });
  });

  /** castVotes gives voters[0] the first option that has any votes. */
  async function closedResults(votesPerOption: number[], voterId: string | null = null) {
    const id = await createOpenPoll("점심?", ["김밥", "라면", "돈가스"]);
    await castVotes(id, votesPerOption);
    await polls.closePoll(id);
    const poll = await publicView(id, voterId);
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

    const poll = await publicView(id, null);

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
    expect(await justBefore.castVote(id, [a], alice)).toEqual({ ok: true });
  });

  it("마감 예정 시각이 지나면 마감되어 결과가 공개되고, 표를 거부하며, 마감 시각은 마감 예정 시각이다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));
    await castVotes(id, [2, 1]);
    const later = pollsAt(at(2 * HOUR));

    const poll = await later.getPollForVoter(id, null);

    expect(poll?.status).toBe("closed");
    expect(poll?.status === "closed" && poll.closedAt).toEqual(at(HOUR));
    expect(poll?.status === "closed" && poll.results.total).toBe(3);
    expect(await later.castVote(id, [(await optionIds(id))[0]], bob)).toEqual({
      ok: false,
      reason: "closed",
    });
    expect((await later.listPolls()).closed).toEqual([
      { id, question: "점심?", closedAt: at(HOUR) },
    ]);
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

    const poll = await publicView(id, null);
    expect(poll?.status === "open" && poll.deadline).toEqual(at(3 * HOUR));
  });

  it("원래 마감 예정 시각이 지나도, 연장된 시각 전이면 투표할 수 있다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));
    await polls.extendDeadline(id, at(3 * HOUR));
    const later = pollsAt(at(2 * HOUR));

    expect((await later.getPollForVoter(id, null))?.status).toBe("open");
    expect(await later.castVote(id, [(await optionIds(id))[0]], alice)).toEqual({ ok: true });
  });

  it("현재 마감 예정 시각보다 늦지 않으면 not_later로 거부하고 바꾸지 않는다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(3 * HOUR));

    expect(await polls.extendDeadline(id, at(3 * HOUR))).toEqual({ ok: false, reason: "not_later" });
    expect(await polls.extendDeadline(id, at(2 * HOUR))).toEqual({ ok: false, reason: "not_later" });
    const poll = await publicView(id, null);
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
      kind: "decided",
      total: 3,
      leader: expect.objectContaining({ label: "a" }),
      gap: { votes: 1, percentPoints: 33.3 },
    });
  });

  it("1위가 동점이면 동점인 선택지를 모두 1위로 두고, 차이는 0이다", async () => {
    const { summary } = await ranking(["a", "b", "c"], [2, 2, 1]);

    expect(summary).toEqual({
      kind: "tied",
      total: 5,
      leaders: [expect.objectContaining({ label: "a" }), expect.objectContaining({ label: "b" })],
    });
  });

  it("표가 없으면 1위와 격차가 없고, 모든 선택지가 1위이되 강조되지 않는다", async () => {
    const { summary, options } = await ranking(["a", "b"], [0, 0]);

    expect(summary).toEqual({ kind: "empty", total: 0 });
    expect(options.map(({ label, rank, isTop }) => [label, rank, isTop])).toEqual([
      ["a", 1, false],
      ["b", 1, false],
    ]);
  });

  it("마감 전에도 관리자에게는 득표 현황이 있고, 투표자에게는 여전히 수치가 없다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"]);
    await castVotes(id, [1, 2]);

    const admin = await polls.getPollForAdmin(id);
    const voter = await publicView(id, null);

    expect(admin?.status).toBe("open");
    expect(admin?.ranking.options.map(({ label, rank }) => [label, rank])).toEqual([
      ["b", 1],
      ["a", 2],
    ]);
    expect(admin?.ranking.summary).toMatchObject({ kind: "decided", gap: { votes: 1 } });
    expect(voter).not.toHaveProperty("results");
    expect(JSON.stringify(voter)).not.toMatch(/votes|total|percent|rank/i);
  });
});

describe("보관", () => {
  async function closedAtHour() {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));
    await castVotes(id, [2, 1]);
    return id;
  }

  it("마감 시각 + 30일 직전에는 마감, 그 순간부터는 보관이다", async () => {
    const id = await closedAtHour();

    expect((await pollsAt(at(HOUR + 30 * DAY - 1000)).getPollForVoter(id, null))?.status).toBe(
      "closed",
    );
    expect(await pollsAt(at(HOUR + 30 * DAY)).getPollForVoter(id, null)).toEqual({
      id,
      status: "archived",
    });
  });

  it("보관된 투표는 투표자에게 질문과 결과를 주지 않지만, 관리자에게는 모두 보인다", async () => {
    const id = await closedAtHour();
    const archived = pollsAt(at(40 * DAY));

    const voter = await archived.getPollForVoter(id, alice);
    const admin = await archived.getPollForAdmin(id);

    expect(voter).toEqual({ id, status: "archived" });
    expect(admin).toMatchObject({ status: "archived", question: "점심?", closedAt: at(HOUR) });
    expect(admin?.ranking.summary.total).toBe(3);
  });

  it("보관된 투표는 메인 목록에서 빠지고, 진행 중과 공개 중인 마감 투표는 남는다", async () => {
    const archived = await closedAtHour();
    const stillPublic = await createOpenPoll("마감됐지만 공개 중", ["a", "b"], at(20 * DAY));
    // Created later so its deadline can lie beyond the moment we look at.
    const created = await pollsAt(at(25 * DAY)).createPoll({
      question: "진행 중",
      options: ["a", "b"],
      deadline: at(40 * DAY),
    });
    if (!created.ok) throw new Error("투표 생성 실패");

    const { open, closed } = await pollsAt(at(HOUR + 30 * DAY)).listPolls();

    expect(open.map((poll) => poll.id)).toEqual([created.id]);
    expect(closed.map((poll) => poll.id)).toEqual([stillPublic]);
    expect([...open, ...closed].map((poll) => poll.id)).not.toContain(archived);
  });

  it("마감 예정 시각 전에 직접 마감한 투표는 직접 마감한 시각부터 30일 뒤에 보관된다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(20 * DAY));
    await pollsAt(at(HOUR)).closePoll(id);

    expect((await pollsAt(at(HOUR + 30 * DAY)).getPollForVoter(id, null))?.status).toBe(
      "archived",
    );
  });

  it("연장된 투표는 보관 시점도 뒤로 밀린다", async () => {
    const id = await createOpenPoll("점심?", ["a", "b"], at(HOUR));
    await polls.extendDeadline(id, at(DAY));

    const oneMonthAfterOriginal = pollsAt(at(HOUR + 30 * DAY));
    expect((await oneMonthAfterOriginal.getPollForVoter(id, null))?.status).toBe("closed");
    expect((await pollsAt(at(DAY + 30 * DAY)).getPollForVoter(id, null))?.status).toBe("archived");
  });

  it("보관된 투표도 관리자가 직접 삭제할 수 있고, 저절로 지워지지는 않는다", async () => {
    const id = await closedAtHour();
    const muchLater = pollsAt(at(365 * DAY));

    expect(await muchLater.getPollForAdmin(id)).not.toBeNull();
    await muchLater.deletePoll(id);
    expect(await muchLater.getPollForAdmin(id)).toBeNull();
  });
});

describe("링크 전용", () => {
  async function unlisted(question: string, deadline = at(DAY)) {
    const result = await polls.createPoll({ question, options: ["a", "b"], deadline, listed: false });
    if (!result.ok) throw new Error("투표 생성 실패");
    return result.id;
  }

  it("링크 전용 투표는 메인 목록의 어느 구역에도 나오지 않지만, 링크로는 투표할 수 있다", async () => {
    const hidden = await unlisted("링크 전용");
    const shown = await createOpenPoll("목록 공개");

    expect((await polls.listPolls()).open.map((poll) => poll.id)).toEqual([shown]);
    expect((await publicView(hidden, null)).status).toBe("open");
    expect(await polls.castVote(hidden, [(await optionIds(hidden))[0]], alice)).toEqual({ ok: true });
  });

  it("마감돼도 메인 목록에 나오지 않는다", async () => {
    await unlisted("링크 전용", at(HOUR));

    expect((await pollsAt(at(2 * HOUR)).listPolls()).closed).toEqual([]);
  });

  it("관리 목록과 관리자 조회에는 공개 방식과 함께 나온다", async () => {
    const hidden = await unlisted("링크 전용");
    const shown = await createOpenPoll("목록 공개");

    const { open } = await polls.listPollsForAdmin();

    expect(open.map((poll) => [poll.id, poll.listed]).sort()).toEqual(
      [[hidden, false], [shown, true]].sort(),
    );
    expect((await polls.getPollForAdmin(hidden))?.listed).toBe(false);
  });

  it("공개 방식을 기본으로 정하지 않으면 목록 공개다", async () => {
    const id = await createOpenPoll();

    expect((await polls.getPollForAdmin(id))?.listed).toBe(true);
  });

  it("setListed로 언제든 바꿀 수 있고, 바로 반영된다", async () => {
    const id = await unlisted("링크 전용", at(HOUR));

    expect(await polls.setListed(id, true)).toEqual({ ok: true });
    expect((await polls.listPolls()).open.map((poll) => poll.id)).toEqual([id]);

    const later = pollsAt(at(2 * HOUR));
    expect(await later.setListed(id, false)).toEqual({ ok: true });
    expect((await later.listPolls()).closed).toEqual([]);
  });

  it("없는 투표는 not_found", async () => {
    expect(await polls.setListed("nope000000", false)).toEqual({ ok: false, reason: "not_found" });
  });
});

describe("resultsCsv", () => {
  it("BOM으로 시작하고, 투표 정보와 선택지별 순위·표 수·비율을 득표순으로 담는다", async () => {
    const id = await createOpenPoll("점심?", ["김밥", "라면", "돈가스"], at(HOUR));
    await castVotes(id, [1, 2, 0]);

    const csv = await pollsAt(at(2 * HOUR)).resultsCsv(id);

    expect(csv?.startsWith("\uFEFF")).toBe(true);
    const lines = csv!.slice(1).split("\r\n");
    expect(lines).toContain("질문,점심?");
    expect(lines).toContain("상태,마감");
    expect(lines).toContain("총 표 수,3");
    expect(lines.slice(lines.indexOf("순위,선택지,표 수,비율(%)"))).toEqual([
      "순위,선택지,표 수,비율(%)",
      "1,라면,2,66.7",
      "2,김밥,1,33.3",
      "3,돈가스,0,0.0",
    ]);
  });

  it("쉼표·따옴표가 든 값은 CSV 규칙대로 감싸고, 투표자 식별 값은 담지 않는다", async () => {
    const id = await createOpenPoll('A, "B"?', ["x,y", 'say "hi"']);
    await castVotes(id, [1, 0]);

    const csv = (await polls.resultsCsv(id))!;

    expect(csv).toContain('질문,"A, ""B""?"');
    expect(csv).toContain('1,"x,y",1,100.0');
    expect(csv).toContain('2,"say ""hi""",0,0.0');
    expect(csv).not.toContain(voters[0]);
  });

  it("마감 전에도 만들고, 없는 투표는 null", async () => {
    const id = await createOpenPoll();

    expect(await polls.resultsCsv(id)).toContain("상태,진행 중");
    expect(await polls.resultsCsv("nope000000")).toBeNull();
  });
});

describe("복제용 설정", () => {
  it("질문, 선택지(생성 순서), 공개 방식을 돌려준다", async () => {
    const created = await polls.createPoll({
      question: "점심?",
      options: ["김밥", "라면", "돈가스"],
      deadline: at(DAY),
      listed: false,
    });
    if (!created.ok) throw new Error("투표 생성 실패");
    await castVotes(created.id, [0, 0, 2]);

    expect((await polls.getPollForAdmin(created.id))?.template).toEqual({
      question: "점심?",
      options: ["김밥", "라면", "돈가스"],
      listed: false,
      usesCodes: false,
    });
  });

  it("참여 코드 사용 여부는 복사하지만 코드는 복사하지 않는다", async () => {
    const id = await createCodePoll(3);

    const admin = await polls.getPollForAdmin(id);

    expect(admin?.template.usesCodes).toBe(true);
    expect(JSON.stringify(admin?.template)).not.toMatch(/[A-Z2-9]{8}/);
  });
});

describe("예약 공개", () => {
  async function scheduled(opensAt: Date, deadline: Date, question = "예약") {
    const result = await polls.createPoll({ question, options: ["a", "b"], opensAt, deadline });
    if (!result.ok) throw new Error(`투표 생성 실패: ${JSON.stringify(result.errors)}`);
    return result.id;
  }

  it("시작 예정 시각 1초 전까지는 시작 전이고, 그 순간부터 진행 중이다", async () => {
    const id = await scheduled(at(HOUR), at(DAY));

    const before = await pollsAt(at(HOUR - 1000)).getPollForVoter(id, null);
    expect(before).toMatchObject({ status: "scheduled", opensAt: at(HOUR), deadline: at(DAY) });
    expect(JSON.stringify(before)).not.toMatch(/votes|total|percent/i);
    expect((await pollsAt(at(HOUR)).getPollForVoter(id, null))?.status).toBe("open");
  });

  it("시작 전에는 표를 not_started로 거부하고, 시작하면 받는다", async () => {
    const id = await scheduled(at(HOUR), at(DAY));
    const [a] = await optionIds(id);

    expect(await polls.castVote(id, [a], alice)).toEqual({ ok: false, reason: "not_started" });
    expect(await pollsAt(at(HOUR)).castVote(id, [a], alice)).toEqual({ ok: true });
  });

  it("시작 전인 투표는 마감할 수 없다", async () => {
    const id = await scheduled(at(HOUR), at(DAY));

    expect(await polls.closePoll(id)).toEqual({ ok: false, reason: "not_started" });
  });

  it("시작 예정 시각을 비우면 바로 시작하고, 시작 예정 시각은 만든 시각이다", async () => {
    const id = await createOpenPoll();

    expect((await polls.getPollForAdmin(id))?.opensAt).toEqual(T0);
  });

  const badSchedules: [string, Date, Date, string][] = [
    ["시작 예정 시각이 지난 시각", at(-HOUR), at(DAY), "opensAt"],
    ["시작 예정 시각이 30일 초과", at(30 * DAY + 1000), at(31 * DAY), "opensAt"],
    ["마감이 시작 + 10분 미만", at(HOUR), at(HOUR + 5 * MINUTE), "deadline"],
    ["마감이 시작 + 30일 초과", at(HOUR), at(HOUR + 30 * DAY + 1000), "deadline"],
  ];

  it.each(badSchedules)("%s이면 오류를 돌려주고 저장하지 않는다", async (_, opensAt, deadline, field) => {
    const result = await polls.createPoll({ question: "q", options: ["a", "b"], opensAt, deadline });

    expect(result).toEqual({ ok: false, errors: { [field]: expect.any(String) } });
    expect(await polls.listPollsForAdmin()).toMatchObject({ scheduled: [], open: [] });
  });

  it("마감 범위는 시작 예정 시각 기준이라, 지금부터 30일을 넘는 마감도 받아들인다", async () => {
    const result = await polls.createPoll({
      question: "q",
      options: ["a", "b"],
      opensAt: at(20 * DAY),
      deadline: at(45 * DAY),
    });

    expect(result.ok).toBe(true);
  });

  it("reschedule로 시작 전 투표의 시작·마감 예정 시각을 바꾸고, 지금 바로 시작할 수 있다", async () => {
    const id = await scheduled(at(DAY), at(2 * DAY));

    expect(await polls.reschedule(id, { opensAt: at(3 * DAY), deadline: at(4 * DAY) })).toEqual({
      ok: true,
    });
    expect(await polls.getPollForAdmin(id)).toMatchObject({ opensAt: at(3 * DAY), deadline: at(4 * DAY) });

    expect(await polls.reschedule(id, { opensAt: T0, deadline: at(4 * DAY) })).toEqual({ ok: true });
    expect((await publicView(id, null)).status).toBe("open");
  });

  it("reschedule은 시작한 투표를 started, 범위 밖을 out_of_range, 없는 투표를 not_found로 거부한다", async () => {
    const started = await createOpenPoll();
    const waiting = await scheduled(at(DAY), at(2 * DAY));

    expect(await polls.reschedule(started, { opensAt: at(DAY), deadline: at(2 * DAY) })).toEqual({
      ok: false,
      reason: "started",
    });
    expect(await polls.reschedule(waiting, { opensAt: at(DAY), deadline: at(DAY + MINUTE) })).toEqual({
      ok: false,
      reason: "out_of_range",
    });
    expect(await polls.reschedule("nope000000", { opensAt: at(DAY), deadline: at(2 * DAY) })).toEqual({
      ok: false,
      reason: "not_found",
    });
  });

  it("startNow는 DB의 지금 시각으로 바로 시작하고, 마감 예정 시각은 그대로 둔다", async () => {
    const id = await scheduled(at(DAY), at(2 * DAY));

    expect(await pollsAt(at(HOUR)).startNow(id)).toEqual({ ok: true });

    expect(await pollsAt(at(HOUR)).getPollForAdmin(id)).toMatchObject({
      status: "open",
      opensAt: at(HOUR),
      deadline: at(2 * DAY),
    });
  });

  it("startNow는 이미 시작한 투표를 started로, 없는 투표를 not_found로 거부한다", async () => {
    const started = await createOpenPoll();

    expect(await polls.startNow(started)).toEqual({ ok: false, reason: "started" });
    expect(await polls.startNow("nope000000")).toEqual({ ok: false, reason: "not_found" });
  });

  it("연장은 시작 전 투표에 not_started로 거부한다 (시작 전에는 reschedule을 쓴다)", async () => {
    const id = await scheduled(at(DAY), at(2 * DAY));

    expect(await polls.extendDeadline(id, at(3 * DAY))).toEqual({ ok: false, reason: "not_started" });
  });

  it("메인 목록의 시작 예정 구역은 시작이 가까운 순이고, 링크 전용은 빠진다", async () => {
    const later = await scheduled(at(2 * DAY), at(3 * DAY), "나중");
    const sooner = await scheduled(at(HOUR), at(DAY), "곧");
    const hidden = await polls.createPoll({
      question: "숨김",
      options: ["a", "b"],
      opensAt: at(HOUR),
      deadline: at(DAY),
      listed: false,
    });
    if (!hidden.ok) throw new Error("투표 생성 실패");

    const { scheduled: list, open } = await polls.listPolls();

    expect(list).toEqual([
      { id: sooner, question: "곧", opensAt: at(HOUR) },
      { id: later, question: "나중", opensAt: at(2 * DAY) },
    ]);
    expect(open).toEqual([]);
  });

  it("관리 목록에 시작 전 묶음이 있고, 시작하면 진행 중으로 옮겨 간다", async () => {
    const id = await scheduled(at(HOUR), at(DAY));

    expect((await polls.listPollsForAdmin()).scheduled.map((poll) => [poll.id, poll.opensAt])).toEqual([
      [id, at(HOUR)],
    ]);
    const started = await pollsAt(at(HOUR)).listPollsForAdmin();
    expect(started.scheduled).toEqual([]);
    expect(started.open.map((poll) => poll.id)).toEqual([id]);
  });
});

async function createCodePoll(codeCount: number, deadline = at(DAY)) {
  const result = await polls.createPoll({
    question: "반장 선거",
    options: ["가", "나", "다"],
    deadline,
    codeCount,
  });
  if (!result.ok) throw new Error(`투표 생성 실패: ${JSON.stringify(result.errors)}`);
  return result.id;
}

const BASE_URL = "https://hanpyo.example";

/** Codes and whether each is used, read back through the admin CSV. */
async function codesOf(pollId: string) {
  const csv = await polls.codesCsv(pollId, BASE_URL);
  if (csv === null) throw new Error("투표 없음");
  return csv
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .slice(1)
    .map((line) => {
      const [code, used, link] = line.split(",");
      return { code, used: used === "사용함", link };
    });
}

describe("참여 코드", () => {
  it("만들 때 정한 개수만큼 8자리 코드를 헷갈리는 글자 없이, 중복 없이 발급한다", async () => {
    const id = await createCodePoll(200);

    const codes = (await codesOf(id)).map((row) => row.code);

    expect(codes).toHaveLength(200);
    expect(new Set(codes).size).toBe(200);
    for (const code of codes) {
      expect(code).toMatch(new RegExp(`^[${CODE_ALPHABET}]{8}$`));
      expect(code).not.toMatch(/[01OIL]/);
    }
    expect((await polls.getPollForAdmin(id))?.codes).toEqual({ issued: 200, used: 0 });
  });

  it("코드를 쓰지 않는 투표는 코드 통계가 없다", async () => {
    const id = await createOpenPoll();

    expect((await polls.getPollForAdmin(id))?.codes).toBeNull();
    expect((await publicView(id, alice)).usesCodes).toBe(false);
  });

  it("코드 개수는 0~500이다", async () => {
    for (const codeCount of [-1, 501, 1.5]) {
      const result = await polls.createPoll({
        question: "q",
        options: ["a", "b"],
        deadline: at(DAY),
        codeCount,
      });
      expect(result).toMatchObject({ ok: false, errors: { codeCount: expect.any(String) } });
    }
    expect(await polls.listPolls()).toEqual({ scheduled: [], open: [], closed: [] });
  });

  it("코드로 투표하면 표가 들어가고 코드가 사용 처리된다", async () => {
    const id = await createCodePoll(2);
    const [{ code }] = await codesOf(id);
    const [a] = await optionIds(id);

    expect(await polls.castVote(id, [a], alice, code)).toEqual({ ok: true });

    expect((await codesOf(id)).find((row) => row.code === code)?.used).toBe(true);
    expect((await polls.getPollForAdmin(id))?.codes).toEqual({ issued: 2, used: 1 });
    expect((await publicView(id, alice)).myChoices).toEqual([a]);
  });

  it("같은 코드 재사용, 없는 코드, 다른 투표의 코드, 코드 누락은 모두 invalid_code다", async () => {
    const id = await createCodePoll(2);
    const other = await createCodePoll(1);
    const [{ code }] = await codesOf(id);
    const [{ code: otherCode }] = await codesOf(other);
    const [a] = await optionIds(id);
    await polls.castVote(id, [a], alice, code);

    for (const attempt of [code, "ZZZZZZZZ", otherCode, "", null, undefined]) {
      expect(await polls.castVote(id, [a], bob, attempt)).toEqual({
        ok: false,
        reason: "invalid_code",
      });
    }
    expect((await polls.getPollForAdmin(id))?.ranking.summary.total).toBe(1);
    expect((await polls.getPollForAdmin(other))?.codes).toEqual({ issued: 1, used: 0 });
  });

  it("잘못된 선택지로 실패하면 코드가 소모되지 않는다", async () => {
    const id = await createCodePoll(1);
    const [{ code }] = await codesOf(id);
    const [otherOption] = await optionIds(await createOpenPoll("다른 투표"));

    expect(await polls.castVote(id, [otherOption], alice, code)).toEqual({
      ok: false,
      reason: "invalid_choice",
    });
    expect((await codesOf(id))[0].used).toBe(false);
  });

  it("소문자와 공백을 섞어 넣어도 같은 코드로 본다", async () => {
    const id = await createCodePoll(1);
    const [{ code }] = await codesOf(id);
    const [a] = await optionIds(id);
    const messy = `  ${code.slice(0, 4).toLowerCase()} ${code.slice(4)} `;

    expect(await polls.castVote(id, [a], alice, messy)).toEqual({ ok: true });
  });

  it("같은 브라우저라도 코드가 다르면 여러 표를 던지고, 내 선택은 마지막 표다", async () => {
    const id = await createCodePoll(3);
    const codes = await codesOf(id);
    const [a, b] = await optionIds(id);

    expect(await polls.castVote(id, [a], alice, codes[0].code)).toEqual({ ok: true });
    expect(await polls.castVote(id, [b], alice, codes[1].code)).toEqual({ ok: true });

    expect((await publicView(id, alice)).myChoices).toEqual([b]);
    const admin = await polls.getPollForAdmin(id);
    expect(admin?.codes).toEqual({ issued: 3, used: 2 });
    expect(admin?.ranking.summary.total).toBe(2);
  });

  it("코드 없는 투표는 여전히 브라우저당 한 표이고, 보낸 코드는 무시한다", async () => {
    const id = await createOpenPoll();
    const [a, b] = await optionIds(id);

    expect(await polls.castVote(id, [a], alice, "ABCDEFGH")).toEqual({ ok: true });
    expect(await polls.castVote(id, [b], alice, "HGFEDCBA")).toEqual({
      ok: false,
      reason: "already_voted",
    });
  });

  it("시작 전 코드 투표는 not_started다 (코드가 맞아도)", async () => {
    const created = await polls.createPoll({
      question: "q",
      options: ["a", "b"],
      opensAt: at(HOUR),
      deadline: at(DAY),
      codeCount: 1,
    });
    if (!created.ok) throw new Error("투표 생성 실패");
    const [{ code }] = await codesOf(created.id);

    expect(await polls.castVote(created.id, [(await optionIds(created.id))[0]], alice, code)).toEqual({
      ok: false,
      reason: "not_started",
    });
    expect((await codesOf(created.id))[0].used).toBe(false);
  });

  it("추가 발급은 총 500개까지다", async () => {
    const id = await createCodePoll(10);

    expect(await polls.issueCodes(id, 5)).toEqual({ ok: true, issued: 5 });
    expect((await polls.getPollForAdmin(id))?.codes).toEqual({ issued: 15, used: 0 });
    expect(await polls.issueCodes(id, 486)).toEqual({ ok: false, reason: "limit_exceeded" });
    expect(await polls.issueCodes(id, 485)).toEqual({ ok: true, issued: 485 });
    expect(await polls.issueCodes(id, 1)).toEqual({ ok: false, reason: "limit_exceeded" });
    expect(new Set((await codesOf(id)).map((row) => row.code)).size).toBe(500);
  });

  it("코드를 쓰지 않는 투표, 마감된 투표, 없는 투표에는 발급하지 않는다", async () => {
    const plain = await createOpenPoll();
    const closing = await createCodePoll(1);
    await polls.closePoll(closing);

    expect(await polls.issueCodes(plain, 1)).toEqual({ ok: false, reason: "codes_disabled" });
    expect(await polls.issueCodes(closing, 1)).toEqual({ ok: false, reason: "closed" });
    expect(await polls.issueCodes("nope000000", 1)).toEqual({ ok: false, reason: "not_found" });
  });

  it("코드 CSV는 BOM과 사람마다 쓸 개인 링크를 담는다", async () => {
    const id = await createCodePoll(2);

    const csv = await polls.codesCsv(id, BASE_URL);

    expect(csv?.startsWith("\uFEFF코드,사용 여부,개인 링크\r\n")).toBe(true);
    for (const { code, link } of await codesOf(id)) {
      expect(link).toBe(`${BASE_URL}/polls/${id}?code=${code}`);
    }
    expect(await polls.codesCsv("nope000000", BASE_URL)).toBeNull();
  });

  it("투표를 삭제하면 코드도 사라진다", async () => {
    const id = await createCodePoll(3);
    await polls.deletePoll(id);

    expect(await testSql`SELECT 1 FROM participation_codes`).toEqual([]);
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
    const { open } = await polls.listPollsForAdmin();
    expect(open.map((poll) => [poll.id, poll.total])).toEqual([[kept, 2]]);
  });

  it("없는 투표를 지워도 성공한다", async () => {
    const id = await createOpenPoll();
    await polls.deletePoll(id);

    expect(await polls.deletePoll(id)).toEqual({ ok: true });
  });
});

describe("listPollsForAdmin", () => {
  /** Makes a poll on another clock, so every state can exist at one moment. */
  async function pollOn(clock: Date, question: string, deadline: Date) {
    const result = await pollsAt(clock).createPoll({ question, options: ["a", "b"], deadline });
    if (!result.ok) throw new Error(`투표 생성 실패: ${JSON.stringify(result.errors)}`);
    return result.id;
  }

  it("진행 중 / 마감 / 보관으로 나누고, 진행 중은 마감 예정 시각이 가까운 순, 나머지는 마감 시각 최근순이다", async () => {
    // Archived by the time we look (마감 시각 + 30일 ≤ 32일째).
    const archivedEarly = await pollOn(T0, "보관 (1시간째 마감)", at(HOUR));
    const archivedLate = await pollOn(T0, "보관 (1일째 마감)", at(DAY));
    // Closed but still public.
    const closedByDeadline = await pollOn(at(25 * DAY), "마감 (31일째 기한)", at(31 * DAY));
    const closedByHand = await pollOn(at(25 * DAY), "마감 (30일째 직접)", at(40 * DAY));
    await pollsAt(at(30 * DAY)).closePoll(closedByHand);
    // Still open.
    const openLater = await pollOn(at(25 * DAY), "진행 중 (50일째)", at(50 * DAY));
    const openSooner = await pollOn(at(25 * DAY), "진행 중 (33일째)", at(33 * DAY));

    const { open, closed, archived } = await pollsAt(at(32 * DAY)).listPollsForAdmin();

    expect(open.map((poll) => [poll.id, poll.deadline])).toEqual([
      [openSooner, at(33 * DAY)],
      [openLater, at(50 * DAY)],
    ]);
    expect(closed.map((poll) => [poll.id, poll.closedAt])).toEqual([
      [closedByDeadline, at(31 * DAY)],
      [closedByHand, at(30 * DAY)],
    ]);
    expect(archived.map((poll) => [poll.id, poll.closedAt])).toEqual([
      [archivedLate, at(DAY)],
      [archivedEarly, at(HOUR)],
    ]);
  });

  it("각 항목은 총 표 수와 현재 1위를 담는다 (동점이면 여럿, 표가 없으면 없음)", async () => {
    const decided = await createOpenPoll("결정", ["a", "b"]);
    const tied = await createOpenPoll("동점", ["a", "b"]);
    const empty = await createOpenPoll("표 없음", ["a", "b"]);
    await castVotes(decided, [1, 2]);
    await castVotes(tied, [1, 1]);

    const { open } = await polls.listPollsForAdmin();
    const byId = new Map(open.map((poll) => [poll.id, poll]));

    expect(byId.get(decided)).toMatchObject({ question: "결정", total: 3 });
    expect(byId.get(decided)?.leaders.map((option) => option.label)).toEqual(["b"]);
    expect(byId.get(tied)?.leaders.map((option) => option.label)).toEqual(["a", "b"]);
    expect(byId.get(empty)).toMatchObject({ total: 0, leaders: [] });
  });

  it("마감 묶음과 보관 묶음의 항목도 총 표 수와 1위를 담고, 마감 묶음은 보관될 시각을 알려준다", async () => {
    // Looked at on day 32: closedOne closed on day 31 (still public), archivedOne
    // closed after 1 hour (archived since 30 days + 1 hour).
    const closedOne = await pollOn(at(25 * DAY), "마감", at(31 * DAY));
    const archivedOne = await createOpenPoll("보관", ["a", "b"], at(HOUR));
    await castVotes(closedOne, [0, 2], pollsAt(at(25 * DAY)));
    await castVotes(archivedOne, [1, 1]);

    const { closed, archived } = await pollsAt(at(32 * DAY)).listPollsForAdmin();

    expect(closed).toEqual([
      expect.objectContaining({
        id: closedOne,
        total: 2,
        leaders: [expect.objectContaining({ label: "b" })],
        closedAt: at(31 * DAY),
        archivesAt: at(61 * DAY),
      }),
    ]);
    expect(archived).toEqual([
      expect.objectContaining({
        id: archivedOne,
        total: 2,
        leaders: [expect.objectContaining({ label: "a" }), expect.objectContaining({ label: "b" })],
      }),
    ]);
  });

  it("마감 전에도 관리자 목록에는 득표 현황(총 표 수)이 있다", async () => {
    const id = await createOpenPoll("진행 중", ["a", "b"]);
    await castVotes(id, [2, 0]);

    const { open, closed, archived } = await polls.listPollsForAdmin();

    expect(open.map((poll) => [poll.id, poll.total])).toEqual([[id, 2]]);
    expect(closed).toEqual([]);
    expect(archived).toEqual([]);
  });
});

describe("createPoll", () => {
  it("만든 투표를 질문과 선택지 순서 그대로 조회할 수 있다", async () => {
    const id = await createOpenPoll("점심 뭐 먹지?", ["김밥", "라면", "돈가스"]);

    const poll = await publicView(id, null);

    expect(poll).toMatchObject({
      id,
      question: "점심 뭐 먹지?",
      status: "open",
      myChoices: [],
      usesCodes: false,
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
    expect(await polls.listPolls()).toEqual({ scheduled: [], open: [], closed: [] });
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

    const poll = await publicView(id, null);

    expect(poll?.status === "open" && poll.deadline).toEqual(at(3 * HOUR));
  });

  it("질문과 선택지의 앞뒤 공백을 제거해 저장한다", async () => {
    const id = await createOpenPoll("  점심?  ", [" 김밥", "라면  "]);

    const poll = await publicView(id, null);

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
    expect(await polls.listPolls()).toEqual({ scheduled: [], open: [], closed: [] });
  });

  it("경계값(질문 200자, 선택지 100자, 선택지 2개와 10개)은 받아들인다", async () => {
    const results = await Promise.all([
      polls.createPoll({ question: "가".repeat(200), options: ["가".repeat(100), "b"], deadline: at(DAY) }),
      polls.createPoll({ question: "q", options: Array.from({ length: 10 }, (_, i) => `${i}`), deadline: at(DAY) }),
    ]);
    expect(results.map((result) => result.ok)).toEqual([true, true]);
  });
});
