// Shared class names, so every card, button and input looks the same.

/** The one page width, used by the header, main content and footer. */
export const container = "mx-auto w-full max-w-5xl px-5 sm:px-8";

export const card =
  "rounded-2xl border border-zinc-200/80 bg-white shadow-sm shadow-zinc-900/[0.03] dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none";

export const cardPadding = "p-5 sm:p-6";

const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-xl text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:pointer-events-none disabled:opacity-50";

export const buttonPrimary = `${buttonBase} bg-indigo-600 px-4 py-2.5 text-white shadow-sm hover:bg-indigo-700 active:bg-indigo-800 dark:bg-indigo-500 dark:hover:bg-indigo-400`;

export const buttonSecondary = `${buttonBase} border border-zinc-300 bg-white px-3.5 py-2 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800`;

export const buttonGhost = `${buttonBase} px-3 py-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800`;

export const buttonDanger = `${buttonBase} px-3 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/60`;

export const input =
  "w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-[15px] shadow-sm shadow-zinc-900/[0.02] transition placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:focus:border-indigo-400";

export const label = "text-sm font-semibold text-zinc-800 dark:text-zinc-200";

export const hint = "text-sm text-zinc-500 dark:text-zinc-400";

export const fieldError = "text-sm font-medium text-red-600 dark:text-red-400";

export const backLink =
  "inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-900 dark:hover:text-zinc-100";
