"use client";

import { useActionState } from "react";
import { buttonSecondary, fieldError, input } from "../../../ui";
import { issueCodesAction } from "../../poll-actions";

/** Issues more 참여 코드; `remaining` is how many the 500 limit still allows. */
export function IssueCodesForm({ pollId, remaining }: { pollId: string; remaining: number }) {
  const [state, formAction, pending] = useActionState(issueCodesAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="pollId" value={pollId} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            name="count"
            type="number"
            min={1}
            max={remaining}
            defaultValue={Math.min(10, remaining)}
            required
            aria-label="추가로 발급할 코드 수"
            className={`${input} w-24`}
          />
          개
        </label>
        <button disabled={pending} className={buttonSecondary}>
          {pending ? "발급 중…" : "추가 발급"}
        </button>
      </div>
      {state.error && (
        <p aria-live="polite" className={fieldError}>
          {state.error}
        </p>
      )}
      {state.issued !== undefined && (
        <p aria-live="polite" className="text-sm text-emerald-700 dark:text-emerald-400">
          코드 {state.issued}개를 발급했습니다.
        </p>
      )}
    </form>
  );
}
