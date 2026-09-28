import { createHash, timingSafeEqual } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";

type AdminAuthOptions = {
  password: string;
  sessionSecret: string;
  failureDelay?: () => Promise<void>;
};

export const ADMIN_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const oneSecond = () => new Promise<void>((resolve) => setTimeout(resolve, 1000));

export function createAdminAuth({
  password,
  sessionSecret,
  failureDelay = oneSecond,
}: AdminAuthOptions) {
  const key = new TextEncoder().encode(sessionSecret);

  // Hashing first gives equal-length buffers, so the comparison leaks neither
  // content nor length through timing.
  async function verifyAdminPassword(input: string): Promise<boolean> {
    const ok = timingSafeEqual(sha256(input), sha256(password));
    if (!ok) await failureDelay();
    return ok;
  }

  async function createAdminSession(): Promise<string> {
    return new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${ADMIN_SESSION_MAX_AGE_SECONDS}s`)
      .sign(key);
  }

  async function verifyAdminSession(token: string | undefined): Promise<boolean> {
    if (!token) return false;
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
      return payload.role === "admin";
    } catch {
      return false;
    }
  }

  return { verifyAdminPassword, createAdminSession, verifyAdminSession };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}
