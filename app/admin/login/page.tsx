import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-session";
import { LogoMark } from "../../icons";
import { card } from "../../ui";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <section className={`${card} mx-auto mt-6 w-full max-w-sm p-7`}>
      <div className="mb-6 flex flex-col items-center text-center">
        <LogoMark className="size-11" />
        <h1 className="mt-4 text-xl font-bold">관리자 로그인</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          투표를 만들고 관리하려면 로그인하세요.
        </p>
      </div>
      <LoginForm />
    </section>
  );
}
