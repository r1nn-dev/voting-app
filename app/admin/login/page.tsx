import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-session";
import { LoginForm } from "./login-form";

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <section className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">관리자 로그인</h1>
      <LoginForm />
    </section>
  );
}
