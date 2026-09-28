"use client";

import { useState, useTransition } from "react";

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
  const color =
    tone === "danger"
      ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
      : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800";

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={`rounded-md px-2 py-1 text-sm ${color}`}
      >
        {label}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-zinc-600 dark:text-zinc-400">{confirmMessage}</span>
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(action)}
        className={`rounded-md px-2 py-1 font-medium disabled:opacity-50 ${color}`}
      >
        {pending ? "처리 중…" : label}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setConfirming(false)}
        className="rounded-md px-2 py-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        취소
      </button>
    </span>
  );
}
