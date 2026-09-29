"use client";

import { useActionState, useState } from "react";
import { kstInputFromNow } from "@/lib/kst-time";
import { POLL_LIMITS } from "@/lib/poll-limits";
import { createPollAction } from "../poll-actions";

const inputClass =
  "w-full rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

let nextKey = 0;
const newOption = () => ({ key: nextKey++, value: "" });

const HOUR = 60 * 60 * 1000;
const QUICK_DEADLINES = [
  { label: "1시간", ms: HOUR },
  { label: "1일", ms: 24 * HOUR },
  { label: "1주", ms: 7 * 24 * HOUR },
];

/** `initialDeadline` comes from the server so the first render matches on both sides. */
export function NewPollForm({ initialDeadline }: { initialDeadline: string }) {
  const [state, formAction, pending] = useActionState(createPollAction, {});
  // Controlled inputs keep what the admin typed when validation fails.
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(() => [newOption(), newOption()]);
  const [deadline, setDeadline] = useState(initialDeadline);
  const errors = state.errors;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="question" className="font-medium">
          질문
        </label>
        <input
          id="question"
          name="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={POLL_LIMITS.questionMaxLength}
          required
          className={inputClass}
        />
        {errors?.question && <p className="text-sm text-red-600">{errors.question}</p>}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="deadline" className="font-medium">
          마감 예정 시각 <span className="text-sm font-normal text-zinc-500">(한국 시간)</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="deadline"
            name="deadline"
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            required
            className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          {QUICK_DEADLINES.map(({ label, ms }) => (
            <button
              key={label}
              type="button"
              onClick={() => setDeadline(kstInputFromNow(ms))}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-zinc-500">
          지금부터 {POLL_LIMITS.deadlineMinMinutes}분 뒤 ~ {POLL_LIMITS.deadlineMaxDays}일 뒤.
          시각이 지나면 자동으로 마감됩니다.
        </p>
        {errors?.deadline && <p className="text-sm text-red-600">{errors.deadline}</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 font-medium">
          선택지 ({POLL_LIMITS.minOptions}~{POLL_LIMITS.maxOptions}개)
        </legend>
        {options.map((option, index) => (
          <div key={option.key} className="flex flex-col gap-1">
            <div className="flex gap-2">
              <input
                name="option"
                aria-label={`선택지 ${index + 1}`}
                value={option.value}
                onChange={(event) =>
                  setOptions((current) =>
                    current.map((o) =>
                      o.key === option.key ? { ...o, value: event.target.value } : o,
                    ),
                  )
                }
                maxLength={POLL_LIMITS.optionMaxLength}
                required
                className={inputClass}
              />
              <button
                type="button"
                onClick={() =>
                  setOptions((current) => current.filter((o) => o.key !== option.key))
                }
                disabled={options.length <= POLL_LIMITS.minOptions}
                className="shrink-0 rounded-md px-3 text-sm text-zinc-500 hover:bg-zinc-100 disabled:opacity-30 dark:hover:bg-zinc-800"
              >
                삭제
              </button>
            </div>
            {errors?.optionErrors?.[index] && (
              <p className="text-sm text-red-600">{errors.optionErrors[index]}</p>
            )}
          </div>
        ))}
        {errors?.options && <p className="text-sm text-red-600">{errors.options}</p>}
        <button
          type="button"
          onClick={() => setOptions((current) => [...current, newOption()])}
          disabled={options.length >= POLL_LIMITS.maxOptions}
          className="self-start text-sm text-zinc-600 hover:underline disabled:opacity-30 dark:text-zinc-400"
        >
          + 선택지 추가
        </button>
      </fieldset>

      <button
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "만드는 중…" : "투표 만들기"}
      </button>
    </form>
  );
}
