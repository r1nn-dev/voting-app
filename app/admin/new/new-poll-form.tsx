"use client";

import { useActionState, useState } from "react";
import { kstInputFromNow } from "@/lib/kst-time";
import { POLL_LIMITS } from "@/lib/poll-limits";
import type { PollTemplate } from "@/lib/polls";
import { PlusIcon, XIcon } from "../../icons";
import {
  buttonPrimary,
  buttonSecondary,
  card,
  cardPadding,
  fieldError,
  hint,
  input as inputClass,
  label,
} from "../../ui";
import { createPollAction } from "../poll-actions";

let nextKey = 0;
const newOption = (value = "") => ({ key: nextKey++, value });

const HOUR = 60 * 60 * 1000;
const QUICK_DEADLINES = [
  { label: "1시간", ms: HOUR },
  { label: "1일", ms: 24 * HOUR },
  { label: "1주", ms: 7 * 24 * HOUR },
];

/**
 * `initialDeadline` comes from the server so the first render matches on both
 * sides. `template` pre-fills the form when duplicating a poll (복제).
 */
export function NewPollForm({
  initialDeadline,
  initialOpensAt,
  template = null,
}: {
  initialDeadline: string;
  /** Pre-filled 예약 time (KST), used only when the admin picks 예약. */
  initialOpensAt: string;
  template?: PollTemplate | null;
}) {
  const [state, formAction, pending] = useActionState(createPollAction, {});
  // Controlled inputs keep what the admin typed when validation fails.
  const [question, setQuestion] = useState(template?.question ?? "");
  const [options, setOptions] = useState(() =>
    template ? template.options.map((label) => newOption(label)) : [newOption(), newOption()],
  );
  const [deadline, setDeadline] = useState(initialDeadline);
  const [listed, setListed] = useState(template && !template.listed ? "false" : "true");
  const [startMode, setStartMode] = useState<"now" | "later">("now");
  const [usesCodes, setUsesCodes] = useState(template?.usesCodes ?? false);
  const [opensAt, setOpensAt] = useState(initialOpensAt);
  const errors = state.errors;

  return (
    <form action={formAction} className={`${card} ${cardPadding} flex flex-col gap-7`}>
      <div className="flex flex-col gap-2">
        <label htmlFor="question" className={label}>
          질문
        </label>
        <input
          id="question"
          name="question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={POLL_LIMITS.questionMaxLength}
          required
          placeholder="예: 다음 모임은 언제가 좋을까요?"
          className={`${inputClass} text-base`}
        />
        {errors?.question && <p className={fieldError}>{errors.question}</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${label} mb-2`}>
          시작 <span className="font-normal text-zinc-500">(한국 시간)</span>
        </legend>
        <div className="flex flex-wrap items-center gap-4">
          {(
            [
              ["now", "바로 시작"],
              ["later", "예약"],
            ] as const
          ).map(([value, text]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="radio"
                name="startMode"
                value={value}
                checked={startMode === value}
                onChange={() => setStartMode(value)}
                className="accent-indigo-600"
              />
              {text}
            </label>
          ))}
          {startMode === "later" && (
            <input
              name="opensAt"
              type="datetime-local"
              aria-label="시작 예정 시각"
              value={opensAt}
              onChange={(event) => setOpensAt(event.target.value)}
              required
              className={`${inputClass} w-auto`}
            />
          )}
        </div>
        {startMode === "later" && (
          <p className={hint}>
            지금부터 {POLL_LIMITS.deadlineMaxDays}일 이내. 그 전까지는 질문과 선택지만 보이고 표를 받지
            않습니다.
          </p>
        )}
        {errors?.opensAt && <p className={fieldError}>{errors.opensAt}</p>}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="deadline" className={label}>
          마감 예정 시각 <span className="font-normal text-zinc-500">(한국 시간)</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            id="deadline"
            name="deadline"
            type="datetime-local"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            required
            className={`${inputClass} w-auto`}
          />
          {QUICK_DEADLINES.map(({ label, ms }) => (
            <button
              key={label}
              type="button"
              onClick={() => setDeadline(kstInputFromNow(ms))}
              className={`${buttonSecondary} rounded-full`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className={hint}>
          시작부터 {POLL_LIMITS.deadlineMinMinutes}분 뒤 ~ {POLL_LIMITS.deadlineMaxDays}일 뒤.
          시각이 지나면 자동으로 마감됩니다.
        </p>
        {errors?.deadline && <p className={fieldError}>{errors.deadline}</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${label} mb-2`}>공개 방식</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: "true", title: "목록 공개", body: "메인 목록에 나오고 누구나 들어올 수 있습니다." },
            {
              value: "false",
              title: "링크 전용",
              body: "목록에 나오지 않고, 링크를 가진 사람만 들어옵니다.",
            },
          ].map((choice) => (
            <label
              key={choice.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 px-4 py-3 transition has-checked:border-indigo-500 has-checked:bg-indigo-50/60 dark:border-zinc-700 dark:has-checked:border-indigo-400 dark:has-checked:bg-indigo-950/40"
            >
              <input
                type="radio"
                name="listed"
                value={choice.value}
                checked={listed === choice.value}
                onChange={() => setListed(choice.value)}
                className="mt-1 accent-indigo-600"
              />
              <span>
                <span className="block text-sm font-semibold">{choice.title}</span>
                <span className={`${hint} block`}>{choice.body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${label} mb-2`}>참여 코드</legend>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="usesCodes"
              checked={usesCodes}
              onChange={(event) => setUsesCodes(event.target.checked)}
              className="accent-indigo-600"
            />
            참여 코드 사용
          </label>
          {usesCodes && (
            <label className="flex items-center gap-2 text-sm">
              <input
                name="codeCount"
                type="number"
                min={1}
                max={POLL_LIMITS.maxCodes}
                defaultValue={30}
                required
                aria-label="발급할 코드 수"
                className={`${inputClass} w-24`}
              />
              개 발급
            </label>
          )}
        </div>
        <p className={hint}>
          {usesCodes
            ? `1회용 코드를 한 사람에게 하나씩 나눠 주세요. 코드 하나로 한 번만 투표할 수 있고, 나중에 추가로 발급할 수 있습니다(모두 ${POLL_LIMITS.maxCodes}개까지).`
            : "끄면 지금처럼 브라우저마다 한 표입니다."}
        </p>
        {errors?.codeCount && <p className={fieldError}>{errors.codeCount}</p>}
      </fieldset>

      <fieldset className="flex flex-col gap-2.5">
        <legend className={`${label} mb-2`}>
          선택지{" "}
          <span className="font-normal text-zinc-500">
            ({POLL_LIMITS.minOptions}~{POLL_LIMITS.maxOptions}개)
          </span>
        </legend>
        {options.map((option, index) => (
          <div key={option.key} className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {index + 1}
              </span>
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
                placeholder={`선택지 ${index + 1}`}
                className={inputClass}
              />
              <button
                type="button"
                onClick={() =>
                  setOptions((current) => current.filter((o) => o.key !== option.key))
                }
                disabled={options.length <= POLL_LIMITS.minOptions}
                aria-label={`선택지 ${index + 1} 삭제`}
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-30 dark:hover:bg-red-950/40"
              >
                <XIcon className="size-4" />
              </button>
            </div>
            {errors?.optionErrors?.[index] && (
              <p className={`${fieldError} pl-9`}>{errors.optionErrors[index]}</p>
            )}
          </div>
        ))}
        {errors?.options && <p className={fieldError}>{errors.options}</p>}
        <button
          type="button"
          onClick={() => setOptions((current) => [...current, newOption()])}
          disabled={options.length >= POLL_LIMITS.maxOptions}
          className="ml-9 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-zinc-300 py-2.5 text-sm font-medium text-zinc-500 transition hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-700 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-indigo-950/30 dark:hover:text-indigo-300"
        >
          <PlusIcon className="size-4" />
          선택지 추가
        </button>
      </fieldset>

      <button disabled={pending} className={`${buttonPrimary} w-full py-3 text-base`}>
        {pending ? "만드는 중…" : "투표 만들기"}
      </button>
    </form>
  );
}
