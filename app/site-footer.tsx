import Link from "next/link";
import { LogoMark } from "./icons";

const MAKER = "조하린";
const REPOSITORY = "github.com/r1nn-dev/voting-app";

/** Site footer laid out like a service's business-info footer, with the maker's name. */
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:flex-row sm:gap-10">
        <Link href="/" className="flex shrink-0 items-center gap-2 self-start font-bold tracking-tight">
          <LogoMark className="size-6" />
          투표
        </Link>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm text-zinc-500 dark:text-zinc-400">
          <dt>서비스명</dt>
          <dd className="text-zinc-700 dark:text-zinc-300">투표 · 질문 하나, 선택지 하나</dd>
          <dt>만든 사람</dt>
          <dd className="font-medium text-zinc-700 dark:text-zinc-300">{MAKER}</dd>
          <dt>GitHub</dt>
          <dd>
            <a
              href={`https://${REPOSITORY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-700 underline-offset-2 hover:text-indigo-600 hover:underline dark:text-zinc-300 dark:hover:text-indigo-400"
            >
              {REPOSITORY}
            </a>
          </dd>
        </dl>
      </div>

      <div className="border-t border-zinc-100 dark:border-zinc-900">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-zinc-400 dark:text-zinc-500">
          <p>© {new Date().getFullYear()} {MAKER}. All Rights Reserved.</p>
          <nav className="flex gap-4">
            <Link href="/" className="hover:text-zinc-700 dark:hover:text-zinc-300">
              투표 목록
            </Link>
            <Link href="/admin" className="hover:text-zinc-700 dark:hover:text-zinc-300">
              관리자
            </Link>
            <a
              href={`https://${REPOSITORY}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-zinc-700 dark:hover:text-zinc-300"
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
