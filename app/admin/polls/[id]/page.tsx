import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { formatKst, formatRemaining, toKstInputValue } from "@/lib/kst-time";
import { POLL_LIMITS } from "@/lib/poll-limits";
import { createPolls } from "@/lib/polls";
import { pollUrl, qrSvg } from "@/lib/share";
import { ArrowLeftIcon, ClockIcon } from "../../../icons";
import { UnlistedBadge } from "../../../listed-badge";
import { SharePanel } from "../../../share-panel";
import { ModeBadge } from "../../../mode-badge";
import { StatusBadge } from "../../../status-badge";
import { backLink, buttonSecondary, card, cardPadding, hint } from "../../../ui";
import { ConfirmActionButton } from "../../confirm-action-button";
import {
  closePollAction,
  deletePollAndReturnToListAction,
  setListedAction,
  startNowAction,
} from "../../poll-actions";
import { ExtendDeadlineForm } from "./extend-deadline-form";
import { IssueCodesForm } from "./issue-codes-form";
import { RescheduleForm } from "./reschedule-form";
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
            <ModeBadge mode={poll.mode} maxChoices={poll.maxChoices} />
            <UnlistedBadge listed={poll.listed} />
            <StatusBadge status={poll.status} />
          </span>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          <ClockIcon className="size-4" />
          {poll.status === "scheduled"
            ? `${formatKst(poll.opensAt)} 시작 예정 · ${formatKst(poll.deadline)} 마감 예정`
            : poll.status === "open" || !poll.closedAt
              ? `${formatKst(poll.deadline)} 마감 예정 · ${formatRemaining(poll.deadline)} 남음`
              : `${formatKst(poll.closedAt)} 마감됨`}
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-2">
          <Link href={`/polls/${poll.id}`} className={buttonSecondary}>
            공개 페이지 보기
          </Link>
          <a href={`/admin/polls/${poll.id}/results`} className={buttonSecondary}>
            결과 CSV 받기
          </a>
          <Link href={`/admin/new?from=${poll.id}`} className={buttonSecondary}>
            복제
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

      {poll.status === "scheduled" ? (
        <section className={`${card} ${cardPadding}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">시작 전</h2>
              <p className={`${hint} mt-1`}>
                {formatRemaining(poll.opensAt)} 후 시작합니다. 시작 전에는 표를 받지 않습니다.
              </p>
            </div>
            <form action={startNowAction}>
              <input type="hidden" name="pollId" value={poll.id} />
              <button className={buttonSecondary}>지금 바로 시작</button>
            </form>
          </div>
          <div className="mt-5 border-t border-zinc-100 pt-5 dark:border-zinc-800">
            <RescheduleForm
              key={`${poll.opensAt.toISOString()}-${poll.deadline.toISOString()}`}
              pollId={poll.id}
              opensAt={toKstInputValue(poll.opensAt)}
              deadline={toKstInputValue(poll.deadline)}
            />
          </div>
        </section>
      ) : (
        <RankChart
          ranking={poll.ranking}
          openUntil={poll.status === "open" ? poll.deadline : null}
          multiple={poll.mode === "multiple"}
        />
      )}

      {poll.codes && (
        <section className={`${card} ${cardPadding} flex flex-col gap-4`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">참여 코드</h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                코드 <strong className="tabular-nums">{poll.codes.issued}</strong>개 중{" "}
                <strong className="tabular-nums">{poll.codes.used}</strong>개 사용
              </p>
              <p className={`${hint} mt-1`}>
                코드 하나로 한 번 투표할 수 있습니다. 어떤 코드로 무엇을 골랐는지는 남지 않습니다.
              </p>
            </div>
            <a href={`/admin/polls/${poll.id}/codes`} className={buttonSecondary}>
              코드 CSV 받기
            </a>
          </div>
          {(poll.status === "scheduled" || poll.status === "open") &&
            (poll.codes.issued < POLL_LIMITS.maxCodes ? (
              <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <IssueCodesForm pollId={poll.id} remaining={POLL_LIMITS.maxCodes - poll.codes.issued} />
              </div>
            ) : (
              <p className={hint}>코드는 한 투표에 {POLL_LIMITS.maxCodes}개까지 발급할 수 있습니다.</p>
            ))}
        </section>
      )}

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
            {poll.status === "open"
              ? "마감과 삭제는 되돌릴 수 없습니다."
              : poll.status === "scheduled"
                ? "시작 전인 투표는 마감하지 않습니다. 필요 없으면 삭제하세요."
                : "삭제는 되돌릴 수 없습니다."}
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
