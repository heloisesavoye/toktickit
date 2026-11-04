import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, seedFixtures, loginAgent, createTicket, createAction } from "./helpers.js";

const app = createApp();

describe("Lab 4 Ticket workflow: resolution gate, history, concurrency", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // API-13 — AC-03, BR-08 (direct API call, bypassing the UI)
  it("blocks Resolved with no completed action, and with an open action", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id, { currentStatus: "IN_PROGRESS" });
    const agent = await loginAgent(app, f.staffA.email);

    const none = await agent.patch(`/api/staff/tickets/${t.id}/status`).send({ currentStatus: "RESOLVED" });
    expect(none.status).toBe(409);
    expect(none.body.error.code).toBe("RESOLUTION_BLOCKED");

    await createAction(t.id, f.staffA.id, { status: "COMPLETED", completedAt: new Date() });
    await createAction(t.id, f.staffA.id, { status: "OPEN" });
    const open = await agent.patch(`/api/staff/tickets/${t.id}/status`).send({ currentStatus: "RESOLVED" });
    expect(open.status).toBe(409);
    expect(open.body.error.code).toBe("RESOLUTION_BLOCKED");
    expect(open.body.error.message).toMatch(/open/i);

    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(stored.currentStatus).toBe("IN_PROGRESS");
    expect(await prisma.ticketStatusChange.count()).toBe(0);
  });

  // API-14 — AC-04, BR-13
  it("resolves once the gate is met, appends history, and bumps version", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id, { currentStatus: "IN_PROGRESS" });
    await createAction(t.id, f.staffA.id, { status: "COMPLETED", completedAt: new Date() });
    await createAction(t.id, f.staffB.id, { status: "CANCELLED", cancelledAt: new Date() });
    const agent = await loginAgent(app, f.staffA.email);

    const before = await agent.get(`/api/staff/tickets/${t.id}`);
    expect(before.body.data.resolutionGate.allowed).toBe(true);

    const res = await agent
      .patch(`/api/staff/tickets/${t.id}/status`)
      .send({ currentStatus: "RESOLVED", expectedVersion: before.body.data.version });
    expect(res.status).toBe(200);
    expect(res.body.data.currentStatus).toBe("RESOLVED");
    expect(res.body.data.version).toBe(before.body.data.version + 1);

    const detail = await agent.get(`/api/staff/tickets/${t.id}`);
    expect(detail.body.data.statusHistory).toHaveLength(1);
    expect(detail.body.data.statusHistory[0]).toMatchObject({
      fromStatus: "IN_PROGRESS",
      toStatus: "RESOLVED",
      changedBy: { id: f.staffA.id, name: "Staff A" },
    });
    expect(detail.body.data.actions).toHaveLength(2);
  });

  // API-15 — AC-10
  it("rejects a status change sent with a stale expectedVersion", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id, { currentStatus: "NEW" });
    const a = await loginAgent(app, f.staffA.email);
    const b = await loginAgent(app, f.staffB.email);

    const first = await a.patch(`/api/staff/tickets/${t.id}/status`).send({ currentStatus: "OPEN", expectedVersion: 1 });
    expect(first.status).toBe(200);
    const second = await b.patch(`/api/staff/tickets/${t.id}/status`).send({ currentStatus: "CANCELLED", expectedVersion: 1 });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("STALE_UPDATE");

    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(stored.currentStatus).toBe("OPEN");
  });

  it("only one of two simultaneous status changes wins", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id, { currentStatus: "NEW" });
    const a = await loginAgent(app, f.staffA.email);
    const b = await loginAgent(app, f.staffB.email);
    const results = await Promise.all([
      a.patch(`/api/staff/tickets/${t.id}/status`).send({ currentStatus: "OPEN", expectedVersion: 1 }),
      b.patch(`/api/staff/tickets/${t.id}/status`).send({ currentStatus: "IN_PROGRESS", expectedVersion: 1 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(await prisma.ticketStatusChange.count({ where: { ticketId: t.id } })).toBe(1);
  });

  it("claim / assign / IT priority also increment the version", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    const agent = await loginAgent(app, f.staffA.email);
    await agent.post(`/api/staff/tickets/${t.id}/claim`);
    await agent.patch(`/api/staff/tickets/${t.id}/priority`).send({ itPriority: "HIGH" });
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(stored.version).toBe(3);
  });

  // API-16 — AC-19, BR-13
  it("rejects invalid transitions and Requester status changes", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id, { currentStatus: "CLOSED" });
    const staff = await loginAgent(app, f.staffA.email);
    const invalid = await staff.patch(`/api/staff/tickets/${t.id}/status`).send({ currentStatus: "IN_PROGRESS" });
    expect(invalid.status).toBe(409);
    expect(invalid.body.error.code).toBe("INVALID_TRANSITION");

    const requester = await loginAgent(app, f.requesterA.email);
    const forbidden = await requester.patch(`/api/staff/tickets/${t.id}/status`).send({ currentStatus: "REOPENED" });
    expect(forbidden.status).toBe(403);
  });

  // API-17 — AC-20, BR-12
  it("clears appearsResolved on reopen and keeps history in order", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id, { currentStatus: "IN_PROGRESS" });
    await createAction(t.id, f.staffA.id, { status: "COMPLETED", completedAt: new Date() });

    const requester = await loginAgent(app, f.requesterA.email);
    await requester.post(`/api/tickets/${t.id}/resolution-flag`);
    expect((await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).currentStatus).toBe("IN_PROGRESS");

    const staff = await loginAgent(app, f.staffA.email);
    for (const s of ["RESOLVED", "CLOSED", "REOPENED"]) {
      const res = await staff.patch(`/api/staff/tickets/${t.id}/status`).send({ currentStatus: s });
      expect(res.status).toBe(200);
    }
    const stored = await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } });
    expect(stored.appearsResolved).toBe(false);

    const detail = await staff.get(`/api/staff/tickets/${t.id}`);
    expect(detail.body.data.statusHistory.map((h: any) => `${h.fromStatus}>${h.toStatus}`)).toEqual([
      "IN_PROGRESS>RESOLVED",
      "RESOLVED>CLOSED",
      "CLOSED>REOPENED",
    ]);
  });
});
