import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, seedFixtures } from "./testUtils.js";
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

  // API-06 / AC-08
  it("returns EMPTY state when the requester has never created a ticket", async () => {
    const { requesterA } = await seedFixtures();
    const res = await request(app).get(`/api/tickets?requesterId=${requesterA.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.state).toBe("EMPTY");
  });

  // API-07 / AC-09
  it("returns NO_RESULTS state when search matches nothing", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    await createTicket(requesterA.id, category.id, relatedSystem.id);

    const res = await request(app).get(
      `/api/tickets?requesterId=${requesterA.id}&search=zzzz-no-match`
    );
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

    const res = await request(app).get(
      `/api/tickets?requesterId=${requesterA.id}&page=2&pageSize=10`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(5);
    expect(res.body.meta.totalItems).toBe(15);
    expect(res.body.meta.totalPages).toBe(2);
  });

  // API-09 / BR-19
  it("falls back to default sort on an invalid sortBy value instead of erroring", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    await createTicket(requesterA.id, category.id, relatedSystem.id);

    const res = await request(app).get(
      `/api/tickets?requesterId=${requesterA.id}&sortBy=not_a_real_field`
    );
    expect(res.status).toBe(200);
  });

  // API-05 / AC-03: ownership isolation, checked via GET /:id
  it("does not return another requester's ticket", async () => {
    const { requesterA, requesterB, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);

    const res = await request(app).get(`/api/tickets/${ticket.id}?requesterId=${requesterB.id}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TICKET_NOT_FOUND");
  });
});
