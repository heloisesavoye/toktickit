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

// Lab 3's Requester screens are Lab 2's, carried over onto session auth
// (FR-09, FR-10). These confirm the new "appears resolved" flag (FR-10)
// without disturbing status, which stays IT Staff/Administrator-only.
describe("Requester regression: resolution flag", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("lets a Requester flag their own ticket as appearing resolved", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id, { currentStatus: "IN_PROGRESS" });
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.post(`/api/tickets/${ticket.id}/resolution-flag`);
    expect(res.status).toBe(200);
    expect(res.body.data.appearsResolved).toBe(true);

    const detail = await agent.get(`/api/tickets/${ticket.id}`);
    // BR-05, BR-17: flagging never changes currentStatus itself.
    expect(detail.body.data.currentStatus).toBe("IN_PROGRESS");
  });

  it("blocks flagging another requester's ticket as resolved", async () => {
    const { requesterA, requesterB, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterB.email);

    const res = await agent.post(`/api/tickets/${ticket.id}/resolution-flag`);
    expect(res.status).toBe(404);
  });

  it("still returns the ticket owner's public comments in the Requester's own ticket detail", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const staffAgent = await loginAgent(app, staffA.email);
    await staffAgent.post(`/api/tickets/${ticket.id}/comments`).send({ content: "We're on it." });

    const requesterAgent = await loginAgent(app, requesterA.email);
    const detail = await requesterAgent.get(`/api/tickets/${ticket.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.comments).toHaveLength(1);
    expect(detail.body.data.comments[0].content).toBe("We're on it.");
  });
});
