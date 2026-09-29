import type { PollStatus } from "@/lib/polls";

const BADGES: Record<PollStatus, { label: string; className: string; dot: string }> = {
  open: {
    label: "진행 중",
    className:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-400/20",
    dot: "bg-emerald-500",
  },
  closed: {
    label: "마감",
    className:
      "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-400/20",
    dot: "bg-zinc-400",
  },
  archived: {
    label: "보관",
    className:
      "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-400/20",
    dot: "bg-amber-500",
  },
};

export function StatusBadge({ status }: { status: PollStatus }) {
  const { label, className, dot } = BADGES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
