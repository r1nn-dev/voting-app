import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import Link from "next/link";
import { isAdmin } from "@/lib/admin-session";
import { HeaderNav } from "./header-nav";
import { LogoMark } from "./icons";
import { SERVICE_NAME, SERVICE_TAGLINE, SiteFooter } from "./site-footer";
import { container } from "./ui";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: SERVICE_NAME,
  description: SERVICE_TAGLINE,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-10 border-b border-zinc-200/70 bg-white/80 backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/80">
          <div className={`${container} flex h-14 items-center justify-between`}>
            <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
              <LogoMark />
              {SERVICE_NAME}
            </Link>
            <HeaderNav signedIn={await isSignedIn()} />
          </div>
        </header>
        <main className={`${container} flex-1 pt-8`}>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}

/** Header hint only: a missing admin env var must not take public pages down with it. */
async function isSignedIn(): Promise<boolean> {
  try {
    return await isAdmin();
  } catch {
    return false;
  }
}
