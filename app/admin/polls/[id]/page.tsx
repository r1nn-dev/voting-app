import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { formatKst, formatRemaining } from "@/lib/kst-time";
import { createPolls } from "@/lib/polls";
import { StatusBadge } from "../../../status-badge";
import { ConfirmActionButton } from "../../confirm-action-button";
import { closePollAction, deletePollAndReturnToListAction } from "../../poll-actions";
import { ExtendDeadlineForm } from "./extend-deadline-form";
import { RankChart } from "./rank-chart";

export default async function AdminPollPage({ params }: PageProps<"/admin/polls/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const poll = await createPolls(getSql()).getPollForAdmin(id);
  if (!poll) notFound();

  return (
    <section className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
          ← 투표 관리
        </Link>
        <div className="mt-2 flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold">{poll.question}</h1>
          <StatusBadge isClosed={poll.status === "closed"} />
        </div>
        <p className="mt-2 text-sm text-zinc-500">
          {poll.closedAt
            ? `${formatKst(poll.closedAt)} 마감됨`
            : `${formatKst(poll.deadline)} 마감 예정 · ${formatRemaining(poll.deadline)} 남음`}
        </p>
        <Link
          href={`/polls/${poll.id}`}
          className="mt-2 inline-block text-sm text-zinc-500 hover:underline"
        >
          공개 페이지 보기 →
        </Link>
      </div>

      <RankChart
        ranking={poll.ranking}
        openUntil={poll.status === "open" ? poll.deadline : null}
      />

      {poll.status === "open" && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="mb-1 font-medium">마감 예정 시각 연장</h2>
          <p className="mb-3 text-sm text-zinc-500">
            현재: {formatKst(poll.deadline)}. 늦추는 방향으로만, 지금부터 30일 이내로 연장할 수
            있습니다.
          </p>
          <ExtendDeadlineForm
            key={poll.deadline.toISOString()}
            pollId={poll.id}
            deadline={poll.deadline.toISOString()}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
        {poll.status === "open" && (
          <ConfirmActionButton
            action={closePollAction.bind(null, poll.id)}
            label="마감"
            confirmMessage="마감은 되돌릴 수 없습니다."
          />
        )}
        <ConfirmActionButton
          action={deletePollAndReturnToListAction.bind(null, poll.id)}
          label="삭제"
          confirmMessage="선택지와 표까지 모두 사라집니다."
          tone="danger"
        />
      </div>
    </section>
  );
}
