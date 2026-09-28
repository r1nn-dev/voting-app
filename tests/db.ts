import { neon } from "@neondatabase/serverless";
import type { Sql } from "@/lib/db";
import { requireEnv } from "@/lib/env";

export const testSql: Sql = neon(requireEnv("TEST_DATABASE_URL"));

export async function resetDatabase() {
  await testSql`TRUNCATE polls RESTART IDENTITY CASCADE`;
}
