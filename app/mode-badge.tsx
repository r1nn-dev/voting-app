import type { PollMode } from "@/lib/polls";

/** Marks a 복수 선택 poll with its 최대 선택 수; 단일 선택 shows nothing. */
export function ModeBadge({ mode, maxChoices }: { mode: PollMode; maxChoices: number }) {
  if (mode === "single") return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 ring-1 ring-inset ring-teal-600/20 dark:bg-teal-950/60 dark:text-teal-300 dark:ring-teal-400/20">
      복수 선택 · 최대 {maxChoices}개
    </span>
  );
}
