import type { ShareResults } from "@/lib/polls";

// One color per option, picked by its creation position (up to 10). Each has
// at least 4.5:1 contrast with the white segment labels (WCAG AA).
const OPTION_COLORS = [
  "#1d4ed8",
  "#15803d",
  "#c2410c",
  "#7e22ce",
  "#be185d",
  "#0e7490",
  "#a16207",
  "#4338ca",
  "#b91c1c",
  "#475569",
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
              style={{ width: `${option.percent}%`, backgroundColor: OPTION_COLORS[option.position] }}
            >
              {option.percent >= MIN_LABELED_PERCENT && `${option.percent.toFixed(1)}%`}
            </div>
          ),
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {results.options.map((option) => (
          <li key={option.id} className="flex items-center justify-between gap-4 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-sm"
                style={{ backgroundColor: OPTION_COLORS[option.position] }}
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
