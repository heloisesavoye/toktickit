import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, seedFixtures, loginAgent } from "./testUtils.js";

const app = createApp();

describe("POST /api/tickets", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // API-01 / AC-01 (Lab 3: identity now comes from the authenticated session)
  it("creates a ticket and returns a unique ticket number (201)", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.post("/api/tickets").send({
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Laptop battery drains quickly",
      description: "The battery drains fast even when idle.",
      requestedPriority: "MEDIUM",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.data.currentStatus).toBe("NEW");
    expect(res.body.data.requesterId).toBe(requesterA.id);
  });

  // API-02 / AC-04
  it("rejects a blank summary with a field-level 400", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.post("/api/tickets").send({
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "",
      description: "The battery drains fast even when idle.",
      requestedPriority: "MEDIUM",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.summary).toBeTruthy();
  });

  // API-03
  it("rejects an inactive category reference (400)", async () => {
    const { requesterA, relatedSystem } = await seedFixtures();
    const agent = await loginAgent(app, requesterA.email);
    const inactiveCategory = await prisma.category.create({
      data: { name: "Deprecated", isActive: false },
    });

    const res = await agent.post("/api/tickets").send({
      categoryId: inactiveCategory.id,
      relatedSystemId: relatedSystem.id,
      summary: "Valid summary text",
      description: "A description long enough to pass validation.",
      requestedPriority: "LOW",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_REFERENCE");
  });

  // Superseded by Lab 3 auth (AC-06): an inactive user cannot authenticate at
  // all, so "inactive requester creates a ticket" is now impossible to reach
  // via requesterId spoofing — see server/tests/lab-03/auth.api.test.ts.
  it("rejects login for an inactive requester, so their ticket-creation route is unreachable", async () => {
    const { inactiveRequester } = await seedFixtures();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: inactiveRequester.email, password: "TestDev123!" });
    expect(res.status).toBe(401);
  });

  it("requires authentication (401)", async () => {
    const { category, relatedSystem } = await seedFixtures();
    const res = await request(app).post("/api/tickets").send({
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Valid summary text",
      description: "A description long enough to pass validation.",
      requestedPriority: "LOW",
    });
    expect(res.status).toBe(401);
  });
});
