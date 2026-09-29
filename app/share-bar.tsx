import type { PollMode, ShareResults } from "@/lib/polls";

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

/**
 * 결과, largest share first. 단일 선택: one 100% stacked bar plus a legend.
 * 복수 선택: one bar per option, as shares of 표 can sum to more than 100%.
 */
export function ShareBar({ results, mode = "single" }: { results: ShareResults; mode?: PollMode }) {
  if (mode === "multiple") return <ChoiceBars results={results} />;

  // Rounded percents can sum to 99.9; the last visible segment absorbs the gap.
  const lastVisible = results.options.findLastIndex((option) => option.votes > 0);
  const summary = results.options
    .map((option) => `${option.label} ${option.percent.toFixed(1)}%`)
    .join(", ");

  return (
    <div className="flex flex-col gap-5">
      <div
        role="img"
        aria-label={`결과 비중: ${summary}`}
        className="flex h-9 w-full gap-0.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
      >
        {results.options.map((option, index) =>
          option.votes === 0 ? null : (
            <div
              key={option.id}
              className={`flex items-center justify-center overflow-hidden text-xs font-semibold text-white first:rounded-l-full last:rounded-r-full ${
                index === lastVisible ? "grow" : ""
              }`}
              style={{ width: `${option.percent}%`, backgroundColor: OPTION_COLORS[option.position] }}
            >
              {option.percent >= MIN_LABELED_PERCENT && `${option.percent.toFixed(1)}%`}
            </div>
          ),
        )}
      </div>

      <ul className="flex flex-col gap-1">
        {results.options.map((option) => (
          <li
            key={option.id}
            className={`flex items-center justify-between gap-4 rounded-lg px-3 py-2 text-sm ${
              option.isTop ? "bg-zinc-50 dark:bg-zinc-800/60" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full"
                style={{ backgroundColor: OPTION_COLORS[option.position] }}
              />
              <span className={`truncate ${option.isTop ? "font-semibold" : ""}`}>
                {option.label}
              </span>
              {option.isTop && (
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300">
                  1위
                </span>
              )}
              {option.isMine && (
                <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20 dark:bg-indigo-950/60 dark:text-indigo-300">
                  내 선택
                </span>
              )}
            </span>
            <span className="shrink-0 tabular-nums">
              <span className="font-semibold">{option.percent.toFixed(1)}%</span>
              <span className="ml-1.5 text-zinc-500 dark:text-zinc-400">{option.votes}표</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChoiceBars({ results }: { results: ShareResults }) {
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3.5">
        {results.options.map((option) => (
          <li key={option.id}>
            <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className={`truncate ${option.isTop ? "font-semibold" : ""}`}>{option.label}</span>
                {option.isTop && (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300">
                    1위
                  </span>
                )}
                {option.isMine && (
                  <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-600/20 dark:bg-indigo-950/60 dark:text-indigo-300">
                    내 선택
                  </span>
                )}
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="text-zinc-500 dark:text-zinc-400">표 중 </span>
                <span className="font-semibold">{option.percent.toFixed(1)}%</span>
                <span className="ml-1.5 text-zinc-500 dark:text-zinc-400">{option.votes}표</span>
              </span>
            </div>
            <div
              role="img"
              aria-label={`${option.label}: 표 중 ${option.percent.toFixed(1)}%`}
              className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${option.percent}%`, backgroundColor: OPTION_COLORS[option.position] }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        한 표에 여러 개를 고를 수 있어 비율 합이 100%를 넘을 수 있습니다.
      </p>
    </div>
  );
}
