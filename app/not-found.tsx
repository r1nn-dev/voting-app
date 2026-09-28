import Link from "next/link";

export default function NotFound() {
  return (
    <section className="text-center">
      <h1 className="mb-2 text-2xl font-bold">찾을 수 없음</h1>
      <p className="mb-6 text-zinc-500">투표가 없거나 삭제되었습니다.</p>
      <Link href="/" className="hover:underline">
        목록으로
      </Link>
    </section>
  );
}
