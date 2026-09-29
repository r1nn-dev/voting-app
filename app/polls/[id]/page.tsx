import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { formatKst, formatRemaining } from "@/lib/kst-time";
import { POLL_LIMITS } from "@/lib/poll-limits";
import { createPolls } from "@/lib/polls";
import { readVoterId } from "@/lib/voter-session";
import { ShareBar } from "../../share-bar";
import { StatusBadge } from "../../status-badge";
import { VoteForm } from "./vote-form";

export default async function PollPage({ params }: PageProps<"/polls/[id]">) {
  const { id } = await params;
  const poll = await createPolls(getSql()).getPollForVoter(id, await readVoterId());
  if (!poll) notFound();

  if (poll.status === "archived") {
    // The admin check only decides whether to show the link; the detail page
    // verifies the session itself.
    const admin = await isAdmin();
    return (
      <section className="text-center">
        <h1 className="mb-2 text-2xl font-bold">공개 기간이 끝난 투표입니다</h1>
        <p className="text-zinc-500">
          마감 후 {POLL_LIMITS.publicDays}일이 지나 더 이상 공개되지 않습니다.
        </p>
        {admin && (
          <Link
            href={`/admin/polls/${poll.id}`}
            className="mt-6 inline-block text-sm text-zinc-500 hover:underline"
          >
            관리자 화면에서 보기 →
          </Link>
        )}
      </section>
    );
  }

  const myChoice = poll.options.find((option) => option.id === poll.myChoice);

  return (
    <section>
      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{poll.question}</h1>
        <StatusBadge status={poll.status} />
      </div>
      <p className="mb-6 text-sm text-zinc-500">
        {poll.status === "open"
          ? `${formatKst(poll.deadline)} 마감 · ${formatRemaining(poll.deadline)} 남음`
          : `${formatKst(poll.closedAt)} 마감됨`}
      </p>

      {poll.status === "closed" ? (
        poll.results.total === 0 ? (
          <p className="text-zinc-500">참여자 없음</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-500">
              총 {poll.results.total}표
            </p>
            <ShareBar results={poll.results} />
          </>
        )
      ) : myChoice ? (
        <div className="rounded-lg border border-zinc-200 p-6 text-center dark:border-zinc-800">
          <p className="mb-1 font-medium">투표 완료</p>
          <p className="text-zinc-600 dark:text-zinc-400">
            당신의 선택: <strong>{myChoice.label}</strong>
          </p>
          <p className="mt-4 text-sm text-zinc-500">결과는 투표가 마감되면 공개됩니다.</p>
        </div>
      ) : (
        <VoteForm pollId={poll.id} options={poll.options} />
      )}
    </section>
  );
}
