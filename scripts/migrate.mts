// Applies pending SQL files in db/migrations to the database at the given URL,
// recording each one in schema_migrations. Safe to run repeatedly.
//
// Usage: npm run db:migrate            (DATABASE_URL)
//        npm run db:migrate -- --test  (TEST_DATABASE_URL)
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "@neondatabase/serverless";

const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "db", "migrations");

export async function migrate(connectionString: string): Promise<string[]> {
  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations",
    );
    const done = new Set(rows.map((row) => row.name));
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (done.has(file)) continue;
      const body = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(body);
        await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [
          file,
        ]);
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw new Error(`마이그레이션 ${file} 적용 실패`, { cause: error });
      }
      applied.push(file);
    }
  } finally {
    client.release();
    await pool.end();
  }
  return applied;
}

if (import.meta.main) {
  const variable = process.argv.includes("--test")
    ? "TEST_DATABASE_URL"
    : "DATABASE_URL";
  const url = process.env[variable];
  if (!url) {
    console.error(`환경변수 ${variable}이(가) 설정되지 않았습니다.`);
    process.exit(1);
  }
  const applied = await migrate(url);
  console.log(
    applied.length
      ? `적용됨: ${applied.join(", ")}`
      : "적용할 마이그레이션이 없습니다.",
  );
}
