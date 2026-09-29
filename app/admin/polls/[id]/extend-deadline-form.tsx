"use client";

import { useActionState, useState } from "react";
import { formatKst, parseKstInput, toKstInputValue } from "@/lib/kst-time";
import { extendDeadlineAction } from "../../poll-actions";

const HOUR = 60 * 60 * 1000;
const QUICK_EXTENSIONS = [
  { label: "+1시간", ms: HOUR },
  { label: "+1일", ms: 24 * HOUR },
  { label: "+1주", ms: 7 * 24 * HOUR },
];

/**
 * Remount it (key it by the deadline) after a successful extension so the
 * input starts from the new deadline.
 */
export function ExtendDeadlineForm({ pollId, deadline }: { pollId: string; deadline: string }) {
  const current = new Date(deadline);
  const [state, formAction, pending] = useActionState(extendDeadlineAction, {});
  const [value, setValue] = useState(() => toKstInputValue(current));
  const [confirming, setConfirming] = useState(false);
  const chosen = parseKstInput(value);

  return (
    <form
      action={formAction}
      // Enter in the date input submits implicitly; route it through the confirm step.
      onSubmit={(event) => {
        if (!confirming) {
          event.preventDefault();
          if (chosen) setConfirming(true);
        }
      }}
      className="flex flex-col gap-3"
    >
      <input type="hidden" name="pollId" value={pollId} />
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="deadline" className="sr-only">
          새 마감 예정 시각
        </label>
        <input
          id="deadline"
          name="deadline"
          type="datetime-local"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setConfirming(false);
          }}
          required
          className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {QUICK_EXTENSIONS.map(({ label, ms }) => (
          <button
            key={label}
            type="button"
            // Relative to the current deadline, so "+1일" is exactly one more day.
            onClick={() => {
              setValue(toKstInputValue(new Date(current.getTime() + ms)));
              setConfirming(false);
            }}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {label}
          </button>
        ))}
      </div>

      {confirming && chosen ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-zinc-600 dark:text-zinc-400">
            {formatKst(chosen)}(으)로 연장할까요?
          </span>
          <button
            disabled={pending}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {pending ? "연장 중…" : "연장"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className="rounded-md px-3 py-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            취소
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!chosen}
          onClick={() => setConfirming(true)}
          className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          연장하기
        </button>
      )}

      {state.error && (
        <p aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
