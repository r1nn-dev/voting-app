import { formatRemaining } from "@/lib/kst-time";
import type { Ranking, RankSummary } from "@/lib/polls";
import { card, cardPadding } from "../../../ui";

/**
 * 순위와 격차: the summary plus bars sorted by votes. Numbers are always in
 * text too. `openUntil` is the deadline while the poll is open, null otherwise.
 */
export function RankChart({ ranking, openUntil }: { ranking: Ranking; openUntil: Date | null }) {
  const { options, summary } = ranking;

  return (
    <section className={`${card} ${cardPadding}`}>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="font-semibold">{openUntil ? "득표 현황" : "결과"}</h2>
        {openUntil && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
            마감 예정까지 {formatRemaining(openUntil)}
          </span>
        )}
      </div>

      {summary.kind === "empty" ? (
        <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">아직 표 없음</p>
      ) : (
        <>
          <Summary summary={summary} />

          <ol className="flex flex-col gap-4">
            {options.map((option) => (
              <li key={option.id} className="flex items-center gap-3">
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                    option.isTop
                      ? "bg-indigo-600 text-white dark:bg-indigo-500"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {option.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-baseline justify-between gap-4 text-sm">
                    <span className={`truncate ${option.isTop ? "font-semibold" : ""}`}>
                      <span className="sr-only">{option.rank}위 </span>
                      {option.label}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-semibold">{option.votes}표</span>
                      <span className="ml-1.5 text-zinc-500 dark:text-zinc-400">
                        {option.percent.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${
                        option.isTop ? "bg-indigo-600 dark:bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-600"
                      }`}
                      style={{ width: `${option.percent}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

function Summary({ summary }: { summary: Exclude<RankSummary, { kind: "empty" }> }) {
  const tied = summary.kind === "tied";
  return (
    <dl className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      <Tile term="총 표 수" value={`${summary.total}표`} />
      <Tile
        term={tied ? "동점 1위" : "1위"}
        value={tied ? summary.leaders.map((leader) => leader.label).join(", ") : summary.leader.label}
        strong
      />
      <Tile
        term="1위와 2위 차이"
        value={
          tied
            ? "동점"
            : `${summary.gap.votes}표 (${summary.gap.percentPoints.toFixed(1)}%p)`
        }
      />
    </dl>
  );
}

function Tile({ term, value, strong = false }: { term: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-zinc-50 px-3.5 py-3 dark:bg-zinc-800/60">
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{term}</dt>
      <dd
        className={`mt-1 truncate tabular-nums ${
          strong ? "font-bold text-indigo-700 dark:text-indigo-300" : "font-semibold"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
