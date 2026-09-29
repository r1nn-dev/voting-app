import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Link from "next/link";
import { LogoMark } from "./icons";
import { SiteFooter } from "./site-footer";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "투표",
  description: "질문 하나, 선택지 하나를 고르는 간단한 투표",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/80">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
              <LogoMark />
              투표
            </Link>
            <Link
              href="/admin"
              className="rounded-full px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              관리자
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-10">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
