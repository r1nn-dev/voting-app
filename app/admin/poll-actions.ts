"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { parseKstInput } from "@/lib/kst-time";
import { createPolls, type CreatePollErrors, type ExtendDeadlineFailure } from "@/lib/polls";
import { revalidatePollPages } from "../revalidate-polls";

export type CreatePollState = { errors?: CreatePollErrors };

export async function createPollAction(
  _prev: CreatePollState,
  formData: FormData,
): Promise<CreatePollState> {
  await requireAdmin();

  const result = await createPolls(getSql()).createPoll({
    question: String(formData.get("question") ?? ""),
    options: formData.getAll("option").map(String),
    deadline: parseKstInput(formData.get("deadline")),
  });
  if (!result.ok) return { errors: result.errors };

  revalidatePollPages();
  redirect("/admin");
}

export async function closePollAction(pollId: string): Promise<void> {
  await requireAdmin();

  // A poll deleted in another tab is already gone; nothing to report.
  await createPolls(getSql()).closePoll(pollId);

  revalidatePollPages(pollId);
}

export async function deletePollAction(pollId: string): Promise<void> {
  await requireAdmin();

  await createPolls(getSql()).deletePoll(pollId);

  revalidatePollPages(pollId);
}

/** From the admin detail page, whose poll no longer exists afterwards. */
export async function deletePollAndReturnToListAction(pollId: string): Promise<void> {
  await requireAdmin();

  await createPolls(getSql()).deletePoll(pollId);

  revalidatePollPages(pollId);
  redirect("/admin");
}

export type ExtendDeadlineState = { error?: string };

const EXTEND_FAILURE_MESSAGES: Record<ExtendDeadlineFailure, string> = {
  not_found: "투표가 없거나 삭제되었습니다.",
  closed: "이미 마감된 투표는 연장할 수 없습니다.",
  not_later: "현재 마감 예정 시각보다 늦은 시각만 고를 수 있습니다. 일찍 끝내려면 마감하세요.",
  out_of_range: "지금부터 30일 이내로만 연장할 수 있습니다.",
};

// pollId is a form field rather than a bound argument (see castVoteAction).
export async function extendDeadlineAction(
  _prev: ExtendDeadlineState,
  formData: FormData,
): Promise<ExtendDeadlineState> {
  await requireAdmin();

  const pollId = String(formData.get("pollId") ?? "");
  const deadline = parseKstInput(formData.get("deadline"));
  if (!deadline) return { error: "새 마감 예정 시각을 입력하세요." };

  const result = await createPolls(getSql()).extendDeadline(pollId, deadline);
  if (!result.ok) return { error: EXTEND_FAILURE_MESSAGES[result.reason] };

  revalidatePollPages(pollId);
  return {};
}
