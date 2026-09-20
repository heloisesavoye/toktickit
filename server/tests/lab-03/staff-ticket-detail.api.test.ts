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

// FR-13: the IT Staff Ticket Detail assembles everything an agent needs in
// one call — requester, owner, attachments, public comments and internal
// notes together (unlike the Requester's own detail view, which never sees notes).
describe("IT Staff Ticket Detail", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("returns 404 for a nonexistent ticket id", async () => {
    const { staffA } = await seedFixtures();
    const agent = await loginAgent(app, staffA.email);
    const res = await agent.get("/api/staff/tickets/999999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TICKET_NOT_FOUND");
  });

  it("assembles requester, owner, comments, and notes in one response", async () => {
    const { requesterA, staffA, staffB, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id, { ticketOwnerId: staffB.id });

    const staffAgent = await loginAgent(app, staffA.email);
    await staffAgent.post(`/api/tickets/${ticket.id}/comments`).send({ content: "Public update." });
    await staffAgent.post(`/api/tickets/${ticket.id}/notes`).send({ content: "Internal-only diagnosis." });

    const res = await staffAgent.get(`/api/staff/tickets/${ticket.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.requester.email).toBe(requesterA.email);
    expect(res.body.data.ticketOwner.id).toBe(staffB.id);
    expect(res.body.data.comments).toHaveLength(1);
    expect(res.body.data.notes).toHaveLength(1);
    expect(res.body.data.notes[0].content).toBe("Internal-only diagnosis.");
  });

  it("blocks a Requester from the staff detail route entirely (403)", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.get(`/api/staff/tickets/${ticket.id}`);
    expect(res.status).toBe(403);
  });
});
