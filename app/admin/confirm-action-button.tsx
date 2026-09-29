"use client";

import { useState, useTransition } from "react";
import { buttonDanger, buttonGhost, buttonSecondary } from "../ui";

/** A button that asks for confirmation inline before running a Server Action. */
export function ConfirmActionButton({
  action,
  label,
  confirmMessage,
  tone = "neutral",
}: {
  action: () => Promise<void>;
  label: string;
  confirmMessage: string;
  tone?: "neutral" | "danger";
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={tone === "danger" ? `${buttonDanger} border border-red-200 dark:border-red-900` : buttonSecondary}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      className={`flex flex-wrap items-center gap-2 rounded-xl px-3 py-1.5 text-sm ${
        tone === "danger" ? "bg-red-50 dark:bg-red-950/40" : "bg-zinc-100 dark:bg-zinc-800"
      }`}
    >
      <span className="text-zinc-700 dark:text-zinc-300">{confirmMessage}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(action)}
        className={`${
          tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
        } rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50`}
      >
        {pending ? "처리 중…" : label}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className={`${buttonGhost} px-2 py-1.5`}
      >
        취소
      </button>
    </span>
  );
}
