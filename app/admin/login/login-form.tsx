"use client";

import { useActionState } from "react";
import { buttonPrimary, fieldError, input, label } from "../../ui";
import { login } from "../auth-actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="password" className={label}>
        비밀번호
      </label>
      <input
        id="password"
        name="password"
        type="password"
        required
        autoFocus
        autoComplete="current-password"
        className={input}
      />
      {state.error && (
        <p aria-live="polite" className={fieldError}>
          {state.error}
        </p>
      )}
      <button disabled={pending} className={`${buttonPrimary} mt-2 w-full py-3`}>
        {pending ? "확인 중…" : "로그인"}
      </button>
    </form>
  );
}
