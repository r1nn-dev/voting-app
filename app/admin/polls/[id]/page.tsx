import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { formatKst, formatRemaining } from "@/lib/kst-time";
import { POLL_LIMITS } from "@/lib/poll-limits";
import { createPolls } from "@/lib/polls";
import { pollUrl, qrSvg } from "@/lib/share";
import { ArrowLeftIcon, ClockIcon } from "../../../icons";
import { UnlistedBadge } from "../../../listed-badge";
import { SharePanel } from "../../../share-panel";
import { StatusBadge } from "../../../status-badge";
import { backLink, buttonSecondary, card, cardPadding, hint } from "../../../ui";
import { ConfirmActionButton } from "../../confirm-action-button";
import {
  closePollAction,
  deletePollAndReturnToListAction,
  setListedAction,
} from "../../poll-actions";
import { ExtendDeadlineForm } from "./extend-deadline-form";
import { RankChart } from "./rank-chart";

export default async function AdminPollPage({ params }: PageProps<"/admin/polls/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const poll = await createPolls(getSql()).getPollForAdmin(id);
  if (!poll) notFound();
  const url = await pollUrl(poll.id);
  const qr = await qrSvg(url);

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className={backLink}>
        <ArrowLeftIcon className="size-4" />
        투표 관리
      </Link>

      <section className={`${card} ${cardPadding}`}>
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold leading-snug tracking-tight">{poll.question}</h1>
          <span className="flex shrink-0 items-center gap-1.5">
            <UnlistedBadge listed={poll.listed} />
            <StatusBadge status={poll.status} />
          </span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          <ClockIcon className="size-4" />
          {poll.status === "open" || !poll.closedAt
            ? `${formatKst(poll.deadline)} 마감 예정 · ${formatRemaining(poll.deadline)} 남음`
            : `${formatKst(poll.closedAt)} 마감됨`}
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-2">
          <Link href={`/polls/${poll.id}`} className={buttonSecondary}>
            공개 페이지 보기
          </Link>
          <form action={setListedAction}>
            <input type="hidden" name="pollId" value={poll.id} />
            <input type="hidden" name="listed" value={poll.listed ? "false" : "true"} />
            <button className={buttonSecondary}>
              {poll.listed ? "링크 전용으로 바꾸기" : "목록에 공개하기"}
            </button>
          </form>
        </div>
        {poll.status !== "archived" && (
          <div className="mt-3">
            <SharePanel url={url} qrSvg={qr} presentHref={`/admin/polls/${poll.id}/qr`} />
          </div>
        )}
      </section>

      <RankChart ranking={poll.ranking} openUntil={poll.status === "open" ? poll.deadline : null} />

      {poll.status === "open" && (
        <section className={`${card} ${cardPadding}`}>
          <h2 className="font-semibold">마감 예정 시각 연장</h2>
          <p className={`${hint} mt-1 mb-4`}>
            현재 {formatKst(poll.deadline)}. 늦추는 방향으로만, 지금부터{" "}
            {POLL_LIMITS.deadlineMaxDays}일 이내로 연장할 수 있습니다.
          </p>
          <ExtendDeadlineForm
            key={poll.deadline.toISOString()}
            pollId={poll.id}
            deadline={poll.deadline.toISOString()}
          />
        </section>
      )}

      <section className={`${card} ${cardPadding} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <h2 className="font-semibold">투표 정리</h2>
          <p className={`${hint} mt-1`}>
            {poll.status === "open" ? "마감과 삭제는 되돌릴 수 없습니다." : "삭제는 되돌릴 수 없습니다."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {poll.status === "open" && (
            <ConfirmActionButton
              action={closePollAction.bind(null, poll.id)}
              label="지금 마감"
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
    </div>
  );
}
