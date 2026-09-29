import Link from "next/link";
import { ArrowLeftIcon } from "./icons";
import { backLink, card } from "./ui";

/** Layout for public text pages (도움말, 이용약관). */
export function DocPage({
  title,
  intro,
  updated,
  children,
}: {
  title: string;
  intro: string;
  /** Shown as "최종 수정일". */
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link href="/" className={backLink}>
        <ArrowLeftIcon className="size-4" />
        투표 목록
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-zinc-500 dark:text-zinc-400">{intro}</p>
        {updated && <p className="mt-1 text-xs text-zinc-400">최종 수정일 {updated}</p>}
      </div>
      <article className={`${card} flex flex-col gap-9 p-6 sm:p-8`}>{children}</article>
    </div>
  );
}

export function DocSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-base font-bold">{title}</h2>
      <div className="flex flex-col gap-2.5 text-[14.5px] leading-7 text-zinc-700 dark:text-zinc-300 [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ol>li]:list-decimal [&_strong]:font-semibold [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100">
        {children}
      </div>
    </section>
  );
}

/** One question and answer, collapsible without JavaScript. */
export function Faq({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-xl border border-zinc-200 px-4 py-3 open:bg-zinc-50/60 dark:border-zinc-800 dark:open:bg-zinc-800/40">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-zinc-900 dark:text-zinc-100 [&::-webkit-details-marker]:hidden">
        {question}
        <span aria-hidden className="text-zinc-400 transition group-open:rotate-45">
          +
        </span>
      </summary>
      <div className="mt-2 text-zinc-600 dark:text-zinc-400">{children}</div>
    </details>
  );
}
