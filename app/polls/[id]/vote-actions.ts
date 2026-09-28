"use server";

import { revalidatePath } from "next/cache";
import { getSql } from "@/lib/db";
import { createPolls, type CastVoteFailure } from "@/lib/polls";
import { getOrIssueVoterId } from "@/lib/voter-session";

export type VoteState = { error?: string };

const FAILURE_MESSAGES: Record<CastVoteFailure, string> = {
  not_found: "투표가 없거나 삭제되었습니다.",
  closed: "이미 마감된 투표입니다. 표가 반영되지 않았습니다.",
  already_voted: "이미 이 투표에 참여했습니다.",
  invalid_option: "올바른 선택지를 골라 주세요.",
};

export async function castVoteAction(
  pollId: string,
  _prev: VoteState,
  formData: FormData,
): Promise<VoteState> {
  const optionId = formData.get("optionId");
  if (typeof optionId !== "string" || !optionId) {
    return { error: "선택지를 하나 골라 주세요." };
  }

  const result = await createPolls(getSql()).castVote(
    pollId,
    optionId,
    await getOrIssueVoterId(),
  );

  revalidatePath(`/polls/${pollId}`);
  revalidatePath("/admin");
  return result.ok ? {} : { error: FAILURE_MESSAGES[result.reason] };
}
