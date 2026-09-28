"use client";

import { useActionState } from "react";
import type { PollOption } from "@/lib/polls";
import { castVoteAction } from "./vote-actions";

export function VoteForm({ pollId, options }: { pollId: string; options: PollOption[] }) {
  const [state, formAction, pending] = useActionState(castVoteAction.bind(null, pollId), {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="sr-only">선택지</legend>
        {options.map((option) => (
          <label
            key={option.id}
            className="flex cursor-pointer items-center gap-3 rounded-md border border-zinc-200 px-4 py-3 has-[:checked]:border-zinc-900 has-[:checked]:bg-zinc-50 dark:border-zinc-800 dark:has-[:checked]:border-zinc-100 dark:has-[:checked]:bg-zinc-900"
          >
            <input type="radio" name="optionId" value={option.id} required />
            {option.label}
          </label>
        ))}
      </fieldset>
      {state.error && (
        <p aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <p className="text-sm text-zinc-500">
        한 번 투표하면 바꿀 수 없습니다. 결과는 마감 후에 공개됩니다.
      </p>
      <button
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "제출 중…" : "투표하기"}
      </button>
    </form>
  );
}
