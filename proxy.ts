import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminAuth } from "@/lib/admin-session";

// Convenience redirect only. Every admin page and Server Action checks the
// session itself (ADR-0004).
export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (await getAdminAuth().verifyAdminSession(token)) return NextResponse.next();

  return NextResponse.redirect(new URL("/admin/login", request.url));
}

export const config = {
  matcher: "/admin/:path*",
};
