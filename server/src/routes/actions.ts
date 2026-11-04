import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { isTicketFinal, validateActionInput } from "../lib/actions.js";

// Lab 4 Actions Taken API for IT Staff/Administrator (docs/lab-04/api-spec.md §2).
// Mounted at /api/staff. Requesters are rejected here (AC-07); their
// read-only view lives in routes/tickets.ts (GET /api/tickets/:id/actions).
const router = Router();
router.use(requireAuth(), requireRole("IT_STAFF", "ADMINISTRATOR"));

export const ACTION_INCLUDE = {
  performedBy: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true, isActive: true } },
} satisfies Prisma.ActionTakenInclude;

export const ACTION_ORDER: Prisma.ActionTakenOrderByWithRelationInput[] = [
  { actionAt: "asc" },
  { id: "asc" },
];

// BR-04: only an active IT Staff member or Administrator can be assigned.
async function assertValidAssignee(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(user.role)) {
    throw new AppError(400, "INVALID_ASSIGNEE", { assigneeId: "Assignee must be an active IT Staff member or Administrator" });
  }
}

function parseVersion(raw: unknown): number {
  const v = Number(raw);
  if (!Number.isInteger(v) || v < 1) {
    throw new AppError(400, "VALIDATION_ERROR", { version: "version is required" });
  }
  return v;
}

// GET /api/staff/assignees — active IT Staff/Administrators (Assignee select).
router.get("/assignees", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true, role: { in: ["IT_STAFF", "ADMINISTRATOR"] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    });
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
});

// GET /api/staff/tickets/:id/actions — FR-05, AC-13
router.get("/tickets/:id/actions", async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");
    const actions = await prisma.actionTaken.findMany({
      where: { ticketId },
      orderBy: ACTION_ORDER,
      include: ACTION_INCLUDE,
    });
    res.json({ data: actions });
  } catch (err) {
    next(err);
  }
});

// POST /api/staff/tickets/:id/actions — FR-01, FR-02, AC-01, BR-03..BR-07, BR-10
router.post("/tickets/:id/actions", async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");
    if (isTicketFinal(ticket.currentStatus)) {
      throw new AppError(409, "TICKET_NOT_ACTIVE", undefined, "Reopen this ticket before recording new actions.");
    }

    // Only whitelisted fields are read: performedById/status/version/ticketId
    // in the body are ignored (BR-03).
    const body = req.body ?? {};
    const { fields, clean } = validateActionInput(
      {
        actionAt: body.actionAt,
        description: body.description,
        result: body.result,
        assigneeId: body.assigneeId,
        followUpRequired: body.followUpRequired ?? false,
        followUpNote: body.followUpNote,
        attachmentNotes: body.attachmentNotes,
      },
      { partial: false, ticketCreatedAt: ticket.createdAt }
    );
    if (Object.keys(fields).length > 0) throw new AppError(400, "VALIDATION_ERROR", fields);

    const assigneeId = clean.assigneeId ?? req.user!.id;
    await assertValidAssignee(assigneeId);

    const [action] = await prisma.$transaction([
      prisma.actionTaken.create({
        data: {
          ticketId,
          actionAt: clean.actionAt!,
          description: clean.description!,
          result: clean.result!,
          performedById: req.user!.id,
          assigneeId,
          followUpRequired: clean.followUpRequired ?? false,
          followUpNote: clean.followUpNote ?? null,
          attachmentNotes: clean.attachmentNotes ?? null,
        },
        include: ACTION_INCLUDE,
      }),
      // FR-09: touch the parent ticket's "last updated".
      prisma.ticket.update({ where: { id: ticketId }, data: { updatedAt: new Date() } }),
    ]);

    res.status(201).json({ data: action });
  } catch (err) {
    next(err);
  }
});

// Shared loader for PATCH/complete/cancel: 404, read-only check (BR-09),
// then an atomic version-checked update (BR-11).
async function versionedUpdate(
  actionId: number,
  version: number,
  data: Prisma.ActionTakenUncheckedUpdateManyInput
) {
  const action = await prisma.actionTaken.findUnique({ where: { id: actionId } });
  if (!action) throw new AppError(404, "ACTION_NOT_FOUND");
  if (action.status !== "OPEN") {
    throw new AppError(409, "ACTION_NOT_EDITABLE", undefined, `This action is ${action.status.toLowerCase()} and can no longer be changed.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.actionTaken.updateMany({
      where: { id: actionId, version, status: "OPEN" },
      data: { ...data, version: { increment: 1 } },
    });
    if (count === 1) {
      await tx.ticket.update({ where: { id: action.ticketId }, data: { updatedAt: new Date() } });
    }
    return count;
  });

  if (result !== 1) {
    const current = await prisma.actionTaken.findUnique({ where: { id: actionId }, include: ACTION_INCLUDE });
    const err = new AppError(409, "STALE_UPDATE", undefined, "Someone else changed this action. Reload to see the latest version.");
    (err as any).current = current;
    throw err;
  }

  return prisma.actionTaken.findUniqueOrThrow({ where: { id: actionId }, include: ACTION_INCLUDE });
}

// PATCH /api/staff/actions/:actionId — FR-03, FR-08, AC-09
router.patch("/actions/:actionId", async (req, res, next) => {
  try {
    const actionId = Number(req.params.actionId);
    const version = parseVersion(req.body?.version);
    const existing = await prisma.actionTaken.findUnique({
      where: { id: actionId },
      include: { ticket: true },
    });
    if (!existing) throw new AppError(404, "ACTION_NOT_FOUND");

    const body = req.body ?? {};
    const { fields, clean } = validateActionInput(
      {
        actionAt: body.actionAt,
        description: body.description,
        result: body.result,
        assigneeId: body.assigneeId,
        followUpRequired: body.followUpRequired,
        followUpNote: body.followUpNote,
        attachmentNotes: body.attachmentNotes,
      },
      {
        partial: true,
        ticketCreatedAt: existing.ticket.createdAt,
        existing: { followUpRequired: existing.followUpRequired, followUpNote: existing.followUpNote },
      }
    );
    if (Object.keys(fields).length > 0) throw new AppError(400, "VALIDATION_ERROR", fields);
    if (clean.assigneeId !== undefined) await assertValidAssignee(clean.assigneeId);

    const updated = await versionedUpdate(actionId, version, clean);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/staff/actions/:actionId/complete — FR-04, BR-09
router.post("/actions/:actionId/complete", async (req, res, next) => {
  try {
    const version = parseVersion(req.body?.version);
    const updated = await versionedUpdate(Number(req.params.actionId), version, {
      status: "COMPLETED",
      completedAt: new Date(),
    });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/staff/actions/:actionId/cancel — FR-04, BR-09
router.post("/actions/:actionId/cancel", async (req, res, next) => {
  try {
    const version = parseVersion(req.body?.version);
    const updated = await versionedUpdate(Number(req.params.actionId), version, {
      status: "CANCELLED",
      cancelledAt: new Date(),
    });
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
