import type { AdminPoll } from "@/lib/polls";

/** 순위와 격차: the summary line plus bars sorted by votes. Numbers are always in text too. */
export function RankChart({
  ranking,
  isClosed,
}: {
  ranking: AdminPoll["ranking"];
  isClosed: boolean;
}) {
  const { options, summary } = ranking;

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-3 font-medium">{isClosed ? "결과" : "득표 현황"}</h2>

      {summary.total === 0 ? (
        <p className="text-sm text-zinc-500">아직 표 없음</p>
      ) : (
        <>
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-zinc-500">총 표 수</dt>
            <dd className="tabular-nums">{summary.total}표</dd>
            <dt className="text-zinc-500">{summary.isTie ? "동점 1위" : "1위"}</dt>
            <dd className="font-semibold">
              {summary.leaders.map((leader) => leader.label).join(", ")}
            </dd>
            <dt className="text-zinc-500">1위와 2위 차이</dt>
            <dd className="tabular-nums">
              {summary.isTie
                ? "동점"
                : `${summary.gap!.votes}표 (${summary.gap!.percentPoints.toFixed(1)}%p)`}
            </dd>
          </dl>

          <ol className="flex flex-col gap-3">
            {options.map((option) => (
              <li key={option.id}>
                <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
                  <span className={`min-w-0 truncate ${option.isTop ? "font-semibold" : ""}`}>
                    <span className="mr-2 tabular-nums text-zinc-500">{option.rank}위</span>
                    {option.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
                    {option.votes}표 · {option.percent.toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className={`h-full rounded-full ${
                      option.isTop ? "bg-emerald-600" : "bg-zinc-400 dark:bg-zinc-500"
                    }`}
                    style={{ width: `${option.percent}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
