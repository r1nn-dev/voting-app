import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { formatKst, formatRemaining } from "@/lib/kst-time";
import { POLL_LIMITS } from "@/lib/poll-limits";
import { createPolls } from "@/lib/polls";
import { readVoterId } from "@/lib/voter-session";
import { ArchiveIcon, ArrowLeftIcon, CheckIcon, ClockIcon } from "../../icons";
import { ShareBar } from "../../share-bar";
import { StatusBadge } from "../../status-badge";
import { backLink, card, cardPadding } from "../../ui";
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
      <section className={`${card} px-6 py-14 text-center`}>
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
          <ArchiveIcon className="size-6" />
        </span>
        <h1 className="text-xl font-bold">공개 기간이 끝난 투표입니다</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          마감 후 {POLL_LIMITS.publicDays}일이 지나 더 이상 공개되지 않습니다.
        </p>
        <div className="mt-6 flex justify-center gap-4 text-sm">
          <Link href="/" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
            목록으로
          </Link>
          {admin && (
            <Link
              href={`/admin/polls/${poll.id}`}
              className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              관리자 화면에서 보기 →
            </Link>
          )}
        </div>
      </section>
    );
  }

  const myChoice = poll.options.find((option) => option.id === poll.myChoice);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/" className={backLink}>
        <ArrowLeftIcon className="size-4" />
        목록
      </Link>

      <section className={`${card} ${cardPadding}`}>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold leading-snug tracking-tight">{poll.question}</h1>
          <StatusBadge status={poll.status} />
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          <ClockIcon className="size-4" />
          {poll.status === "open"
            ? `${formatKst(poll.deadline)} 마감 예정 · ${formatRemaining(poll.deadline)} 남음`
            : `${formatKst(poll.closedAt)} 마감됨`}
        </p>

        <div className="mt-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
          {poll.status === "closed" ? (
            poll.results.total === 0 ? (
              <p className="py-6 text-center text-zinc-500 dark:text-zinc-400">
                표 없이 마감된 투표입니다.
              </p>
            ) : (
              <>
                <div className="mb-4 flex items-baseline justify-between">
                  <h2 className="font-semibold">결과</h2>
                  <span className="text-sm tabular-nums text-zinc-500">총 {poll.results.total}표</span>
                </div>
                <ShareBar results={poll.results} />
              </>
            )
          ) : myChoice ? (
            <div className="py-4 text-center">
              <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckIcon className="size-6" />
              </span>
              <p className="font-semibold">투표 완료</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-300">
                당신의 선택: <strong className="text-zinc-900 dark:text-zinc-100">{myChoice.label}</strong>
              </p>
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                결과는 투표가 마감되면 공개됩니다.
              </p>
            </div>
          ) : (
            <VoteForm pollId={poll.id} options={poll.options} />
          )}
        </div>
      </section>
    </div>
  );
}
