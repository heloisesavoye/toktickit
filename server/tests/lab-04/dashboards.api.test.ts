import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { ACTIVE_STATUSES } from "../../src/lib/actions.js";
import { resetDatabase, seedFixtures, loginAgent, createTicket, createAction } from "./helpers.js";

const app = createApp();

async function seedSpread() {
  const f = await seedFixtures();
  const mk = (requesterId: number, o: Record<string, unknown>) =>
    createTicket(requesterId, f.category.id, f.relatedSystem.id, o);
  const tickets = {
    aNew: await mk(f.requesterA.id, { currentStatus: "NEW", itPriority: "HIGH" }),
    aWaiting: await mk(f.requesterA.id, { currentStatus: "WAITING_FOR_REQUESTER", ticketOwnerId: f.staffA.id }),
    aResolved: await mk(f.requesterA.id, { currentStatus: "RESOLVED", ticketOwnerId: f.staffA.id }),
    aClosed: await mk(f.requesterA.id, { currentStatus: "CLOSED" }),
    bInProgress: await mk(f.requesterB.id, { currentStatus: "IN_PROGRESS", ticketOwnerId: f.staffA.id, itPriority: "HIGH" }),
    bReopened: await mk(f.requesterB.id, { currentStatus: "REOPENED", ticketOwnerId: f.staffB.id, itPriority: "LOW" }),
    bCancelled: await mk(f.requesterB.id, { currentStatus: "CANCELLED" }),
  };
  await createAction(tickets.bInProgress.id, f.staffA.id, { status: "OPEN", followUpRequired: true, followUpNote: "Call back" });
  await createAction(tickets.bReopened.id, f.staffB.id, { assigneeId: f.staffA.id, status: "OPEN" });
  await createAction(tickets.aResolved.id, f.staffA.id, { status: "COMPLETED", completedAt: new Date() });
  return { f, tickets };
}

describe("Lab 4 Requester dashboard", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // API-18 — AC-02, BR-18
  it("returns only the authenticated Requester's own metrics and tickets", async () => {
    const { f, tickets } = await seedSpread();
    const agent = await loginAgent(app, f.requesterA.email);
    const res = await agent.get("/api/dashboard/requester");
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.timeZone).toBe("Asia/Bangkok");
    expect(d.metrics.openTickets.count).toBe(2); // NEW + WAITING
    expect(d.metrics.waitingForMe.count).toBe(1);
    expect(d.metrics.resolved.count).toBe(1);
    expect(d.metrics.closed.count).toBe(1);
    expect(d.needsAttention.map((t: any) => t.id)).toEqual([tickets.aWaiting.id]);

    const ids = [...d.needsAttention, ...d.recentlyUpdated, ...d.recentlyResolved].map((t: any) => t.id);
    for (const other of [tickets.bInProgress.id, tickets.bReopened.id, tickets.bCancelled.id]) {
      expect(ids).not.toContain(other);
    }
    // Summaries only — never comments, notes, or descriptions.
    expect(d.recentlyUpdated[0].description).toBeUndefined();
  });

  // API-18 (empty) — AC-16
  it("returns zeros and empty lists for a Requester with no tickets", async () => {
    await seedSpread();
    const empty = await prisma.user.create({
      data: { name: "No Tickets", email: "none@example.com", role: "REQUESTER", passwordHash: (await prisma.user.findFirstOrThrow()).passwordHash, requiresPasswordChange: false },
    });
    const agent = await loginAgent(app, empty.email);
    const d = (await agent.get("/api/dashboard/requester")).body.data;
    expect(Object.values(d.metrics).map((m: any) => m.count)).toEqual([0, 0, 0, 0]);
    expect(d.needsAttention).toEqual([]);
    expect(d.recentlyUpdated).toEqual([]);
  });

  // API-19 — AC-15
  it("card counts match the drilled-down My Tickets list", async () => {
    const { f } = await seedSpread();
    const agent = await loginAgent(app, f.requesterA.email);
    const d = (await agent.get("/api/dashboard/requester")).body.data;
    for (const metric of Object.values<any>(d.metrics)) {
      const qs = new URLSearchParams({ ...metric.filter, pageSize: "50" });
      const list = await agent.get(`/api/tickets?${qs}`);
      expect(list.body.meta.totalItems).toBe(metric.count);
    }
  });

  // API-20 — AC-18
  it("is forbidden to IT Staff", async () => {
    const { f } = await seedSpread();
    const agent = await loginAgent(app, f.staffA.email);
    expect((await agent.get("/api/dashboard/requester")).status).toBe(403);
  });
});

