import Link from "next/link";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { formatKst, formatRemaining } from "@/lib/kst-time";
import { createPolls } from "@/lib/polls";
import { TallyBars } from "../tally-bars";
import { StatusBadge } from "../status-badge";
import { logout } from "./auth-actions";
import { ConfirmActionButton } from "./confirm-action-button";
import { closePollAction, deletePollAction } from "./poll-actions";

export default async function AdminPage() {
  await requireAdmin();
  const polls = await createPolls(getSql()).listPollsForAdmin();

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

      {polls.length === 0 ? (
        <p className="text-zinc-500">아직 투표가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {polls.map((poll) => (
            <li
              key={poll.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="mb-3 flex items-center justify-between gap-4">
                <Link href={`/polls/${poll.id}`} className="truncate font-medium hover:underline">
                  {poll.question}
                </Link>
                <StatusBadge isClosed={poll.isClosed} />
              </div>
              <p className="mb-2 text-sm text-zinc-500">
                {poll.isClosed ? "결과" : "득표 현황"} · 총 {poll.tally.total}표 ·{" "}
                {poll.closedAt
                  ? `${formatKst(poll.closedAt)} 마감됨`
                  : `${formatKst(poll.deadline)} 마감 예정 (${formatRemaining(poll.deadline)} 남음)`}
              </p>
              <TallyBars tally={poll.tally} />
              <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                <Link
                  href={`/polls/${poll.id}`}
                  className="rounded-md px-2 py-1 text-sm text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  공개 페이지
                </Link>
                {!poll.isClosed && (
                  <ConfirmActionButton
                    action={closePollAction.bind(null, poll.id)}
                    label="마감"
                    confirmMessage="마감은 되돌릴 수 없습니다."
                  />
                )}
                <ConfirmActionButton
                  action={deletePollAction.bind(null, poll.id)}
                  label="삭제"
                  confirmMessage="선택지와 표까지 모두 사라집니다."
                  tone="danger"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
