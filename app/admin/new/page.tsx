import Link from "next/link";
import { requireAdmin } from "@/lib/admin-session";
import { kstInputFromNow } from "@/lib/kst-time";
import { ArrowLeftIcon } from "../../icons";
import { backLink } from "../../ui";
import { NewPollForm } from "./new-poll-form";

export default async function NewPollPage() {
  await requireAdmin();
  const initialDeadline = kstInputFromNow(24 * 60 * 60 * 1000);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link href="/admin" className={backLink}>
        <ArrowLeftIcon className="size-4" />
        투표 관리
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">새 투표</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          질문과 선택지, 마감 예정 시각을 정하면 바로 공개됩니다.
        </p>
      </div>
      <NewPollForm initialDeadline={initialDeadline} />
    </div>
  );
}
