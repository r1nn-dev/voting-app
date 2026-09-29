import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAdminAuth } from "./admin-auth";

const noDelay = async () => {};

function auth(overrides: Partial<Parameters<typeof createAdminAuth>[0]> = {}) {
  return createAdminAuth({
    password: "correct horse battery staple",
    sessionSecret: "test-secret-that-is-at-least-32-bytes-long",
    failureDelay: noDelay,
    ...overrides,
  });
}

describe("verifyAdminPassword", () => {
  it("맞는 비밀번호를 받아들인다", async () => {
    expect(await auth().verifyAdminPassword("correct horse battery staple")).toBe(true);
  });

  it("틀린 비밀번호는 거부하고 실패 지연을 거친다", async () => {
    let delayed = 0;
    const failureDelay = async () => {
      delayed += 1;
    };
    expect(
      await auth({ failureDelay }).verifyAdminPassword("correct horse battery stapla"),
    ).toBe(false);
    expect(delayed).toBe(1);
  });

  it("길이가 다른 입력도 거부한다", async () => {
    expect(await auth().verifyAdminPassword("short")).toBe(false);
    expect(await auth().verifyAdminPassword("")).toBe(false);
  });
});

describe("관리자 세션", () => {
  it("새로 발급한 세션은 검증을 통과한다", async () => {
    const a = auth();
    expect(await a.verifyAdminSession(await a.createAdminSession())).toBe(true);
  });

  it("세션이 없으면 거부한다", async () => {
    expect(await auth().verifyAdminSession(undefined)).toBe(false);
    expect(await auth().verifyAdminSession("")).toBe(false);
  });

  describe("시간 경과", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("7일이 지나기 전까지는 유효하고, 지나면 거부한다", async () => {
      const a = auth();
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const token = await a.createAdminSession();

      vi.setSystemTime(new Date("2026-01-07T23:59:00Z"));
      expect(await a.verifyAdminSession(token)).toBe(true);

      vi.setSystemTime(new Date("2026-01-08T00:01:00Z"));
      expect(await a.verifyAdminSession(token)).toBe(false);
    });
  });

  it("변조된 토큰은 거부한다", async () => {
    const a = auth();
    const [header, , signature] = (await a.createAdminSession()).split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ role: "admin", exp: 9999999999 }),
    ).toString("base64url");
    expect(await a.verifyAdminSession(`${header}.${forgedPayload}.${signature}`)).toBe(
      false,
    );
  });

  it("다른 키로 서명된 토큰은 거부한다", async () => {
    const other = auth({ sessionSecret: "another-secret-that-is-at-least-32-bytes" });
    expect(await auth().verifyAdminSession(await other.createAdminSession())).toBe(false);
  });
});
