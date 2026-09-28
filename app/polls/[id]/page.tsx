import { notFound } from "next/navigation";
import { getSql } from "@/lib/db";
import { createPolls } from "@/lib/polls";
import { readVoterId } from "@/lib/voter-session";
import { ResultsBars } from "../../results-bars";
import { StatusBadge } from "../../status-badge";
import { VoteForm } from "./vote-form";

export default async function PollPage({ params }: PageProps<"/polls/[id]">) {
  const { id } = await params;
  const poll = await createPolls(getSql()).getPollForVoter(id, await readVoterId());
  if (!poll) notFound();

  const myChoice = poll.options.find((option) => option.id === poll.myChoice);

  return (
    <section>
      <div className="mb-6 flex items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">{poll.question}</h1>
        <StatusBadge isClosed={poll.status === "closed"} />
      </div>

      {poll.status === "closed" ? (
        poll.results.total === 0 ? (
          <p className="text-zinc-500">참여자 없음</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-zinc-500">
              총 {poll.results.total}표
              {myChoice && ` · 당신의 선택: ${myChoice.label}`}
            </p>
            <ResultsBars results={poll.results} myChoice={poll.myChoice} />
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
