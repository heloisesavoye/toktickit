import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase, seedFixtures, loginAgent, createTicket, createAction, validAction } from "./helpers.js";

const app = createApp();

describe("Lab 4 Actions Taken API", () => {
  beforeEach(resetDatabase);
  afterAll(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  // API-01 — AC-13, FR-05
  it("lists actions in stable actionAt/id order with performer names", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id, { currentStatus: "IN_PROGRESS" });
    const base = Date.now() - 60 * 60 * 1000;
    const late = await createAction(t.id, f.staffB.id, { actionAt: new Date(base + 2000), description: "Third by B" });
    const same1 = await createAction(t.id, f.staffA.id, { actionAt: new Date(base), description: "First by A" });
    const same2 = await createAction(t.id, f.staffB.id, { actionAt: new Date(base), description: "Second by B" });

    const agent = await loginAgent(app, f.staffA.email);
    const res = await agent.get(`/api/staff/tickets/${t.id}/actions`);
    expect(res.status).toBe(200);
    expect(res.body.data.map((a: any) => a.id)).toEqual([same1.id, same2.id, late.id]);
    expect(res.body.data[0].performedBy.name).toBe("Staff A");
    expect(res.body.data[1].performedBy.name).toBe("Staff B");
  });

  // API-02, API-03 — AC-01, BR-03, BR-04
  it("creates an action with performer from the session and the chosen assignee", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    const agent = await loginAgent(app, f.staffA.email);

    const res = await agent.post(`/api/staff/tickets/${t.id}/actions`).send({
      ...validAction,
      assigneeId: f.staffB.id,
      performedById: f.adminA.id, // spoof attempt — must be ignored
      status: "COMPLETED", // must be ignored
      attachmentNotes: "See vpn-log.txt",
    });
    expect(res.status).toBe(201);
    expect(res.body.data.ticketId).toBe(t.id);
    expect(res.body.data.performedBy.id).toBe(f.staffA.id);
    expect(res.body.data.assignee.id).toBe(f.staffB.id);
    expect(res.body.data.status).toBe("OPEN");
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.attachmentNotes).toBe("See vpn-log.txt");
  });

  it("defaults the assignee to the creator", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    const agent = await loginAgent(app, f.adminA.email);
    const res = await agent.post(`/api/staff/tickets/${t.id}/actions`).send(validAction);
    expect(res.status).toBe(201);
    expect(res.body.data.assignee.id).toBe(f.adminA.id);
  });

  // API-04 — AC-05
  it("rejects follow-up required without a note and saves nothing", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    const agent = await loginAgent(app, f.staffA.email);
    const res = await agent
      .post(`/api/staff/tickets/${t.id}/actions`)
      .send({ ...validAction, followUpRequired: true, followUpNote: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.fields.followUpNote).toBeDefined();
    expect(await prisma.actionTaken.count()).toBe(0);
  });

  // API-05 — AC-06
  it("rejects inactive and Requester assignees on create and edit", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    const agent = await loginAgent(app, f.staffA.email);

    const inactive = await agent.post(`/api/staff/tickets/${t.id}/actions`).send({ ...validAction, assigneeId: f.inactiveAdmin.id });
    expect(inactive.status).toBe(400);
    expect(inactive.body.error.code).toBe("INVALID_ASSIGNEE");

    const requester = await agent.post(`/api/staff/tickets/${t.id}/actions`).send({ ...validAction, assigneeId: f.requesterB.id });
    expect(requester.body.error.code).toBe("INVALID_ASSIGNEE");

    const action = await createAction(t.id, f.staffA.id);
    const edit = await agent.patch(`/api/staff/actions/${action.id}`).send({ assigneeId: f.inactiveAdmin.id, version: 1 });
    expect(edit.status).toBe(400);
    expect(edit.body.error.code).toBe("INVALID_ASSIGNEE");
  });

  // API-06 — AC-07
  it("forbids Requesters from creating, editing, or completing actions", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    const action = await createAction(t.id, f.staffA.id);
    const agent = await loginAgent(app, f.requesterA.email);

    expect((await agent.post(`/api/staff/tickets/${t.id}/actions`).send(validAction)).status).toBe(403);
    expect((await agent.patch(`/api/staff/actions/${action.id}`).send({ result: "x", version: 1 })).status).toBe(403);
    expect((await agent.post(`/api/staff/actions/${action.id}/complete`).send({ version: 1 })).status).toBe(403);
    expect((await agent.get(`/api/staff/assignees`)).status).toBe(403);
    expect((await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } })).status).toBe("OPEN");
  });

  // API-07 — AC-08, BR-14
  it("shows a Requester the actions on their own ticket only", async () => {
    const f = await seedFixtures();
    const own = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    const other = await createTicket(f.requesterB.id, f.category.id, f.relatedSystem.id);
    await createAction(own.id, f.staffA.id, { description: "Visible to A" });
    await createAction(other.id, f.staffA.id, { description: "Not for A" });
    const agent = await loginAgent(app, f.requesterA.email);

    const mine = await agent.get(`/api/tickets/${own.id}/actions`);
    expect(mine.status).toBe(200);
    expect(mine.body.data).toHaveLength(1);
    expect(mine.body.data[0].description).toBe("Visible to A");

    const detail = await agent.get(`/api/tickets/${own.id}`);
    expect(detail.body.data.actions).toHaveLength(1);
    expect(detail.body.data.notes).toBeUndefined();

    const theirs = await agent.get(`/api/tickets/${other.id}/actions`);
    expect(theirs.status).toBe(404);
  });

  // API-08 — AC-09, BR-11
  it("rejects a stale edit and returns the current record", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    const action = await createAction(t.id, f.staffA.id);
    const a = await loginAgent(app, f.staffA.email);
    const b = await loginAgent(app, f.staffB.email);

    const first = await a.patch(`/api/staff/actions/${action.id}`).send({ result: "Edited by A", version: 1 });
    expect(first.status).toBe(200);
    expect(first.body.data.version).toBe(2);

    const second = await b.patch(`/api/staff/actions/${action.id}`).send({ result: "Edited by B", version: 1 });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("STALE_UPDATE");
    expect(second.body.current.result).toBe("Edited by A");

    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    expect(stored.result).toBe("Edited by A");
  });

  it("requires a version on PATCH", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    const action = await createAction(t.id, f.staffA.id);
    const agent = await loginAgent(app, f.staffA.email);
    const res = await agent.patch(`/api/staff/actions/${action.id}`).send({ result: "No version" });
    expect(res.status).toBe(400);
    expect(res.body.error.fields.version).toBeDefined();
  });

  // API-09 — AC-11, BR-09
  it("makes completed and cancelled actions read-only", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    const action = await createAction(t.id, f.staffA.id);
    const agent = await loginAgent(app, f.staffA.email);

    const done = await agent.post(`/api/staff/actions/${action.id}/complete`).send({ version: 1 });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe("COMPLETED");
    expect(done.body.data.completedAt).not.toBeNull();

    for (const call of [
      agent.patch(`/api/staff/actions/${action.id}`).send({ result: "late edit", version: 2 }),
      agent.post(`/api/staff/actions/${action.id}/complete`).send({ version: 2 }),
      agent.post(`/api/staff/actions/${action.id}/cancel`).send({ version: 2 }),
    ]) {
      const res = await call;
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("ACTION_NOT_EDITABLE");
    }
  });

  // API-10 — AC-12, BR-10
  it("refuses new actions on Closed or Cancelled tickets", async () => {
    const f = await seedFixtures();
    const agent = await loginAgent(app, f.staffA.email);
    for (const status of ["CLOSED", "CANCELLED"] as const) {
      const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id, { currentStatus: status });
      const res = await agent.post(`/api/staff/tickets/${t.id}/actions`).send(validAction);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("TICKET_NOT_ACTIVE");
    }
    expect(await prisma.actionTaken.count()).toBe(0);
  });

  it("returns 404 for unknown tickets and actions", async () => {
    const f = await seedFixtures();
    const agent = await loginAgent(app, f.staffA.email);
    expect((await agent.post(`/api/staff/tickets/999999/actions`).send(validAction)).body.error.code).toBe("TICKET_NOT_FOUND");
    expect((await agent.patch(`/api/staff/actions/999999`).send({ result: "x", version: 1 })).body.error.code).toBe("ACTION_NOT_FOUND");
  });

  // API-11 — FR-09
  it("touches the parent ticket's updatedAt", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    await prisma.ticket.update({ where: { id: t.id }, data: { updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
    const before = (await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).updatedAt;

    const agent = await loginAgent(app, f.staffA.email);
    await agent.post(`/api/staff/tickets/${t.id}/actions`).send(validAction);
    const after = (await prisma.ticket.findUniqueOrThrow({ where: { id: t.id } })).updatedAt;
    expect(after.getTime()).toBeGreaterThan(before.getTime());
  });

  // API-12 — AC-23
  it("lets only one of two concurrent completions succeed", async () => {
    const f = await seedFixtures();
    const t = await createTicket(f.requesterA.id, f.category.id, f.relatedSystem.id);
    const action = await createAction(t.id, f.staffA.id);
    const a = await loginAgent(app, f.staffA.email);
    const b = await loginAgent(app, f.staffB.email);

    const results = await Promise.all([
      a.post(`/api/staff/actions/${action.id}/complete`).send({ version: 1 }),
      b.post(`/api/staff/actions/${action.id}/cancel`).send({ version: 1 }),
    ]);
    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([200, 409]);
    const stored = await prisma.actionTaken.findUniqueOrThrow({ where: { id: action.id } });
    expect(stored.version).toBe(2);
  });

  it("lists only active IT Staff / Administrators as assignees", async () => {
    const f = await seedFixtures();
    const agent = await loginAgent(app, f.staffA.email);
    const res = await agent.get(`/api/staff/assignees`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((u: any) => u.id);
    expect(ids).toEqual(expect.arrayContaining([f.staffA.id, f.staffB.id, f.adminA.id]));
    expect(ids).not.toContain(f.inactiveAdmin.id);
    expect(ids).not.toContain(f.requesterA.id);
  });
});
