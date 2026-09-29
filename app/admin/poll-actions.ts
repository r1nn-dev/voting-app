"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { parseKstInput } from "@/lib/kst-time";
import { POLL_LIMITS } from "@/lib/poll-limits";
import {
  createPolls,
  type CreatePollErrors,
  type ExtendDeadlineFailure,
  type IssueCodesFailure,
  type RescheduleFailure,
} from "@/lib/polls";
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
    // "바로 시작" sends no time; an unreadable 예약 time fails validation instead of starting now.
    opensAt:
      formData.get("startMode") === "later"
        ? (parseKstInput(formData.get("opensAt")) ?? new Date(Number.NaN))
        : null,
    listed: formData.get("listed") !== "false",
    mode: formData.get("mode") === "multiple" ? "multiple" : "single",
    // Empty means every option; only 복수 선택 sends the field.
    maxChoices:
      formData.get("mode") === "multiple" && formData.get("maxChoices")
        ? Number(formData.get("maxChoices"))
        : null,
    // Unchecked sends nothing; a checked box with no usable count fails validation.
    codeCount: formData.get("usesCodes") === "on" ? Number(formData.get("codeCount") || Number.NaN) : 0,
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

/** 목록 공개 ↔ 링크 전용. pollId and the new value are form fields (see castVoteAction). */
export async function setListedAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const pollId = String(formData.get("pollId") ?? "");
  await createPolls(getSql()).setListed(pollId, formData.get("listed") === "true");

  revalidatePollPages(pollId);
}

export type RescheduleState = { error?: string };

const RESCHEDULE_FAILURE_MESSAGES: Record<RescheduleFailure, string> = {
  not_found: "투표가 없거나 삭제되었습니다.",
  started: "이미 시작한 투표는 시작 예정 시각을 바꿀 수 없습니다.",
  out_of_range: `시작은 지금부터 ${POLL_LIMITS.deadlineMaxDays}일 이내, 마감은 시작부터 ${POLL_LIMITS.deadlineMinMinutes}분 뒤 ~ ${POLL_LIMITS.deadlineMaxDays}일 뒤여야 합니다.`,
};

/** Moves a 시작 전 poll's times. pollId is a form field (see castVoteAction). */
export async function rescheduleAction(
  _prev: RescheduleState,
  formData: FormData,
): Promise<RescheduleState> {
  await requireAdmin();

  const pollId = String(formData.get("pollId") ?? "");
  const opensAt = parseKstInput(formData.get("opensAt"));
  const deadline = parseKstInput(formData.get("deadline"));
  if (!opensAt || !deadline) return { error: "시작·마감 예정 시각을 모두 입력하세요." };

  const result = await createPolls(getSql()).reschedule(pollId, { opensAt, deadline });
  if (!result.ok) return { error: RESCHEDULE_FAILURE_MESSAGES[result.reason] };

  revalidatePollPages(pollId);
  return {};
}

export type IssueCodesState = { error?: string; issued?: number };

const ISSUE_CODES_FAILURE_MESSAGES: Record<IssueCodesFailure, string> = {
  not_found: "투표가 없거나 삭제되었습니다.",
  codes_disabled: "참여 코드를 쓰지 않는 투표입니다.",
  closed: "마감된 투표에는 코드를 발급할 수 없습니다.",
  limit_exceeded: `코드는 한 투표에 모두 ${POLL_LIMITS.maxCodes}개까지 발급할 수 있습니다.`,
};

/** More 참여 코드 for a 시작 전 or 진행 중 poll. pollId is a form field (see castVoteAction). */
export async function issueCodesAction(
  _prev: IssueCodesState,
  formData: FormData,
): Promise<IssueCodesState> {
  await requireAdmin();

  const pollId = String(formData.get("pollId") ?? "");
  const count = Number(formData.get("count"));
  if (!Number.isInteger(count) || count < 1) return { error: "발급할 개수를 1 이상으로 입력하세요." };

  const result = await createPolls(getSql()).issueCodes(pollId, count);
  if (!result.ok) return { error: ISSUE_CODES_FAILURE_MESSAGES[result.reason] };

  revalidatePollPages(pollId);
  return { issued: result.issued };
}

const START_NOW_FAILURE_MESSAGES: Record<RescheduleFailure, string> = {
  not_found: "투표가 없거나 삭제되었습니다.",
  started: "이미 시작한 투표입니다.",
  out_of_range: `마감 예정 시각이 지금부터 ${POLL_LIMITS.deadlineMaxDays}일을 넘어 바로 시작할 수 없습니다. 먼저 시각을 바꾸세요.`,
};

/** "지금 바로 시작" for a 시작 전 poll. pollId is a form field (see castVoteAction). */
export async function startNowAction(_prev: RescheduleState, formData: FormData): Promise<RescheduleState> {
  await requireAdmin();

  const pollId = String(formData.get("pollId") ?? "");
  const result = await createPolls(getSql()).startNow(pollId);
  if (!result.ok) return { error: START_NOW_FAILURE_MESSAGES[result.reason] };

  revalidatePollPages(pollId);
  return {};
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
  not_started: "시작 전인 투표는 연장 대신 시작·마감 예정 시각을 바꾸세요.",
  closed: "이미 마감된 투표는 연장할 수 없습니다.",
  not_later: "현재 마감 예정 시각보다 늦은 시각만 고를 수 있습니다. 일찍 끝내려면 마감하세요.",
  out_of_range: `지금부터 ${POLL_LIMITS.deadlineMaxDays}일 이내로만 연장할 수 있습니다.`,
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
