"use client";

import { useActionState } from "react";
import type { PollOption } from "@/lib/polls";
import { buttonPrimary, fieldError, hint } from "../../ui";
import { castVoteAction } from "./vote-actions";

export function VoteForm({ pollId, options }: { pollId: string; options: PollOption[] }) {
  const [state, formAction, pending] = useActionState(castVoteAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="pollId" value={pollId} />
      <fieldset className="grid gap-2.5 sm:grid-cols-2">
        <legend className="mb-3 font-semibold">하나를 골라 주세요</legend>
        {options.map((option) => (
          // The real radio stays in the DOM for keyboard and screen readers;
          // the card mirrors its checked and focus state.
          <label
            key={option.id}
            className="group flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 transition hover:border-zinc-300 hover:bg-zinc-50 has-checked:border-indigo-500 has-checked:bg-indigo-50/60 has-checked:ring-2 has-checked:ring-indigo-500/20 has-focus-visible:ring-2 has-focus-visible:ring-indigo-500/40 dark:border-zinc-700 dark:bg-zinc-950 dark:hover:bg-zinc-900 dark:has-checked:border-indigo-400 dark:has-checked:bg-indigo-950/40"
          >
            <input type="radio" name="optionId" value={option.id} required className="peer sr-only" />
            <span
              aria-hidden
              className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-zinc-300 transition peer-checked:border-indigo-600 dark:border-zinc-600 dark:peer-checked:border-indigo-400"
            >
              <span className="size-2.5 scale-0 rounded-full bg-indigo-600 transition group-has-checked:scale-100 dark:bg-indigo-400" />
            </span>
            <span className="font-medium">{option.label}</span>
          </label>
        ))}
      </fieldset>

      {state.error && (
        <p aria-live="polite" className={`${fieldError} rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40`}>
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button disabled={pending} className={`${buttonPrimary} w-full py-3 text-base`}>
          {pending ? "제출 중…" : "투표하기"}
        </button>
        <p className={`${hint} text-center`}>
          한 번 투표하면 바꿀 수 없습니다. 결과는 마감 후에 공개됩니다.
        </p>
      </div>
    </form>
  );
}
