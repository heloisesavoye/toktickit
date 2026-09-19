import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, seedFixtures, loginAgent } from "./testUtils.js";
import { generateTicketNumber } from "../../src/lib/ticketNumber.js";

const app = createApp();

async function createTicket(requesterId: number, categoryId: number, relatedSystemId: number, overrides: any = {}) {
  return prisma.ticket.create({
    data: {
      ticketNumber: await generateTicketNumber(prisma),
      requesterId,
      categoryId,
      relatedSystemId,
      summary: "Sample ticket summary",
      description: "Sample ticket description text.",
      requestedPriority: "MEDIUM",
      ...overrides,
    },
  });
}

describe("GET /api/tickets", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // API-06 / AC-08 (Lab 3: identity from the authenticated session)
  it("returns EMPTY state when the requester has never created a ticket", async () => {
    const { requesterA } = await seedFixtures();
    const agent = await loginAgent(app, requesterA.email);
    const res = await agent.get("/api/tickets");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.state).toBe("EMPTY");
  });

  // API-07 / AC-09
  it("returns NO_RESULTS state when search matches nothing", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.get("/api/tickets?search=zzzz-no-match");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.state).toBe("NO_RESULTS");
  });

  // API-08 / AC-10
  it("paginates correctly across pages", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    for (let i = 0; i < 15; i++) {
      await createTicket(requesterA.id, category.id, relatedSystem.id, { summary: `Ticket ${i}` });
    }
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.get("/api/tickets?page=2&pageSize=10");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
    expect(res.body.meta.totalItems).toBe(15);
    expect(res.body.meta.totalPages).toBe(2);
  });

  // API-09 / BR-19 (Lab 2 numbering; see docs/lab-03/tests.md API-14 for the staff-queue equivalent)
  it("falls back to default sort on an invalid sortBy value instead of erroring", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.get("/api/tickets?sortBy=not_a_real_field");
    expect(res.status).toBe(200);
  });

  // API-05 / AC-03: ownership isolation, checked via GET /:id — a spoofed
  // requesterId in the query string is ignored; only the session counts.
  it("does not return another requester's ticket even if requesterId is spoofed in the query", async () => {
    const { requesterA, requesterB, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterB.email);

    const res = await agent.get(`/api/tickets/${ticket.id}?requesterId=${requesterA.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TICKET_NOT_FOUND");
  });
});
