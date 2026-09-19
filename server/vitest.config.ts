import { defineConfig } from "vitest/config";
import process from "node:process";

// Vitest doesn't auto-load .env the way the Prisma CLI does; load it here so
// DATABASE_URL (and anything else in server/.env) reaches the test process.
try {
  process.loadEnvFile(new URL("./.env", import.meta.url));
} catch {
  // No .env present (e.g. CI providing DATABASE_URL another way) — fine.
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
