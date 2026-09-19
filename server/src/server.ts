import process from "node:process";

// tsx (unlike the Prisma CLI) does not auto-load server/.env, whether run
// directly or via `tsx watch`. Without this, `npm run dev` starts with
// DATABASE_URL undefined-or-stale and every DB-backed route (including
// login) silently misbehaves instead of failing loudly.
try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
  console.log("[startup] loaded server/.env");
} catch (e) {
  console.log("[startup] could not load server/.env:", (e as Error).message);
}
try {
  const dbName = new URL(process.env.DATABASE_URL ?? "").pathname;
  console.log(`[startup] DATABASE_URL points at database: ${dbName || "(unset)"}`);
} catch {
  console.log("[startup] DATABASE_URL is unset or unparseable");
}

const { createApp } = await import("./app.js");

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
const app = createApp();

app.listen(port, () => {
  console.log(`TokTickIT API listening on http://localhost:${port}`);
});
