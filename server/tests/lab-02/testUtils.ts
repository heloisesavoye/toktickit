import request from "supertest";
import type { Express } from "express";
import { prisma } from "../../src/lib/prisma.js";
import { hashPassword } from "../../src/lib/auth.js";

// Shared fixtures for lab-02 API tests, updated for Lab 3 authentication.
// Requires a real test database (set DATABASE_URL to a disposable DB before
// running `npm run test`).
export async function resetDatabase() {
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

const TEST_PASSWORD = "TestDev123!";

export async function seedFixtures() {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const [requesterA, requesterB, inactiveRequester] = await Promise.all([
    prisma.user.create({
      data: { name: "Requester A", email: "a@example.com", role: "REQUESTER", isActive: true, passwordHash, requiresPasswordChange: false },
    }),
    prisma.user.create({
      data: { name: "Requester B", email: "b@example.com", role: "REQUESTER", isActive: true, passwordHash, requiresPasswordChange: false },
    }),
    prisma.user.create({
      data: { name: "Inactive R", email: "inactive@example.com", role: "REQUESTER", isActive: false, passwordHash, requiresPasswordChange: false },
    }),
  ]);
  const category = await prisma.category.create({ data: { name: "Hardware", isActive: true } });
  const relatedSystem = await prisma.relatedSystem.create({
    data: { name: "Corporate Laptop", isActive: true },
  });
  return { requesterA, requesterB, inactiveRequester, category, relatedSystem };
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
