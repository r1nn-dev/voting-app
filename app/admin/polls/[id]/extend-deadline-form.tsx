"use client";

import { useActionState, useState } from "react";
import { formatKst, parseKstInput, toKstInputValue } from "@/lib/kst-time";
import { buttonGhost, buttonPrimary, buttonSecondary, fieldError, input } from "../../../ui";
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
          className={`${input} w-auto`}
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
            className={`${buttonSecondary} rounded-full`}
          >
            {label}
          </button>
        ))}
      </div>

      {confirming && chosen ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-sm dark:bg-indigo-950/40">
          <span className="text-zinc-700 dark:text-zinc-300">
            <strong>{formatKst(chosen)}</strong>(으)로 연장할까요?
          </span>
          <button disabled={pending} className={`${buttonPrimary} py-1.5`}>
            {pending ? "연장 중…" : "연장"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirming(false)}
            className={`${buttonGhost} py-1.5`}
          >
            취소
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={!chosen}
          onClick={() => setConfirming(true)}
          className={`${buttonPrimary} self-start`}
        >
          연장하기
        </button>
      )}

      {state.error && (
        <p aria-live="polite" className={fieldError}>
          {state.error}
        </p>
      )}
    </form>
  );
}
