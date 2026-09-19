import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
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

describe("IT Staff Ticket Queue", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // API-14 / FR-11: the queue shows every ticket regardless of owner.
  it("lists tickets from multiple requesters", async () => {
    const { requesterA, requesterB, staffA, category, relatedSystem } = await seedFixtures();
    await createTicket(requesterA.id, category.id, relatedSystem.id);
    await createTicket(requesterB.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.get("/api/staff/tickets");
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(2);
    expect(res.body.state).toBe("OK");
  });

  it("returns EMPTY state when there are no tickets at all", async () => {
    const { staffA } = await seedFixtures();
    const agent = await loginAgent(app, staffA.email);
    const res = await agent.get("/api/staff/tickets");
    expect(res.body.state).toBe("EMPTY");
  });

  // BR-20: filter by status
  it("filters by status", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    await createTicket(requesterA.id, category.id, relatedSystem.id, { currentStatus: "NEW" });
    await createTicket(requesterA.id, category.id, relatedSystem.id, { currentStatus: "RESOLVED" });
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.get("/api/staff/tickets?status=RESOLVED");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].currentStatus).toBe("RESOLVED");
  });

  // filter by unassigned owner
  it("filters unassigned tickets with ownerId=unassigned", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const owned = await createTicket(requesterA.id, category.id, relatedSystem.id);
    await createTicket(requesterA.id, category.id, relatedSystem.id);
    await prisma.ticket.update({ where: { id: owned.id }, data: { ticketOwnerId: staffA.id } });
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.get("/api/staff/tickets?ownerId=unassigned");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].ticketOwnerId).toBeNull();
  });

  // API-15 / FR-14, BR-13: claiming an unassigned ticket
  it("lets IT Staff claim an unassigned ticket", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.post(`/api/staff/tickets/${ticket.id}/claim`);
    expect(res.status).toBe(200);
    expect(res.body.data.ticketOwnerId).toBe(staffA.id);
  });

  // BR-14: claiming a ticket already owned by someone else is rejected
  it("rejects claiming a ticket already owned by someone else", async () => {
    const { requesterA, staffA, staffB, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id, { ticketOwnerId: staffA.id });
    const agent = await loginAgent(app, staffB.email);

    const res = await agent.post(`/api/staff/tickets/${ticket.id}/claim`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ALREADY_ASSIGNED");
  });

  // FR-14: assigning to another valid staff member
  it("lets a staff member assign a ticket to another active IT Staff member", async () => {
    const { requesterA, staffA, staffB, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.post(`/api/staff/tickets/${ticket.id}/assign`).send({ ownerId: staffB.id });
    expect(res.status).toBe(200);
    expect(res.body.data.ticketOwnerId).toBe(staffB.id);
  });

  // BR-13: cannot assign to a Requester or an inactive account
  it("rejects assigning a ticket to a Requester account", async () => {
    const { requesterA, requesterB, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.post(`/api/staff/tickets/${ticket.id}/assign`).send({ ownerId: requesterB.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_OWNER");
  });

  it("rejects assigning a ticket to an inactive Administrator", async () => {
    const { requesterA, staffA, inactiveAdmin, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.post(`/api/staff/tickets/${ticket.id}/assign`).send({ ownerId: inactiveAdmin.id });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_OWNER");
  });

  // BR-15: itPriority validation
  it("sets the IT priority on a ticket", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.patch(`/api/staff/tickets/${ticket.id}/priority`).send({ itPriority: "HIGH" });
    expect(res.status).toBe(200);
    expect(res.body.data.itPriority).toBe("HIGH");
  });

  it("rejects an invalid IT priority value", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.patch(`/api/staff/tickets/${ticket.id}/priority`).send({ itPriority: "URGENT" });
    expect(res.status).toBe(400);
  });

  // BR-16, BR-17: status transition matrix enforced server-side
  it("allows a valid status transition (NEW -> OPEN)", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id, { currentStatus: "NEW" });
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ currentStatus: "OPEN" });
    expect(res.status).toBe(200);
    expect(res.body.data.currentStatus).toBe("OPEN");
  });

  it("rejects an invalid status transition (NEW -> RESOLVED)", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id, { currentStatus: "NEW" });
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ currentStatus: "RESOLVED" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("INVALID_TRANSITION");
  });

  it("rejects any transition out of a terminal CANCELLED state", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id, { currentStatus: "CANCELLED" });
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ currentStatus: "OPEN" });
    expect(res.status).toBe(409);
  });

  it("allows reopening a CLOSED ticket", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id, { currentStatus: "CLOSED" });
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.patch(`/api/staff/tickets/${ticket.id}/status`).send({ currentStatus: "REOPENED" });
    expect(res.status).toBe(200);
  });

  it("requires authentication for the staff queue (401)", async () => {
    await seedFixtures();
    const res = await request(app).get("/api/staff/tickets");
    expect(res.status).toBe(401);
  });
});
