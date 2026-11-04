import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, loginAgent, seedSpread } from "./helpers.js";

const app = createApp();

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

