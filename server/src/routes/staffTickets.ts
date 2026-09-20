import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  PRIORITIES,
  STATUSES,
  STAFF_SORTABLE_FIELDS,
  isValidTransition,
  validatePriority,
} from "../lib/validators.js";

const router = Router();

// FR-11..FR-19: IT Staff Ticket Queue and Ticket Detail — active IT
// Staff/Administrator only, every ticket regardless of owner.
router.use(requireAuth(), requireRole("IT_STAFF", "ADMINISTRATOR"));

// GET /api/staff/tickets — FR-11, FR-12, BR-20
router.get("/tickets", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));
    const sortBy = STAFF_SORTABLE_FIELDS.includes(req.query.sortBy as any)
      ? (req.query.sortBy as string)
      : "createdAt";
    const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";

    const where: any = {};
    if (req.query.search) {
      const term = String(req.query.search);
      where.OR = [
        { ticketNumber: { contains: term, mode: "insensitive" } },
        { summary: { contains: term, mode: "insensitive" } },
      ];
    }
    if (req.query.category && !Number.isNaN(Number(req.query.category))) {
      where.categoryId = Number(req.query.category);
    }
    if (PRIORITIES.includes(req.query.requestedPriority as any)) {
      where.requestedPriority = req.query.requestedPriority;
    }
    if (PRIORITIES.includes(req.query.itPriority as any)) {
      where.itPriority = req.query.itPriority;
    }
    if (STATUSES.includes(req.query.status as any)) {
      where.currentStatus = req.query.status;
    }
    if (req.query.ownerId === "unassigned") {
      where.ticketOwnerId = null;
    } else if (req.query.ownerId && !Number.isNaN(Number(req.query.ownerId))) {
      where.ticketOwnerId = Number(req.query.ownerId);
    }

    const totalItems = await prisma.ticket.count({ where });
    const totalEver = await prisma.ticket.count();

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: true,
        ticketOwner: { select: { id: true, name: true } },
      },
    });

    const state = totalEver === 0 ? "EMPTY" : totalItems === 0 ? "NO_RESULTS" : "OK";

    res.json({
      data: tickets,
      meta: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) },
      state,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/staff/tickets/:id — FR-13
router.get("/tickets/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: {
        category: true,
        relatedSystem: true,
        requester: { select: { id: true, name: true, email: true } },
        ticketOwner: { select: { id: true, name: true } },
        attachments: { orderBy: { uploadedAt: "desc" } },
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true, role: true } } },
        },
        notes: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true, role: true } } },
        },
      },
    });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");
    res.json({ data: ticket });
  } catch (err) {
    next(err);
  }
});

// Shared helper for claim/assign: only active IT Staff/Administrator may own
// a ticket (BR-13, BR-14).
async function findValidOwnerCandidate(id: number) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.isActive || !["IT_STAFF", "ADMINISTRATOR"].includes(user.role)) {
    return null;
  }
  return user;
}

// POST /api/staff/tickets/:id/claim — FR-14, BR-13, BR-14
router.post("/tickets/:id/claim", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");
    if (ticket.ticketOwnerId && ticket.ticketOwnerId !== req.user!.id) {
      throw new AppError(409, "ALREADY_ASSIGNED");
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: { ticketOwnerId: req.user!.id },
      include: { ticketOwner: { select: { id: true, name: true } } },
    });

    res.json({ data: { ticketOwnerId: updated.ticketOwnerId, ticketOwnerName: updated.ticketOwner?.name } });
  } catch (err) {
    next(err);
  }
});

// POST /api/staff/tickets/:id/assign — FR-14, BR-14
router.post("/tickets/:id/assign", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const ownerId = Number(req.body?.ownerId);

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");

    const candidate = await findValidOwnerCandidate(ownerId);
    if (!candidate) throw new AppError(400, "INVALID_OWNER");

    const updated = await prisma.ticket.update({
      where: { id },
      data: { ticketOwnerId: candidate.id },
      include: { ticketOwner: { select: { id: true, name: true } } },
    });

    res.json({ data: { ticketOwnerId: updated.ticketOwnerId, ticketOwnerName: updated.ticketOwner?.name } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/staff/tickets/:id/priority — FR-15, BR-15
router.patch("/tickets/:id/priority", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const priorityError = validatePriority(req.body?.itPriority);
    if (priorityError) throw new AppError(400, "VALIDATION_ERROR", { itPriority: priorityError });

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");

    const updated = await prisma.ticket.update({
      where: { id },
      data: { itPriority: req.body.itPriority },
    });

    res.json({ data: { itPriority: updated.itPriority } });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/staff/tickets/:id/status — FR-16, BR-16, BR-17
router.patch("/tickets/:id/status", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const requested = req.body?.currentStatus;
    if (!STATUSES.includes(requested)) {
      throw new AppError(400, "VALIDATION_ERROR", { currentStatus: "Unknown status" });
    }

    const ticket = await prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");

    if (!isValidTransition(ticket.currentStatus, requested)) {
      throw new AppError(
        409,
        "INVALID_TRANSITION",
        undefined,
        `Cannot move from ${ticket.currentStatus} to ${requested}.`
      );
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data: { currentStatus: requested },
    });

    res.json({ data: { currentStatus: updated.currentStatus } });
  } catch (err) {
    next(err);
  }
});

export default router;
