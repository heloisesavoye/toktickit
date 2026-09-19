import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, seedFixtures, loginAgent } from "./testUtils.js";
import { generateTicketNumber } from "../../src/lib/ticketNumber.js";

const app = createApp();

async function createTicket(requesterId: number, categoryId: number, relatedSystemId: number) {
  return prisma.ticket.create({
    data: {
      ticketNumber: await generateTicketNumber(prisma),
      requesterId,
      categoryId,
      relatedSystemId,
      summary: "Sample ticket summary",
      description: "Sample ticket description text.",
      requestedPriority: "MEDIUM",
    },
  });
}

// FR-08: every authorization rule must hold server-side, regardless of what
// the UI shows or hides.
describe("Role-based access control", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // AUTHZ-01
  it("blocks a Requester from the staff ticket queue with 403", async () => {
    const { requesterA } = await seedFixtures();
    const agent = await loginAgent(app, requesterA.email);
    const res = await agent.get("/api/staff/tickets");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  // AUTHZ-02
  it("blocks a Requester from admin user management with 403", async () => {
    const { requesterA } = await seedFixtures();
    const agent = await loginAgent(app, requesterA.email);
    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  // AUTHZ-03
  it("blocks IT Staff from admin user management with 403", async () => {
    const { staffA } = await seedFixtures();
    const agent = await loginAgent(app, staffA.email);
    const res = await agent.get("/api/admin/users");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  // AUTHZ-04: an Administrator is not automatically IT Staff for the queue —
  // the route allows both roles explicitly (FR-11), verify Administrator can.
  it("allows an Administrator to read the staff ticket queue", async () => {
    const { adminA } = await seedFixtures();
    const agent = await loginAgent(app, adminA.email);
    const res = await agent.get("/api/staff/tickets");
    expect(res.status).toBe(200);
  });

  // AUTHZ-05 / AC-04, AC-13: a Requester never sees internal notes, even on
  // their own ticket — 403 with no note content anywhere in the response.
  it("blocks a Requester from reading internal notes on their own ticket", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.get(`/api/tickets/${ticket.id}/notes`);
    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toMatch(/internal/i);
  });

  it("blocks a Requester from posting an internal note", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.post(`/api/tickets/${ticket.id}/notes`).send({ content: "Trying to sneak a note in" });
    expect(res.status).toBe(403);
  });

  // AUTHZ-06: IT Staff can read and post internal notes on any ticket.
  it("allows IT Staff to post and read an internal note on any ticket", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, staffA.email);

    const post = await agent.post(`/api/tickets/${ticket.id}/notes`).send({ content: "Checked the logs, looks like a driver issue." });
    expect(post.status).toBe(201);

    const list = await agent.get(`/api/tickets/${ticket.id}/notes`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });

  // AUTHZ-07 / AC-03: Requester ticket isolation still holds under Lab 3's
  // session-based identity (regression from Lab 2, re-verified against the
  // new auth stack rather than the old requesterId parameter).
  it("still isolates a Requester's own tickets from another Requester", async () => {
    const { requesterA, requesterB, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterB.email);

    const res = await agent.get(`/api/tickets/${ticket.id}`);
    expect(res.status).toBe(404);
  });

  // AUTHZ-08: IT Staff can view any Requester's ticket via the staff detail route.
  it("allows IT Staff to view any ticket via the staff detail route", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, staffA.email);

    const res = await agent.get(`/api/staff/tickets/${ticket.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(ticket.id);
  });

  // AUTHZ-09: an inactive IT Staff/Administrator loses access immediately
  // (BR-10), even mid-session — simulated by deactivating after login.
  it("cuts off access as soon as an active session's user is deactivated", async () => {
    const { staffA } = await seedFixtures();
    const agent = await loginAgent(app, staffA.email);

    await prisma.user.update({ where: { id: staffA.id }, data: { isActive: false } });

    const res = await agent.get("/api/staff/tickets");
    expect(res.status).toBe(401);
  });
});
