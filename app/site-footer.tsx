import Link from "next/link";
import { LogoMark } from "./icons";
import { container } from "./ui";

export const SERVICE_NAME = "한표";
export const SERVICE_TAGLINE = "질문 하나, 선택지 하나. 가볍게 던지는 한 표";

const MAKER = "조하린";
export const REPOSITORY = "github.com/r1nn-dev/voting-app";

const LINKS = [
  { label: "도움말", href: "/help" },
  { label: "이용약관", href: "/terms" },
  { label: "GitHub 저장소", href: `https://${REPOSITORY}`, external: true },
];

/** Small-print footer: links, one line of service info, then the copyright. */
export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-zinc-200 bg-white text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
      <div className={`${container} flex flex-col gap-3 py-7`}>
        <nav className="flex flex-wrap items-center gap-y-1 text-[13px] text-zinc-700 dark:text-zinc-300">
          {LINKS.map((link, index) => (
            <span key={link.label} className="flex items-center">
              {index > 0 && (
                <span aria-hidden className="mx-3 h-3 w-px bg-zinc-300 dark:bg-zinc-700" />
              )}
              {link.external ? (
                <a
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  href={link.href}
                  className="hover:text-indigo-600 hover:underline dark:hover:text-indigo-400"
                >
                  {link.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <p className="flex flex-wrap gap-x-4 gap-y-1 leading-relaxed">
          <span>서비스명 : {SERVICE_NAME}</span>
          <span>제작 : {MAKER}</span>
          <span>GitHub : {REPOSITORY}</span>
        </p>

        <p className="flex items-center gap-2 pt-1 text-zinc-400 dark:text-zinc-500">
          <LogoMark className="size-4 rounded" />
          <span>
            © {new Date().getFullYear()} {SERVICE_NAME}. All rights reserved.
          </span>
        </p>
      </div>
    </footer>
  );
}
