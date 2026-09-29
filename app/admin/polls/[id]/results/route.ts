import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { createPolls } from "@/lib/polls";

/** 결과 (or 득표 현황) as a CSV download. Admin only, like every admin action (ADR-0004). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/admin/polls/[id]/results">) {
  await requireAdmin();
  const { id } = await ctx.params;

  const csv = await createPolls(getSql()).resultsCsv(id);
  if (csv === null) return new Response("투표를 찾을 수 없습니다.", { status: 404 });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="poll-${id}-results.csv"; filename*=UTF-8''${encodeURIComponent(`한표-결과-${id}.csv`)}`,
      "Cache-Control": "no-store",
    },
  });
}
