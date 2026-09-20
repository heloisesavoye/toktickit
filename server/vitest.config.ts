import { defineConfig } from "vitest/config";
import process from "node:process";
import fs from "node:fs";

// Vitest doesn't auto-load .env the way the Prisma CLI does; load it here so
// DATABASE_URL (and anything else in server/.env) reaches the test process.
//
// IMPORTANT: the test suite truncates every table between tests
// (see tests/lab-03/testUtils.ts resetDatabase()). Running it against the
// same database as `npm run dev`/`npm run seed` silently wipes your seeded
// dev accounts (admin@toktickit.local and friends) every time you run
// `npm test`. Prefer a dedicated `.env.test` pointing at a disposable
// database (see server/.env.test.example); it's loaded first and wins over
// `.env` if both exist.
const envTestUrl = new URL("./.env.test", import.meta.url);
try {
  if (fs.existsSync(envTestUrl)) {
    process.loadEnvFile(envTestUrl);
  } else {
    process.loadEnvFile(new URL("./.env", import.meta.url));
  }
} catch {
  // No .env/.env.test present (e.g. CI providing DATABASE_URL another way) — fine.
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    hookTimeout: 20000,
    fileParallelism: false,
  },
});
