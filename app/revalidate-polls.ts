import { revalidatePath } from "next/cache";

/** Refreshes every page that shows poll data: both lists and, if given, the poll's own pages. */
export function revalidatePollPages(pollId?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  if (pollId) {
    revalidatePath(`/polls/${pollId}`);
    revalidatePath(`/admin/polls/${pollId}`);
  }
}
