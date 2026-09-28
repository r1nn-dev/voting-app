import Link from "next/link";
import { connection } from "next/server";
import { getSql } from "@/lib/db";
import { createPolls } from "@/lib/polls";
import { StatusBadge } from "./status-badge";

export default async function Home() {
  await connection();
  const polls = await createPolls(getSql()).listPolls();

  return (
    <section>
      <h1 className="mb-6 text-2xl font-bold">투표 목록</h1>
      {polls.length === 0 ? (
        <p className="text-zinc-500">아직 투표가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {polls.map((poll) => (
            <li key={poll.id}>
              <Link
                href={`/polls/${poll.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <span className="truncate">{poll.question}</span>
                <StatusBadge isClosed={poll.isClosed} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
