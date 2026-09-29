import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "투표",
  description: "질문 하나, 선택지 하나를 고르는 간단한 투표",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-semibold">
              투표
            </Link>
            <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
              관리자
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
