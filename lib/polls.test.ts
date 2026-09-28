import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testSql } from "@/tests/db";
import { createPolls } from "./polls";

const polls = createPolls(testSql);

beforeEach(async () => {
  await resetDatabase();
});

// Leave no test polls behind, in case the test database is also the dev one.
afterAll(async () => {
  await resetDatabase();
});

async function createOpenPoll(question = "점심 뭐 먹지?", options = ["김밥", "라면", "돈가스"]) {
  const result = await polls.createPoll({ question, options });
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

  async function closedResults(votesPerOption: number[]) {
    const id = await createOpenPoll("점심?", ["김밥", "라면", "돈가스"]);
    await castVotes(id, votesPerOption);
    await polls.closePoll(id);
    const poll = await polls.getPollForVoter(id, null);
    if (poll?.status !== "closed") throw new Error("마감되지 않음");
    return poll.results;
  }

  it("결과는 생성 순서대로 득표수, 소수점 첫째 자리 비율, 최다 득표를 담는다", async () => {
    const results = await closedResults([2, 1, 0]);

    expect(results.total).toBe(3);
    expect(results.options.map(({ label, votes, percent, isTop }) => [label, votes, percent, isTop]))
      .toEqual([
        ["김밥", 2, 66.7, true],
        ["라면", 1, 33.3, false],
        ["돈가스", 0, 0, false],
      ]);
  });

  it("동점이면 최다 득표 선택지를 모두 표시한다", async () => {
    const results = await closedResults([1, 0, 1]);

    expect(results.options.map((option) => [option.percent, option.isTop])).toEqual([
      [50, true],
      [0, false],
      [50, true],
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
    expect(results.options.map((option) => [option.votes, option.percent, option.isTop])).toEqual([
      [0, 0, false],
      [0, 0, false],
      [0, 0, false],
    ]);
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
    const result = await polls.createPoll(input);

    expect(result).toEqual({ ok: false, errors: expect.objectContaining(errors) });
    expect(await polls.listPolls()).toEqual([]);
  });

  it("경계값(질문 200자, 선택지 100자, 선택지 2개와 10개)은 받아들인다", async () => {
    const results = await Promise.all([
      polls.createPoll({ question: "가".repeat(200), options: ["가".repeat(100), "b"] }),
      polls.createPoll({ question: "q", options: Array.from({ length: 10 }, (_, i) => `${i}`) }),
    ]);
    expect(results.map((result) => result.ok)).toEqual([true, true]);
  });
});
