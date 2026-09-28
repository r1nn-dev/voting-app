"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-session";
import { getSql } from "@/lib/db";
import { createPolls, type CreatePollErrors } from "@/lib/polls";

export type CreatePollState = { errors?: CreatePollErrors };

export async function createPollAction(
  _prev: CreatePollState,
  formData: FormData,
): Promise<CreatePollState> {
  await requireAdmin();

  const result = await createPolls(getSql()).createPoll({
    question: String(formData.get("question") ?? ""),
    options: formData.getAll("option").map(String),
  });
  if (!result.ok) return { errors: result.errors };

  revalidatePath("/");
  revalidatePath("/admin");
  redirect("/admin");
}

export async function closePollAction(pollId: string): Promise<void> {
  await requireAdmin();

  // A poll deleted in another tab is already gone; nothing to report.
  await createPolls(getSql()).closePoll(pollId);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/polls/${pollId}`);
}

export async function deletePollAction(pollId: string): Promise<void> {
  await requireAdmin();

  await createPolls(getSql()).deletePoll(pollId);

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/polls/${pollId}`);
}
