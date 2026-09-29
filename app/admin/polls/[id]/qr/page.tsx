import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { formatKst, formatRemaining } from "@/lib/kst-time";
import { createPolls } from "@/lib/polls";
import { pollUrl, qrSvg, shortUrl } from "@/lib/share";

/** Full-screen QR for a projector: the question, a large QR, the short URL and the time left. */
export default async function PresentQrPage({ params }: PageProps<"/admin/polls/[id]/qr">) {
  await requireAdmin();
  const { id } = await params;
  const poll = await createPolls(getSql()).getPollForAdmin(id);
  if (!poll) notFound();

  const url = await pollUrl(poll.id);
  const qr = await qrSvg(url);
  const when =
    poll.status === "scheduled"
      ? `${formatKst(poll.opensAt)}에 시작합니다`
      : poll.status === "open"
      ? `${formatKst(poll.deadline)} 마감 · ${formatRemaining(poll.deadline)} 남음`
      : poll.status === "closed"
        ? "마감된 투표입니다 · 결과를 볼 수 있어요"
        : "공개 기간이 끝난 투표입니다";

  return (
    // Covers the site header and footer so only the QR view shows.
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 overflow-auto bg-white px-6 py-10 text-center text-zinc-900">
      <Link
        href={`/admin/polls/${poll.id}`}
        className="absolute left-5 top-5 text-sm text-zinc-500 hover:text-zinc-900"
      >
        ← 상세로 돌아가기
      </Link>
      <h1 className="max-w-4xl text-3xl font-bold leading-snug tracking-tight sm:text-5xl">
        {poll.question}
      </h1>
      <div
        role="img"
        aria-label="투표 주소 QR 코드"
        className="aspect-square w-[min(60vh,80vw)] [&_svg]:size-full"
        dangerouslySetInnerHTML={{ __html: qr }}
      />
      <p className="text-xl font-semibold tabular-nums sm:text-2xl">{shortUrl(url)}</p>
      <p className="text-lg text-zinc-600 sm:text-xl">{when}</p>
    </div>
  );
}
