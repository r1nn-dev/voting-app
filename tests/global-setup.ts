import { migrate } from "@/scripts/migrate.mts";

// Without a test database only the DB-free suites (admin auth) can run; the
// poll module suite fails fast in tests/db.ts naming the missing variable.
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (url) await migrate(url);
}
