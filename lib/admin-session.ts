// Next.js adapter around the admin auth module: env config and the session cookie.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_MAX_AGE_SECONDS, createAdminAuth } from "./admin-auth";
import { requireEnv } from "./env";

export const ADMIN_SESSION_COOKIE = "admin_session";

let adminAuth: ReturnType<typeof createAdminAuth> | undefined;

export function getAdminAuth() {
  adminAuth ??= createAdminAuth({
    password: requireEnv("ADMIN_PASSWORD"),
    sessionSecret: requireEnv("SESSION_SECRET"),
  });
  return adminAuth;
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  return getAdminAuth().verifyAdminSession(token);
}

/** Call first in every admin page and Server Action: Proxy is not a security boundary. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

export async function startAdminSession(): Promise<void> {
  (await cookies()).set(ADMIN_SESSION_COOKIE, await getAdminAuth().createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  });
}

export async function endAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_SESSION_COOKIE);
}
