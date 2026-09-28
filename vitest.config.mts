import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    globalSetup: ["./tests/global-setup.ts"],
    // Integration tests share one database and truncate it between tests.
    fileParallelism: false,
  },
});
