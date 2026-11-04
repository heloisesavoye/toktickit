import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, seedFixtures, createTicket } from "./helpers.js";

// MIGR-01 — AC-21, BR-20: the Lab 4 migration is additive. A ticket that
// existed before Lab 4 (no version written explicitly, no actions) keeps all
// its Lab 3 data, defaults to version 1, and has zero Actions Taken.
describe("Lab 4 migration: legacy data is preserved", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("legacy tickets keep their data, get version 1 and no actions", async () => {
    const f = await seedFixtures();
    const legacy = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id, {
      currentStatus: "RESOLVED",
      ticketOwnerId: f.staffA.id,
      itPriority: "LOW",
    });
    await prisma.publicComment.create({ data: { ticketId: legacy.id, authorId: f.staffA.id, content: "Lab 3 comment" } });
    await prisma.internalNote.create({ data: { ticketId: legacy.id, authorId: f.staffA.id, content: "Lab 3 note" } });

    const stored = await prisma.ticket.findUniqueOrThrow({
      where: { id: legacy.id },
      include: { comments: true, notes: true, actions: true, statusChanges: true },
    });
    expect(stored.version).toBe(1);
    expect(stored.actions).toHaveLength(0);
    expect(stored.statusChanges).toHaveLength(0);
    expect(stored.currentStatus).toBe("RESOLVED");
    expect(stored.requesterId).toBe(f.requesterA.id);
    expect(stored.ticketOwnerId).toBe(f.staffA.id);
    expect(stored.comments[0].content).toBe("Lab 3 comment");
    expect(stored.notes[0].content).toBe("Lab 3 note");
  });

  it("the migration SQL only adds objects (no DROP/DELETE/UPDATE of existing data)", async () => {
    const fs = await import("node:fs");
    const sql = fs.readFileSync(
      new URL("../../prisma/migrations/20261104000000_lab4_actions_taken/migration.sql", import.meta.url),
      "utf8"
    );
    // "ON UPDATE CASCADE" is a foreign-key option, not a data UPDATE.
    const statements = sql.replace(/--.*$/gm, "").replace(/ON UPDATE CASCADE/g, "");
    expect(statements).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i);
    expect(statements).toMatch(/ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1/);
  });
});

// MIGR-02 — AC-22: the seed is idempotent. Runs the real seed script twice
// against the test database and compares row counts.
describe("Lab 4 seed is idempotent", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("running the seed twice creates no duplicate tickets or actions", async () => {
    // Run tsx through the current Node binary (works on Windows and Unix,
    // unlike spawning `npx`), with this process's test DATABASE_URL.
    const serverDir = fileURLToPath(new URL("../..", import.meta.url));
    const tsxCli = path.join(serverDir, "node_modules", "tsx", "dist", "cli.mjs");
    const run = () =>
      execFileSync(process.execPath, [tsxCli, "prisma/seed.ts"], {
        cwd: serverDir,
        env: process.env,
        stdio: "pipe",
      });
    run();
    const counts1 = {
      tickets: await prisma.ticket.count(),
      actions: await prisma.actionTaken.count(),
      history: await prisma.ticketStatusChange.count(),
      users: await prisma.user.count(),
    };
    run();
    const counts2 = {
      tickets: await prisma.ticket.count(),
      actions: await prisma.actionTaken.count(),
      history: await prisma.ticketStatusChange.count(),
      users: await prisma.user.count(),
    };
    expect(counts2).toEqual(counts1);
    expect(counts1.tickets).toBe(12);

    // Every status is represented (specification.md §7 seed requirement).
    const statuses = await prisma.ticket.groupBy({ by: ["currentStatus"] });
    expect(statuses).toHaveLength(8);

    // The ticket-number sequence is ahead of the seeded numbers, so the
    // next generated number cannot collide (Lab 4 seed fix).
    const seq = await prisma.ticketSequence.findUniqueOrThrow({ where: { year: 2026 } });
    expect(seq.value).toBeGreaterThanOrEqual(12);
  }, 60000);
});
