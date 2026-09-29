import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { createPolls } from "@/lib/polls";
import { siteBaseUrl } from "@/lib/share";

/** 참여 코드 list with personal links as a CSV download. Admin only (ADR-0004). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/admin/polls/[id]/codes">) {
  await requireAdmin();
  const { id } = await ctx.params;

  const csv = await createPolls(getSql()).codesCsv(id, await siteBaseUrl());
  if (csv === null) return new Response("투표를 찾을 수 없습니다.", { status: 404 });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="poll-${id}-codes.csv"; filename*=UTF-8''${encodeURIComponent(`한표-참여코드-${id}.csv`)}`,
      "Cache-Control": "no-store",
    },
  });
}
