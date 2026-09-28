import type { VoteTally } from "@/lib/polls";

export function TallyBars({
  tally,
  myChoice = null,
}: {
  tally: VoteTally;
  myChoice?: string | null;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {tally.options.map((option) => (
        <li key={option.id}>
          <div className="mb-1 flex items-baseline justify-between gap-4 text-sm">
            <span className={option.isTop ? "font-semibold" : undefined}>
              {option.label}
              {option.id === myChoice && (
                <span className="ml-2 text-xs text-zinc-500">내 선택</span>
              )}
            </span>
            <span className="shrink-0 tabular-nums text-zinc-600 dark:text-zinc-400">
              {option.votes}표 · {option.percent.toFixed(1)}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full ${
                option.isTop ? "bg-emerald-600" : "bg-zinc-400 dark:bg-zinc-600"
              }`}
              style={{ width: `${option.percent}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
