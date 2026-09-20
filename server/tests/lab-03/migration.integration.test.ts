import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { verifyPassword, hashPassword } from "../../src/lib/auth.js";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase } from "./testUtils.js";

const app = createApp();

// MIGR-01/02 (docs/lab-03/tests.md): the hand-written migration
// (20260919100000_lab3_users_roles) sets every migrated Requester's
// passwordHash to the sentinel 'MIGRATION_PENDING_SEED_RESET' rather than a
// fabricated hash, because raw SQL cannot compute a real bcrypt hash. These
// tests exercise that contract at the application layer: the sentinel must
// never validate as a password, and `npm run seed`'s upsert-by-email fixup
// is what turns it into a real, working credential.
describe("Migration: password-hash sentinel fails safe", () => {
  const SENTINEL = "MIGRATION_PENDING_SEED_RESET";

  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("verifyPassword() never matches any password against the sentinel value", async () => {
    expect(await verifyPassword("anything", SENTINEL)).toBe(false);
    expect(await verifyPassword("", SENTINEL)).toBe(false);
    expect(await verifyPassword(SENTINEL, SENTINEL)).toBe(false);
  });

  it("a migrated user still carrying the sentinel cannot log in", async () => {
    const migratedUser = await prisma.user.create({
      data: {
        name: "Migrated Requester",
        email: "migrated@example.com",
        role: "REQUESTER",
        isActive: true,
        passwordHash: SENTINEL,
        requiresPasswordChange: false,
      },
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: migratedUser.email, password: "AnyGuess123!" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("re-running the seed's upsert-by-email pattern replaces the sentinel with a real hash that logs in", async () => {
    const email = "migrated-fixup@example.com";
    await prisma.user.create({
      data: {
        name: "Migrated Requester",
        email,
        role: "REQUESTER",
        isActive: true,
        passwordHash: SENTINEL,
        requiresPasswordChange: false,
      },
    });

    // Mirrors seed.ts's fixup: upsert by email with a freshly computed hash.
    const realPasswordHash = await hashPassword("RequesterDev123!");
    await prisma.user.upsert({
      where: { email },
      update: { passwordHash: realPasswordHash },
      create: {
        name: "Migrated Requester",
        email,
        role: "REQUESTER",
        isActive: true,
        passwordHash: realPasswordHash,
        requiresPasswordChange: false,
      },
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password: "RequesterDev123!" });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(email);
  });
});
