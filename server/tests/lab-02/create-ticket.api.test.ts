import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, seedFixtures } from "./testUtils.js";

const app = createApp();

describe("POST /api/tickets", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // API-01 / AC-01
  it("creates a ticket and returns a unique ticket number (201)", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();

    const res = await request(app).post("/api/tickets").send({
      requesterId: requesterA.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Laptop battery drains quickly",
      description: "The battery drains fast even when idle.",
      requestedPriority: "MEDIUM",
    });

    expect(res.status).toBe(201);
    expect(res.body.data.ticketNumber).toMatch(/^TKT-\d{4}-\d{6}$/);
    expect(res.body.data.currentStatus).toBe("NEW");
  });

  // API-02 / AC-04
  it("rejects a blank summary with a field-level 400", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();

    const res = await request(app).post("/api/tickets").send({
      requesterId: requesterA.id,
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

  // API-03 / BR-09
  it("rejects an inactive category reference (400)", async () => {
    const { requesterA, relatedSystem } = await seedFixtures();
    const inactiveCategory = await prisma.category.create({
      data: { name: "Deprecated", isActive: false },
    });

    const res = await request(app).post("/api/tickets").send({
      requesterId: requesterA.id,
      categoryId: inactiveCategory.id,
      relatedSystemId: relatedSystem.id,
      summary: "Valid summary text",
      description: "A description long enough to pass validation.",
      requestedPriority: "LOW",
    });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_REFERENCE");
  });

  // API-04 / BR-05
  it("rejects ticket creation for an inactive requester (403)", async () => {
    const { inactiveRequester, category, relatedSystem } = await seedFixtures();

    const res = await request(app).post("/api/tickets").send({
      requesterId: inactiveRequester.id,
      categoryId: category.id,
      relatedSystemId: relatedSystem.id,
      summary: "Valid summary text",
      description: "A description long enough to pass validation.",
      requestedPriority: "LOW",
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("REQUESTER_INACTIVE");
  });
});
