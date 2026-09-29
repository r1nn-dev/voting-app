import type { PollStatus } from "@/lib/polls";

const BADGES: Record<PollStatus, { label: string; className: string }> = {
  open: {
    label: "진행 중",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  },
  closed: {
    label: "마감",
    className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  archived: {
    label: "보관",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
};

export function StatusBadge({ status }: { status: PollStatus }) {
  const { label, className } = BADGES[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${className}`}>{label}</span>;
}
