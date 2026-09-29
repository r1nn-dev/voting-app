import Link from "next/link";
import { buttonSecondary, card } from "./ui";

export default function NotFound() {
  return (
    <section className={`${card} px-6 py-14 text-center`}>
      <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">404</p>
      <h1 className="mt-2 text-xl font-bold">찾을 수 없음</h1>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">투표가 없거나 삭제되었습니다.</p>
      <Link href="/" className={`${buttonSecondary} mt-6`}>
        목록으로
      </Link>
    </section>
  );
}
