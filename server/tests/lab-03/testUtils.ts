import request from "supertest";
import type { Express } from "express";
import { prisma } from "../../src/lib/prisma.js";
import { hashPassword } from "../../src/lib/auth.js";

// Shared fixtures for Lab 3 API tests (auth, staff, admin). Requires a real
// test database (set DATABASE_URL to a disposable DB before running `npm test`).
//
// Safety guard: this function truncates every table. Running it against the
// same database used by `npm run dev`/`npm run seed` silently wipes your
// seeded dev accounts. Refuse to run unless DATABASE_URL clearly points at a
// throwaway test database (name contains "test"), so a missing/misconfigured
// server/.env.test fails loudly instead of quietly destroying dev data.
function assertTestDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/test/i.test(url)) {
    throw new Error(
      "resetDatabase() refused to run: DATABASE_URL does not look like a test " +
        "database (expected the database name to contain \"test\"). Copy " +
        "server/.env.test.example to server/.env.test and point it at a " +
        "disposable database before running `npm test` — otherwise this " +
        "wipes the accounts created by `npm run seed`."
    );
  }
}

export async function resetDatabase() {
  assertTestDatabase();
  await prisma.publicComment.deleteMany();
  await prisma.internalNote.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.ticketSequence.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.category.deleteMany();
  await prisma.relatedSystem.deleteMany();
}

export const TEST_PASSWORD = "TestDev123!";

export async function seedFixtures() {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [requesterA, requesterB, inactiveRequester, staffA, staffB, adminA, inactiveAdmin, pendingChange] =
    await Promise.all([
      prisma.user.create({
        data: { name: "Requester A", email: "a@example.com", role: "REQUESTER", isActive: true, passwordHash, requiresPasswordChange: false },
      }),
      prisma.user.create({
        data: { name: "Requester B", email: "b@example.com", role: "REQUESTER", isActive: true, passwordHash, requiresPasswordChange: false },
      }),
      prisma.user.create({
        data: { name: "Inactive R", email: "inactive@example.com", role: "REQUESTER", isActive: false, passwordHash, requiresPasswordChange: false },
      }),
      prisma.user.create({
        data: { name: "Staff A", email: "staff-a@example.com", role: "IT_STAFF", isActive: true, passwordHash, requiresPasswordChange: false },
      }),
      prisma.user.create({
        data: { name: "Staff B", email: "staff-b@example.com", role: "IT_STAFF", isActive: true, passwordHash, requiresPasswordChange: false },
      }),
      prisma.user.create({
        data: { name: "Admin A", email: "admin-a@example.com", role: "ADMINISTRATOR", isActive: true, passwordHash, requiresPasswordChange: false },
      }),
      prisma.user.create({
        data: { name: "Inactive Admin", email: "inactive-admin@example.com", role: "ADMINISTRATOR", isActive: false, passwordHash, requiresPasswordChange: false },
      }),
      prisma.user.create({
        data: { name: "Pending Change", email: "pending@example.com", role: "REQUESTER", isActive: true, passwordHash, requiresPasswordChange: true },
      }),
    ]);
  const category = await prisma.category.create({ data: { name: "Hardware", isActive: true } });
  const relatedSystem = await prisma.relatedSystem.create({
    data: { name: "Corporate Laptop", isActive: true },
  });
  return {
    requesterA,
    requesterB,
    inactiveRequester,
    staffA,
    staffB,
    adminA,
    inactiveAdmin,
    pendingChange,
    category,
    relatedSystem,
  };
}

// Logs the given email in against `app` and returns a supertest agent that
// carries the resulting session cookie on every subsequent request.
export async function loginAgent(app: Express, email: string, password = TEST_PASSWORD) {
  const agent = request.agent(app);
  const res = await agent.post("/api/auth/login").send({ email, password });
  if (res.status !== 200) {
    throw new Error(`loginAgent: login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return agent;
}
