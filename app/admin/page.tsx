import Link from "next/link";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { formatKst, formatRemaining } from "@/lib/kst-time";
import { POLL_LIMITS } from "@/lib/poll-limits";
import { createPolls, type AdminListItem } from "@/lib/polls";
import { logout } from "./auth-actions";

const DAY_MS = 24 * 60 * 60 * 1000;

const TABS = [
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
    <section>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">투표 관리</h1>
        <div className="flex items-center gap-4">
          <Link
            href="/admin/new"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            새 투표
          </Link>
          <form action={logout}>
            <button className="text-sm text-zinc-500 hover:underline">로그아웃</button>
          </form>
        </div>
      </div>

      <nav className="mb-4 flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "open" ? "/admin" : `/admin?tab=${tab.key}`}
            aria-current={tab.key === current ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab.key === current
                ? "border-zinc-900 font-medium dark:border-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            {tab.label} <span className="tabular-nums text-zinc-500">{lists[tab.key].length}</span>
          </Link>
        ))}
      </nav>

      {lists[current].length === 0 ? (
        <p className="text-zinc-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {current === "open"
            ? lists.open.map((poll) => (
                <PollRow
                  key={poll.id}
                  poll={poll}
                  when={`${formatKst(poll.deadline)} 마감 예정 · ${formatRemaining(poll.deadline)} 남음`}
                />
              ))
            : lists[current].map((poll) => (
                <PollRow
                  key={poll.id}
                  poll={poll}
                  when={`${formatKst(poll.closedAt)} 마감됨`}
                  note={
                    current === "closed"
                      ? `보관까지 ${formatRemaining(
                          new Date(poll.closedAt.getTime() + POLL_LIMITS.publicDays * DAY_MS),
                        )}`
                      : undefined
                  }
                />
              ))}
        </ul>
      )}
    </section>
  );
}

function PollRow({ poll, when, note }: { poll: AdminListItem; when: string; note?: string }) {
  const leader =
    poll.leaders.length === 0
      ? "표 없음"
      : `1위 ${poll.leaders.map((option) => option.label).join(", ")}${
          poll.leaders.length > 1 ? " (동점)" : ""
        }`;

  return (
    <li>
      <Link
        href={`/admin/polls/${poll.id}`}
        className="flex flex-col gap-1 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <span className="flex items-baseline justify-between gap-4">
          <span className="truncate font-medium">{poll.question}</span>
          {note && <span className="shrink-0 text-xs text-zinc-500">{note}</span>}
        </span>
        <span className="text-sm text-zinc-500">
          {when} · 총 {poll.total}표 · {leader}
        </span>
      </Link>
    </li>
  );
}
