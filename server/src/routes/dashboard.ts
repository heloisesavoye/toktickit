import { Router } from "express";
import type { Prisma, TicketStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { ACTIVE_STATUSES } from "../lib/actions.js";
import { STATUSES } from "../lib/validators.js";

// Lab 4 dashboards (docs/lab-04/specification.md §10, api-spec.md §4).
// Every metric is computed here from the database at request time (BR-16);
// every card returns the filter the client uses for drill-down (BR-19) so
// the drilled list returns exactly the same count (AC-15).
const router = Router();
router.use(requireAuth());

export const DASHBOARD_TIME_ZONE = "Asia/Bangkok"; // BR-17
const RECENT_DAYS = 7;
const LIST_LIMIT = 5;

const ACTIVE = { in: [...ACTIVE_STATUSES] as TicketStatus[] };

const SUMMARY_SELECT = {
  id: true,
  ticketNumber: true,
  summary: true,
  currentStatus: true,
  itPriority: true,
  requestedPriority: true,
  updatedAt: true,
} satisfies Prisma.TicketSelect;

function recentSince(now: Date) {
  return new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000);
}

// GET /api/dashboard/requester — FR-15, BR-18, AC-02
router.get("/requester", requireRole("REQUESTER"), async (req, res, next) => {
  try {
    const now = new Date();
    const mine: Prisma.TicketWhereInput = { requesterId: req.user!.id };
    const since = recentSince(now);

    const [openTickets, waitingForMe, resolved, closed, needsAttention, recentlyUpdated, recentlyResolved] =
      await Promise.all([
        prisma.ticket.count({ where: { ...mine, currentStatus: ACTIVE } }),
        prisma.ticket.count({ where: { ...mine, currentStatus: "WAITING_FOR_REQUESTER" } }),
        prisma.ticket.count({ where: { ...mine, currentStatus: "RESOLVED" } }),
        prisma.ticket.count({ where: { ...mine, currentStatus: "CLOSED" } }),
        prisma.ticket.findMany({
          where: { ...mine, currentStatus: "WAITING_FOR_REQUESTER" },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: LIST_LIMIT,
          select: SUMMARY_SELECT,
        }),
        prisma.ticket.findMany({
          where: { ...mine, updatedAt: { gte: since } },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: LIST_LIMIT,
          select: SUMMARY_SELECT,
        }),
        prisma.ticket.findMany({
          where: {
            ...mine,
            currentStatus: { in: ["RESOLVED", "CLOSED"] },
            statusChanges: { some: { toStatus: "RESOLVED", changedAt: { gte: since } } },
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: LIST_LIMIT,
          select: SUMMARY_SELECT,
        }),
      ]);

    res.json({
      data: {
        generatedAt: now.toISOString(),
        timeZone: DASHBOARD_TIME_ZONE,
        metrics: {
          openTickets: { count: openTickets, filter: { status: "ACTIVE" } },
          waitingForMe: { count: waitingForMe, filter: { status: "WAITING_FOR_REQUESTER" } },
          resolved: { count: resolved, filter: { status: "RESOLVED" } },
          closed: { count: closed, filter: { status: "CLOSED" } },
        },
        needsAttention,
        recentlyUpdated,
        recentlyResolved,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/staff — FR-16, FR-17, AC-14, AC-17
router.get("/staff", requireRole("IT_STAFF", "ADMINISTRATOR"), async (req, res, next) => {
  try {
    const now = new Date();
    const me = req.user!;
    const since = recentSince(now);

    const [
      unassigned,
      myAssigned,
      statusGroups,
      priorityGroups,
      myOpenActionsCount,
      myOpenActions,
      urgent,
      recentlyUpdated,
    ] = await Promise.all([
      prisma.ticket.count({ where: { ticketOwnerId: null, currentStatus: ACTIVE } }),
      prisma.ticket.count({ where: { ticketOwnerId: me.id, currentStatus: ACTIVE } }),
      prisma.ticket.groupBy({ by: ["currentStatus"], _count: { _all: true } }),
      prisma.ticket.groupBy({ by: ["itPriority"], where: { currentStatus: ACTIVE }, _count: { _all: true } }),
      prisma.actionTaken.count({ where: { assigneeId: me.id, status: "OPEN" } }),
      prisma.actionTaken.findMany({
        where: { assigneeId: me.id, status: "OPEN" },
        orderBy: [{ actionAt: "asc" }, { id: "asc" }],
        take: LIST_LIMIT,
        select: {
          id: true,
          ticketId: true,
          description: true,
          actionAt: true,
          followUpRequired: true,
          ticket: { select: { ticketNumber: true } },
        },
      }),
      prisma.ticket.findMany({
        where: { currentStatus: ACTIVE, itPriority: "HIGH" },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: LIST_LIMIT,
        select: SUMMARY_SELECT,
      }),
      prisma.ticket.findMany({
        where: { updatedAt: { gte: since } },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take: LIST_LIMIT,
        select: SUMMARY_SELECT,
      }),
    ]);

    // Zero-fill every status / priority so the UI never has to guess (AC-16).
    const byStatus: Record<string, number> = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const g of statusGroups) byStatus[g.currentStatus] = g._count._all;
    const byItPriority: Record<string, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, UNSET: 0 };
    for (const g of priorityGroups) byItPriority[g.itPriority ?? "UNSET"] = g._count._all;

    let userCounts: Record<string, number> | undefined;
    if (me.role === "ADMINISTRATOR") {
      const groups = await prisma.user.groupBy({ by: ["role"], where: { isActive: true }, _count: { _all: true } });
      userCounts = { REQUESTER: 0, IT_STAFF: 0, ADMINISTRATOR: 0 };
      for (const g of groups) userCounts[g.role] = g._count._all;
    }

    res.json({
      data: {
        generatedAt: now.toISOString(),
        timeZone: DASHBOARD_TIME_ZONE,
        metrics: {
          unassigned: { count: unassigned, filter: { ownerId: "unassigned", status: "ACTIVE" } },
          new: { count: byStatus.NEW, filter: { status: "NEW" } },
          inProgress: { count: byStatus.IN_PROGRESS, filter: { status: "IN_PROGRESS" } },
          waitingForRequester: { count: byStatus.WAITING_FOR_REQUESTER, filter: { status: "WAITING_FOR_REQUESTER" } },
          myAssigned: { count: myAssigned, filter: { ownerId: String(me.id), status: "ACTIVE" } },
        },
        byStatus,
        byItPriority,
        myOpenActions: {
          count: myOpenActionsCount,
          items: myOpenActions.map(({ ticket, ...a }) => ({ ...a, ticketNumber: ticket.ticketNumber })),
        },
        urgent,
        recentlyUpdated,
        ...(userCounts ? { userCounts } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
