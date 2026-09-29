import Link from "next/link";
import { connection } from "next/server";
import { getSql } from "@/lib/db";
import { formatKst, formatRemaining, isWithin } from "@/lib/kst-time";
import { createPolls } from "@/lib/polls";
import { ChevronRightIcon, ClockIcon } from "./icons";
import { StatusBadge } from "./status-badge";
import { card } from "./ui";

const SOON_MS = 24 * 60 * 60 * 1000;

export default async function Home() {
  await connection();
  const { open, closed } = await createPolls(getSql()).listPolls();

  return (
    <div className="flex flex-col gap-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">투표</h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">
          진행 중인 투표에 참여하고, 마감된 투표의 결과를 확인하세요.
        </p>
      </div>

      <PollSection title="진행 중" count={open.length} empty="지금 진행 중인 투표가 없습니다.">
        {open.map((poll) => {
          const soon = isWithin(poll.deadline, SOON_MS);
          return (
            <PollRow key={poll.id} id={poll.id} question={poll.question} status="open">
              <span
                className={`inline-flex items-center gap-1 ${
                  soon ? "font-medium text-amber-600 dark:text-amber-400" : ""
                }`}
              >
                <ClockIcon className="size-3.5" />
                {soon && "곧 마감 · "}
                {formatRemaining(poll.deadline)} 남음
              </span>
              <span className="hidden sm:inline">· {formatKst(poll.deadline)} 마감 예정</span>
            </PollRow>
          );
        })}
      </PollSection>

      <PollSection title="마감된 투표" count={closed.length} empty="아직 마감된 투표가 없습니다.">
        {closed.map((poll) => (
          <PollRow key={poll.id} id={poll.id} question={poll.question} status="closed">
            <span>{formatKst(poll.closedAt)} 마감</span>
            <span className="font-medium text-indigo-600 dark:text-indigo-400">· 결과 보기</span>
          </PollRow>
        ))}
      </PollSection>
    </div>
  );
}

function PollSection({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
        {title}
        <span className="rounded-full bg-zinc-200/70 px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {count}
        </span>
      </h2>
      {children.length === 0 ? (
        <p
          className={`${card} border-dashed px-5 py-8 text-center text-sm text-zinc-500 shadow-none dark:text-zinc-400`}
        >
          {empty}
        </p>
      ) : (
        <ul className={`${card} divide-y divide-zinc-100 overflow-hidden dark:divide-zinc-800`}>
          {children}
        </ul>
      )}
    </section>
  );
}

function PollRow({
  id,
  question,
  status,
  children,
}: {
  id: string;
  question: string;
  status: "open" | "closed";
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={`/polls/${id}`}
        className="group flex items-center gap-4 px-5 py-4 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{question}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-zinc-500 dark:text-zinc-400">
            {children}
          </span>
        </span>
        <StatusBadge status={status} />
        <ChevronRightIcon className="size-4 shrink-0 text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500 dark:text-zinc-600" />
      </Link>
    </li>
  );
}
