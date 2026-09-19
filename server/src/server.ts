import process from "node:process";

// tsx (unlike the Prisma CLI) does not auto-load server/.env, whether run
// directly or via `tsx watch`. Without this, `npm run dev` starts with
// DATABASE_URL undefined-or-stale and every DB-backed route (including
// login) silently misbehaves instead of failing loudly.
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // No .env present (e.g. DATABASE_URL provided another way) — fine.
}

const { createApp } = await import("./app.js");

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`TokTickIT API listening on http://localhost:${port}`);
});
