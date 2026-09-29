"use client";

import { useActionState } from "react";
import { POLL_LIMITS } from "@/lib/poll-limits";
import { buttonPrimary, fieldError, hint, input, label } from "../../../ui";
import { rescheduleAction } from "../../poll-actions";

/** Change a 시작 전 poll's 시작·마감 예정 시각 (KST). Remount it (key by the times) after success. */
export function RescheduleForm({
  pollId,
  opensAt,
  deadline,
}: {
  pollId: string;
  /** datetime-local values in KST. */
  opensAt: string;
  deadline: string;
}) {
  const [state, formAction, pending] = useActionState(rescheduleAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="pollId" value={pollId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={label}>시작 예정 시각</span>
          <input name="opensAt" type="datetime-local" defaultValue={opensAt} required className={input} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>마감 예정 시각</span>
          <input name="deadline" type="datetime-local" defaultValue={deadline} required className={input} />
        </label>
      </div>
      <p className={hint}>
        아직 표가 없어서 앞당기거나 미룰 수 있습니다. 마감 예정 시각은 시작 예정 시각부터{" "}
        {POLL_LIMITS.deadlineMinMinutes}분 뒤 ~ {POLL_LIMITS.deadlineMaxDays}일 뒤여야 합니다.
      </p>
      {state.error && (
        <p aria-live="polite" className={fieldError}>
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`${buttonPrimary} self-start`}>
        {pending ? "바꾸는 중…" : "시각 바꾸기"}
      </button>
    </form>
  );
}
