import { requireEnv } from "@/lib/env";
import { migrate } from "@/scripts/migrate.mts";

export default async function setup() {
  await migrate(requireEnv("TEST_DATABASE_URL"));
}
