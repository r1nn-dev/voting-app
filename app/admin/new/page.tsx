import Link from "next/link";
import { requireAdmin } from "@/lib/admin-session";
import { NewPollForm } from "./new-poll-form";

export default async function NewPollPage() {
  await requireAdmin();

  return (
    <section>
      <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
        ← 투표 관리
      </Link>
      <h1 className="mb-6 mt-2 text-2xl font-bold">새 투표</h1>
      <NewPollForm />
    </section>
  );
}