describe("Lab 4 IT Staff / Administrator dashboard", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // API-21 — AC-14
  it("every count equals a direct database count", async () => {
    const { f } = await seedSpread();
    const agent = await loginAgent(app, f.staffA.email);
    const res = await agent.get("/api/dashboard/staff");
    expect(res.status).toBe(200);
    const d = res.body.data;
    const active = { in: [...ACTIVE_STATUSES] as any };

    expect(d.metrics.unassigned.count).toBe(await prisma.ticket.count({ where: { ticketOwnerId: null, currentStatus: active } }));
    expect(d.metrics.new.count).toBe(await prisma.ticket.count({ where: { currentStatus: "NEW" } }));
    expect(d.metrics.inProgress.count).toBe(await prisma.ticket.count({ where: { currentStatus: "IN_PROGRESS" } }));
    expect(d.metrics.waitingForRequester.count).toBe(await prisma.ticket.count({ where: { currentStatus: "WAITING_FOR_REQUESTER" } }));
    expect(d.metrics.myAssigned.count).toBe(await prisma.ticket.count({ where: { ticketOwnerId: f.staffA.id, currentStatus: active } }));
    expect(d.myOpenActions.count).toBe(await prisma.actionTaken.count({ where: { assigneeId: f.staffA.id, status: "OPEN" } }));
    expect(d.myOpenActions.count).toBe(2);
    expect(d.myOpenActions.items[0].ticketNumber).toMatch(/^TKT-/);

    const total = Object.values<number>(d.byStatus).reduce((a, b) => a + b, 0);
    expect(total).toBe(await prisma.ticket.count());
    expect(Object.keys(d.byStatus)).toHaveLength(8);
    expect(d.byItPriority).toEqual({ HIGH: 2, MEDIUM: 0, LOW: 1, UNSET: 1 });
    expect(d.urgent.every((t: any) => t.itPriority === "HIGH")).toBe(true);
    expect(d.userCounts).toBeUndefined(); // IT Staff never get user counts
  });

  // API-22 — AC-15
  it("each card filter reproduces its count in the Ticket Queue", async () => {
    const { f } = await seedSpread();
    const agent = await loginAgent(app, f.staffA.email);
    const d = (await agent.get("/api/dashboard/staff")).body.data;
    for (const metric of Object.values<any>(d.metrics)) {
      const qs = new URLSearchParams({ ...metric.filter, pageSize: "50" });
      const list = await agent.get(`/api/staff/tickets?${qs}`);
      expect(list.body.meta.totalItems).toBe(metric.count);
    }
    const unset = await agent.get(`/api/staff/tickets?itPriority=UNSET&status=ACTIVE`);
    expect(unset.body.meta.totalItems).toBe(d.byItPriority.UNSET);
  });

  // API-23 — AC-17, AC-18
  it("adds active-user counts for Administrators and is forbidden to Requesters", async () => {
    const { f } = await seedSpread();
    const admin = await loginAgent(app, f.adminA.email);
    const d = (await admin.get("/api/dashboard/staff")).body.data;
    expect(d.userCounts).toEqual({
      REQUESTER: await prisma.user.count({ where: { isActive: true, role: "REQUESTER" } }),
      IT_STAFF: await prisma.user.count({ where: { isActive: true, role: "IT_STAFF" } }),
      ADMINISTRATOR: await prisma.user.count({ where: { isActive: true, role: "ADMINISTRATOR" } }),
    });

    const requester = await loginAgent(app, f.requesterA.email);
    expect((await requester.get("/api/dashboard/staff")).status).toBe(403);
  });

  // API-24 — AC-16
  it("returns zeros, not errors, when there are no tickets", async () => {
    const f = await seedFixtures();
    const agent = await loginAgent(app, f.staffA.email);
    const res = await agent.get("/api/dashboard/staff");
    expect(res.status).toBe(200);
    expect(Object.values<any>(res.body.data.metrics).every((m) => m.count === 0)).toBe(true);
    expect(res.body.data.urgent).toEqual([]);
    expect(res.body.data.myOpenActions).toEqual({ count: 0, items: [] });
  });

  // PERF-01
  it("responds quickly with 300 tickets and 600 actions", async () => {
    const f = await seedFixtures();
    const statuses = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "RESOLVED", "CLOSED", "REOPENED", "CANCELLED"] as const;
    await prisma.ticket.createMany({
      data: Array.from({ length: 300 }, (_, i) => ({
        ticketNumber: `TKT-PERF-${String(i).padStart(6, "0")}`,
        requesterId: f.requesterA.id,
        categoryId: f.category.id,
        relatedSystemId: f.relatedSystem.id,
        summary: `Perf ticket ${i}`,
        description: "Performance smoke test ticket",
        requestedPriority: "MEDIUM",
        currentStatus: statuses[i % statuses.length],
        ticketOwnerId: i % 3 === 0 ? f.staffA.id : null,
      })),
    });
    const ids = (await prisma.ticket.findMany({ select: { id: true } })).map((t) => t.id);
    await prisma.actionTaken.createMany({
      data: ids.flatMap((ticketId) => [0, 1].map((k) => ({
        ticketId,
        actionAt: new Date(),
        description: "Perf action",
        result: "ok",
        performedById: f.staffA.id,
        assigneeId: f.staffA.id,
        status: k === 0 ? ("OPEN" as const) : ("COMPLETED" as const),
      }))),
    });

    const agent = await loginAgent(app, f.staffA.email);
    const started = performance.now();
    const res = await agent.get("/api/dashboard/staff");
    const elapsed = performance.now() - started;
    expect(res.status).toBe(200);
    expect(res.body.data.myOpenActions.count).toBe(300);
    expect(elapsed).toBeLessThan(1000);
  });
});
