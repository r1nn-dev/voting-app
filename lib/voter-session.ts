// Next.js adapter for the anonymous voter cookie (ADR-0001).
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

const VOTER_COOKIE = "voter_id";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The voter id from the cookie, or null if absent or malformed. Safe during render. */
export async function readVoterId(): Promise<string | null> {
  const value = (await cookies()).get(VOTER_COOKIE)?.value;
  return value && UUID.test(value) ? value : null;
}

/** Only callable from Server Actions: may set the cookie. */
export async function getOrIssueVoterId(): Promise<string> {
  const existing = await readVoterId();
  if (existing) return existing;

  const voterId = randomUUID();
  (await cookies()).set(VOTER_COOKIE, voterId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
  });
  return voterId;
}
