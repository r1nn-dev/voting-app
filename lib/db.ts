import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { requireEnv } from "./env";

export type Sql = NeonQueryFunction<false, false>;

let sql: Sql | undefined;

export function getSql(): Sql {
  sql ??= neon(requireEnv("DATABASE_URL"));
  return sql;
}
