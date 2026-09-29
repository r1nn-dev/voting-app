"use server";

import { getSql } from "@/lib/db";
import { createPolls, type CastVoteFailure } from "@/lib/polls";
import { getOrIssueVoterId } from "@/lib/voter-session";
import { revalidatePollPages } from "../../revalidate-polls";

export type VoteState = { error?: string };

const FAILURE_MESSAGES: Record<CastVoteFailure, string> = {
  not_found: "투표가 없거나 삭제되었습니다.",
  closed: "이미 마감된 투표입니다. 표가 반영되지 않았습니다.",
  already_voted: "이미 이 투표에 표를 던졌습니다.",
  invalid_option: "올바른 선택지를 골라 주세요.",
};

// The poll id travels as a form field, not a bound argument: an action bound
// in a client component hangs when the form is submitted without JavaScript.
export async function castVoteAction(_prev: VoteState, formData: FormData): Promise<VoteState> {
  const pollId = String(formData.get("pollId") ?? "");
  const optionId = formData.get("optionId");
  if (typeof optionId !== "string" || !optionId) {
    return { error: "선택지를 하나 골라 주세요." };
  }

  const result = await createPolls(getSql()).castVote(
    pollId,
    optionId,
    await getOrIssueVoterId(),
  );
  // On failure, keep the page as is: re-rendering it (e.g. as closed or 404)
  // would unmount the form and hide the message saying the vote did not count.
  if (!result.ok) return { error: FAILURE_MESSAGES[result.reason] };

  revalidatePollPages(pollId);
  return {};
}
