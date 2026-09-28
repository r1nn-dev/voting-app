"use client";

import { useActionState } from "react";
import { login } from "../auth-actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="password" className="text-sm font-medium">
        비밀번호
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        className="rounded-md border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
      />
      {state.error && (
        <p aria-live="polite" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
