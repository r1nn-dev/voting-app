import Link from "next/link";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { kstInputFromNow } from "@/lib/kst-time";
import { createPolls } from "@/lib/polls";
import { ArrowLeftIcon } from "../../icons";
import { backLink } from "../../ui";
import { NewPollForm } from "./new-poll-form";

export default async function NewPollPage({ searchParams }: PageProps<"/admin/new">) {
  await requireAdmin();
  const initialDeadline = kstInputFromNow(24 * 60 * 60 * 1000);
  const initialOpensAt = kstInputFromNow(60 * 60 * 1000);
  // 복제: ?from=<id> pre-fills the form; an unknown id just opens an empty one.
  const from = (await searchParams).from;
  const template =
    typeof from === "string"
      ? ((await createPolls(getSql()).getPollForAdmin(from))?.template ?? null)
      : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link href="/admin" className={backLink}>
        <ArrowLeftIcon className="size-4" />
        투표 관리
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{template ? "투표 복제" : "새 투표"}</h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          {template
            ? "기존 투표의 질문, 선택지, 공개 방식, 투표 모드, 참여 코드 사용 여부를 채워 두었습니다. 시각을 확인하고 만드세요. 표와 코드는 복사되지 않습니다."
            : "질문과 선택지, 마감 예정 시각을 정하면 바로 공개됩니다."}
        </p>
      </div>
      <NewPollForm
        initialDeadline={initialDeadline}
        initialOpensAt={initialOpensAt}
        template={template}
      />
    </div>
  );
}
