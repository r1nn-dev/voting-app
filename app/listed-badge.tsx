/** Marks a 링크 전용 poll in admin views; 목록 공개 polls show nothing. */
export function UnlistedBadge({ listed }: { listed: boolean }) {
  if (listed) return null;
  return (
    <span className="inline-flex shrink-0 items-center rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-600/20 dark:bg-sky-950/60 dark:text-sky-300 dark:ring-sky-400/20">
      링크 전용
    </span>
  );
}
