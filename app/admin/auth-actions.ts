"use server";

import { redirect } from "next/navigation";
import { endAdminSession, getAdminAuth, startAdminSession } from "@/lib/admin-session";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  // A missing field still goes through verification so it gets the failure delay too.
  const password = formData.get("password");
  if (!(await getAdminAuth().verifyAdminPassword(typeof password === "string" ? password : ""))) {
    return { error: "비밀번호가 올바르지 않습니다." };
  }
  await startAdminSession();
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await endAdminSession();
  redirect("/admin/login");
}
