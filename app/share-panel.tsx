"use client";

import Link from "next/link";
import { useState } from "react";
import { buttonSecondary } from "./ui";

/**
 * Link copy and QR for one poll. `qrSvg` is generated on the server by the
 * qrcode library from our own URL, so rendering it as markup is safe.
 */
export function SharePanel({
  url,
  qrSvg,
  presentHref,
}: {
  url: string;
  qrSvg: string;
  /** Admin only: link to the full-screen QR view. */
  presentHref?: string;
}) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const [showQr, setShowQr] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopy("copied");
      setTimeout(() => setCopy("idle"), 2000);
    } catch {
      setCopy("failed");
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copyLink} className={buttonSecondary}>
          {copy === "copied" ? "복사됨 ✓" : "링크 복사"}
        </button>
        <button
          type="button"
          onClick={() => setShowQr((open) => !open)}
          aria-expanded={showQr}
          className={buttonSecondary}
        >
          {showQr ? "QR 닫기" : "QR 보기"}
        </button>
        {presentHref && (
          <Link href={presentHref} className={buttonSecondary}>
            QR 크게 보기
          </Link>
        )}
      </div>

      {copy === "failed" && (
        <input
          readOnly
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          aria-label="투표 주소"
          className="w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      )}

      {showQr && (
        <div className="flex flex-col items-center gap-2 self-start rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-700">
          <div
            role="img"
            aria-label="투표 주소 QR 코드"
            className="size-44 [&_svg]:size-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <span className="text-xs text-zinc-500">휴대폰 카메라로 비추면 투표로 이동합니다</span>
        </div>
      )}
    </div>
  );
}
