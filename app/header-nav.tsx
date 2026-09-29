"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "./admin/auth-actions";

const itemBase = "rounded-full px-3 py-1.5 text-sm font-medium transition";
const itemIdle =
  "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100";
const itemActive = "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";

/**
 * Both sections are always one click away, the current one highlighted.
 * `signedIn` only decides whether to offer 로그아웃; admin pages still check
 * the session on the server.
 */
export function HeaderNav({ signedIn }: { signedIn: boolean }) {
  const inAdmin = usePathname().startsWith("/admin");

  return (
    <nav className="flex items-center gap-1">
      <Link
        href="/"
        aria-current={inAdmin ? undefined : "page"}
        className={`${itemBase} ${inAdmin ? itemIdle : itemActive}`}
      >
        투표 목록
      </Link>
      <Link
        href="/admin"
        aria-current={inAdmin ? "page" : undefined}
        className={`${itemBase} ${inAdmin ? itemActive : itemIdle}`}
      >
        관리자
      </Link>
      {signedIn && (
        <>
          <span aria-hidden className="mx-1.5 h-4 w-px bg-zinc-200 dark:bg-zinc-700" />
          <form action={logout}>
            <button className={`${itemBase} ${itemIdle}`}>로그아웃</button>
          </form>
        </>
      )}
    </nav>
  );
}
