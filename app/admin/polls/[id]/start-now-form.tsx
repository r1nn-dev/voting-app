"use client";

import { useActionState } from "react";
import { buttonSecondary, fieldError } from "../../../ui";
import { startNowAction } from "../../poll-actions";

/** "지금 바로 시작" for a 시작 전 poll, with the reason when it cannot start. */
export function StartNowForm({ pollId }: { pollId: string }) {
  const [state, formAction, pending] = useActionState(startNowAction, {});

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <input type="hidden" name="pollId" value={pollId} />
      <button disabled={pending} className={buttonSecondary}>
        {pending ? "시작하는 중…" : "지금 바로 시작"}
      </button>
      {state.error && (
        <p aria-live="polite" className={`${fieldError} max-w-xs text-right`}>
          {state.error}
        </p>
      )}
    </form>
  );
}
