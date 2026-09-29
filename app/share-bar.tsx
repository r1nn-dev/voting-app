import type { ShareResults } from "@/lib/polls";

// Up to 10 options, one color each, readable on light and dark backgrounds.
const PALETTE = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#9333ea",
  "#db2777",
  "#0891b2",
  "#ca8a04",
  "#4f46e5",
  "#dc2626",
  "#64748b",
];

/** Segments narrower than this skip their inline label; the legend always has it. */
const MIN_LABELED_PERCENT = 12;

/** 결과 as a single 100% stacked bar plus a legend, largest share first. */
export function ShareBar({ results }: { results: ShareResults }) {
  // Rounded percents can sum to 99.9; the last visible segment absorbs the gap.
  const lastVisible = results.options.findLastIndex((option) => option.votes > 0);
  const summary = results.options
    .map((option) => `${option.label} ${option.percent.toFixed(1)}%`)
    .join(", ");

  return (
    <div className="flex flex-col gap-4">
      <div
        role="img"
        aria-label={`결과 비중: ${summary}`}
        className="flex h-10 w-full overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-800"
      >
        {results.options.map((option, index) =>
          option.votes === 0 ? null : (
            <div
              key={option.id}
              className={`flex items-center justify-center overflow-hidden text-xs font-medium text-white ${
                index === lastVisible ? "grow" : ""
              }`}
              style={{ width: `${option.percent}%`, backgroundColor: PALETTE[index] }}
            >
              {option.percent >= MIN_LABELED_PERCENT && `${option.percent.toFixed(1)}%`}
            </div>
          ),
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {results.options.map((option, index) => (
          <li key={option.id} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-sm"
                style={{ backgroundColor: PALETTE[index] }}
              />
              <span className={`truncate ${option.isTop ? "font-semibold" : ""}`}>
                {option.label}
              </span>
              {option.isTop && (
                <span className="shrink-0 rounded bg-emerald-100 px-1.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  1위
                </span>
              )}
              {option.isMine && <span className="shrink-0 text-xs text-zinc-500">내 선택</span>}
            </span>
            <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
              {option.percent.toFixed(1)}% · {option.votes}표
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
