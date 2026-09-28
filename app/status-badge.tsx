export function StatusBadge({ isClosed }: { isClosed: boolean }) {
  return isClosed ? (
    <span className="shrink-0 rounded-full bg-zinc-200 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      마감
    </span>
  ) : (
    <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
      진행 중
    </span>
  );
}
