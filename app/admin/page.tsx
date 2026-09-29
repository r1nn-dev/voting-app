import Link from "next/link";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { formatDaysLeft, formatKst, formatRemaining } from "@/lib/kst-time";
import { createPolls, type AdminListItem, type PollStatus } from "@/lib/polls";
import { ChevronRightIcon, PlusIcon } from "../icons";
import { UnlistedBadge } from "../listed-badge";
import { StatusBadge } from "../status-badge";
import { buttonPrimary, card } from "../ui";

const TABS = [
  { key: "scheduled", label: "시작 전", empty: "시작 전인 투표가 없습니다." },
  { key: "open", label: "진행 중", empty: "진행 중인 투표가 없습니다." },
  { key: "closed", label: "마감", empty: "마감된 투표가 없습니다." },
  { key: "archived", label: "보관", empty: "보관된 투표가 없습니다." },
] as const;

type Tab = (typeof TABS)[number]["key"];

/** Unknown or missing values fall back to the open tab. */
function parseTab(value: string | string[] | undefined): Tab {
  return TABS.find((tab) => tab.key === value)?.key ?? "open";
}

export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  await requireAdmin();
  const current = parseTab((await searchParams).tab);
  const lists = await createPolls(getSql()).listPollsForAdmin();
  const { empty } = TABS.find((tab) => tab.key === current)!;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">투표 관리</h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            마감 전에도 득표 현황을 볼 수 있습니다.
          </p>
        </div>
        <Link href="/admin/new" className={buttonPrimary}>
          <PlusIcon className="size-4" />새 투표
        </Link>
      </div>

      <nav className="flex gap-1 self-start rounded-xl bg-zinc-200/60 p-1 dark:bg-zinc-800/80">
        {TABS.map((tab) => {
          const active = tab.key === current;
          return (
            <Link
              key={tab.key}
              href={tab.key === "open" ? "/admin" : `/admin?tab=${tab.key}`}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              {tab.label}
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${
                  active
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "bg-zinc-300/60 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
                }`}
              >
                {lists[tab.key].length}
              </span>
            </Link>
          );
        })}
      </nav>

      {lists[current].length === 0 ? (
        <p
          className={`${card} border-dashed px-5 py-10 text-center text-sm text-zinc-500 shadow-none dark:text-zinc-400`}
        >
          {empty}
        </p>
      ) : (
        <ul className={`${card} divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800`}>
          {current === "scheduled"
            ? lists.scheduled.map((poll) => (
                <PollRow
                  key={poll.id}
                  poll={poll}
                  status="scheduled"
                  when={`${formatKst(poll.opensAt)} 시작 예정 · ${formatRemaining(poll.opensAt)} 후 시작`}
                />
              ))
            : current === "open"
            ? lists.open.map((poll) => (
                <PollRow
                  key={poll.id}
                  poll={poll}
                  status="open"
                  when={`${formatKst(poll.deadline)} 마감 예정 · ${formatRemaining(poll.deadline)} 남음`}
                />
              ))
            : current === "closed"
              ? lists.closed.map((poll) => (
                  <PollRow
                    key={poll.id}
                    poll={poll}
                    status="closed"
                    when={`${formatKst(poll.closedAt)} 마감됨`}
                    // When it archives is the poll module's call; this only counts the days.
                    note={`보관까지 ${formatDaysLeft(poll.archivesAt)}`}
                  />
                ))
              : lists.archived.map((poll) => (
                  <PollRow
                    key={poll.id}
                    poll={poll}
                    status="archived"
                    when={`${formatKst(poll.closedAt)} 마감됨`}
                  />
                ))}
        </ul>
      )}
    </div>
  );
}

function PollRow({
  poll,
  status,
  when,
  note,
}: {
  poll: AdminListItem;
  status: PollStatus;
  when: string;
  note?: string;
}) {
  const tied = poll.leaders.length > 1;

  return (
    <li>
      <Link
        href={`/admin/polls/${poll.id}`}
        className="group flex items-center gap-4 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-medium">{poll.question}</span>
            <StatusBadge status={status} />
            <UnlistedBadge listed={poll.listed} />
          </span>
          <span className="mt-1 block text-sm text-zinc-500 dark:text-zinc-400">{when}</span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium tabular-nums text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              총 {poll.total}표
            </span>
            {poll.leaders.length === 0 ? (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                표 없음
              </span>
            ) : (
              <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                {tied ? "동점 1위 " : "1위 "}
                {poll.leaders.map((option) => option.label).join(", ")}
              </span>
            )}
            {note && (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                {note}
              </span>
            )}
          </span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:text-zinc-600" />
      </Link>
    </li>
  );
}
