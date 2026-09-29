"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import type { PollMode, PollOption } from "@/lib/polls";
import { CheckIcon } from "../../icons";
import { buttonPrimary, fieldError, hint, input, label } from "../../ui";
import { castVoteAction } from "./vote-actions";

export function VoteForm({
  pollId,
  options,
  usesCodes,
  initialCode = "",
  mode,
  maxChoices,
}: {
  pollId: string;
  options: PollOption[];
  mode: PollMode;
  /** 복수 선택's 최대 선택 수; 1 for 단일 선택. */
  maxChoices: number;
  /** 참여 코드 poll: the form asks for a code. */
  usesCodes: boolean;
  /** From a personal link (?code=). */
  initialCode?: string;
}) {
  const [state, formAction, pending] = useActionState(castVoteAction, {});
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set());
  // Without JavaScript the button must stay usable; the server rejects zero choices.
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
  const toggle = (id: string) =>
    setChecked((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="pollId" value={pollId} />
      {mode === "multiple" ? (
        <fieldset className="grid gap-2.5 sm:grid-cols-2">
          <legend className="mb-3 flex w-full flex-wrap items-baseline justify-between gap-2">
            <span className="font-semibold">여러 개를 골라도 됩니다</span>
            <span aria-live="polite" className="text-sm tabular-nums text-zinc-500 dark:text-zinc-400">
              최대 {maxChoices}개 · 지금 {checked.size}개 선택
            </span>
          </legend>
          {options.map((option) => {
            const isChecked = checked.has(option.id);
            const full = !isChecked && checked.size >= maxChoices;
            return (
              <label
                key={option.id}
                className={`group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3.5 transition has-checked:border-indigo-500 has-checked:bg-indigo-50/60 has-checked:ring-2 has-checked:ring-indigo-500/20 has-focus-visible:ring-2 has-focus-visible:ring-indigo-500/40 dark:border-zinc-700 dark:bg-zinc-950 dark:has-checked:border-indigo-400 dark:has-checked:bg-indigo-950/40 ${
                  full
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:border-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                }`}
              >
                <input
                  type="checkbox"
                  name="optionId"
                  value={option.id}
                  checked={isChecked}
                  disabled={full}
                  onChange={() => toggle(option.id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className="flex size-5 shrink-0 items-center justify-center rounded-md border-2 border-zinc-300 text-white transition peer-checked:border-indigo-600 peer-checked:bg-indigo-600 dark:border-zinc-600 dark:peer-checked:border-indigo-400 dark:peer-checked:bg-indigo-400"
                >
                  <CheckIcon className="size-3.5 scale-0 transition group-has-checked:scale-100" />
                </span>
                <span className="font-medium">{option.label}</span>
              </label>
            );
          })}
        </fieldset>
      ) : (
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
      )}

      {usesCodes && (
        <label className="flex flex-col gap-1.5">
          <span className={label}>참여 코드</span>
          <input
            name="code"
            defaultValue={initialCode}
            required
            maxLength={20}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="받은 코드 8자리"
            className={`${input} font-mono uppercase tracking-widest`}
          />
        </label>
      )}

      {state.error && (
        <p aria-live="polite" className={`${fieldError} rounded-lg bg-red-50 px-3 py-2 dark:bg-red-950/40`}>
          {state.error}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <button
          disabled={pending || (hydrated && mode === "multiple" && checked.size === 0)}
          className={`${buttonPrimary} w-full py-3 text-base`}
        >
          {pending ? "제출 중…" : "투표하기"}
        </button>
        <p className={`${hint} text-center`}>
          {usesCodes
            ? "코드 하나로 한 번 투표할 수 있고, 바꿀 수 없습니다. 결과는 마감 후에 공개됩니다."
            : "한 번 투표하면 바꿀 수 없습니다. 결과는 마감 후에 공개됩니다."}
        </p>
      </div>
    </form>
  );
}

const noSubscribe = () => () => {};
