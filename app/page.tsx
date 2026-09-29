import Link from "next/link";
import { connection } from "next/server";
import { getSql } from "@/lib/db";
import { formatKst, formatRemaining } from "@/lib/kst-time";
import { createPolls } from "@/lib/polls";
import { StatusBadge } from "./status-badge";

export default async function Home() {
  await connection();
  const { open, closed } = await createPolls(getSql()).listPolls();

  return (
    <div className="flex flex-col gap-10">
      <PollSection title="진행 중" empty="진행 중인 투표가 없습니다.">
        {open.map((poll) => (
          <PollRow key={poll.id} id={poll.id} question={poll.question}>
            <span className="text-xs text-zinc-500">{formatRemaining(poll.deadline)} 남음</span>
            <StatusBadge status="open" />
          </PollRow>
        ))}
      </PollSection>

      <PollSection title="마감된 투표" empty="마감된 투표가 없습니다.">
        {closed.map((poll) => (
          <PollRow key={poll.id} id={poll.id} question={poll.question}>
            <span className="text-xs text-zinc-500">{formatKst(poll.closedAt)}</span>
            <StatusBadge status="closed" />
          </PollRow>
        ))}
      </PollSection>
    </div>
  );
}

function PollSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section>
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      {children.length === 0 ? (
        <p className="text-zinc-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {children}
        </ul>
      )}
    </section>
  );
}

function PollRow({
  id,
  question,
  children,
}: {
  id: string;
  question: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={`/polls/${id}`}
        className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
      >
        <span className="truncate">{question}</span>
        <span className="flex shrink-0 items-center gap-2">{children}</span>
      </Link>
    </li>
  );
}
