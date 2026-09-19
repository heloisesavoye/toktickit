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

describe("Public comments and internal notes", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // BR-18: a Requester can post a public comment on their own ticket.
  it("lets a Requester post a public comment on their own ticket", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.post(`/api/tickets/${ticket.id}/comments`).send({ content: "Any update on this?" });
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe("Any update on this?");
    expect(res.body.data.author.role).toBe("REQUESTER");
  });

  it("blocks a Requester from commenting on another requester's ticket", async () => {
    const { requesterA, requesterB, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterB.email);

    const res = await agent.post(`/api/tickets/${ticket.id}/comments`).send({ content: "Not my ticket" });
    expect(res.status).toBe(404);
  });

  // BR-19: content length rules
  it("rejects an empty comment", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.post(`/api/tickets/${ticket.id}/comments`).send({ content: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.content).toBeTruthy();
  });

  it("rejects a comment over 2000 characters", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const agent = await loginAgent(app, requesterA.email);

    const res = await agent.post(`/api/tickets/${ticket.id}/comments`).send({ content: "a".repeat(2001) });
    expect(res.status).toBe(400);
  });

  // IT Staff can comment on any ticket (public, visible to the Requester too).
  it("lets IT Staff post a public comment on any ticket, visible to the Requester", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const staffAgent = await loginAgent(app, staffA.email);

    const post = await staffAgent.post(`/api/tickets/${ticket.id}/comments`).send({ content: "We've identified the issue." });
    expect(post.status).toBe(201);
    expect(post.body.data.author.role).toBe("IT_STAFF");

    const requesterAgent = await loginAgent(app, requesterA.email);
    const list = await requesterAgent.get(`/api/tickets/${ticket.id}/comments`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });

  // Internal notes: visible only to IT Staff/Administrator (already covered
  // for the blocked-Requester case in authorization.api.test.ts). Here: an
  // internal note never leaks into the public comments list.
  it("keeps internal notes out of the public comments endpoint", async () => {
    const { requesterA, staffA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const staffAgent = await loginAgent(app, staffA.email);

    await staffAgent.post(`/api/tickets/${ticket.id}/notes`).send({ content: "Internal-only diagnosis notes." });

    const requesterAgent = await loginAgent(app, requesterA.email);
    const comments = await requesterAgent.get(`/api/tickets/${ticket.id}/comments`);
    expect(comments.status).toBe(200);
    expect(comments.body.data).toHaveLength(0);
    expect(JSON.stringify(comments.body)).not.toMatch(/Internal-only/);
  });

  it("requires authentication to read comments (401)", async () => {
    const { requesterA, category, relatedSystem } = await seedFixtures();
    const ticket = await createTicket(requesterA.id, category.id, relatedSystem.id);
    const res = await request(app).get(`/api/tickets/${ticket.id}/comments`);
    expect(res.status).toBe(401);
  });
});
