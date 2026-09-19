import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { generateTicketNumber } from "../lib/ticketNumber.js";
import {
  validateSummary,
  validateDescription,
  validatePriority,
  PRIORITIES,
  STATUSES,
  SORTABLE_FIELDS,
} from "../lib/validators.js";

const router = Router();

// POST /api/tickets — FR-03, FR-04, FR-05, BR-01, BR-02, BR-07..BR-10
router.post("/", async (req, res, next) => {
  try {
    const { requesterId, categoryId, relatedSystemId, summary, description, requestedPriority } =
      req.body ?? {};

    if (!requesterId) {
      throw new AppError(400, "VALIDATION_ERROR", { requesterId: "required" });
    }

    const requester = await prisma.requester.findUnique({ where: { id: Number(requesterId) } });
    if (!requester) throw new AppError(404, "REQUESTER_NOT_FOUND");
    if (!requester.isActive) throw new AppError(403, "REQUESTER_INACTIVE"); // BR-05

    const fields: Record<string, string> = {};
    const summaryErr = validateSummary(summary);
    if (summaryErr) fields.summary = summaryErr;
    const descErr = validateDescription(description);
    if (descErr) fields.description = descErr;
    const priorityErr = validatePriority(requestedPriority);
    if (priorityErr) fields.requestedPriority = priorityErr;
    if (Object.keys(fields).length > 0) {
      throw new AppError(400, "VALIDATION_ERROR", fields);
    }

    const category = await prisma.category.findUnique({ where: { id: Number(categoryId) } });
    if (!category || !category.isActive) {
      throw new AppError(400, "INVALID_REFERENCE", { categoryId: "unknown or inactive" });
    }

    const relatedSystem = await prisma.relatedSystem.findUnique({
      where: { id: Number(relatedSystemId) },
    });
    if (!relatedSystem || !relatedSystem.isActive) {
      throw new AppError(400, "INVALID_REFERENCE", { relatedSystemId: "unknown or inactive" });
    }

    const ticketNumber = await generateTicketNumber(prisma);

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        requesterId: requester.id,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: (summary as string).trim(),
        description: (description as string).trim(),
        requestedPriority,
        currentStatus: "NEW", // BR-02
      },
    });

    res.status(201).json({ data: ticket });
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets — FR-06..FR-10, BR-18, BR-19
router.get("/", async (req, res, next) => {
  try {
    const requesterId = Number(req.query.requesterId);
    if (!requesterId) throw new AppError(400, "VALIDATION_ERROR", { requesterId: "required" });

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 10));
    const sortBy = SORTABLE_FIELDS.includes(req.query.sortBy as any)
      ? (req.query.sortBy as string)
      : "createdAt";
    const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";

    const where: any = { requesterId };

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

    const totalItems = await prisma.ticket.count({ where });
    const everCreated = await prisma.ticket.count({ where: { requesterId } });

    const tickets = await prisma.ticket.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: true, relatedSystem: true },
    });

    const state = everCreated === 0 ? "EMPTY" : totalItems === 0 ? "NO_RESULTS" : "OK";

    res.json({
      data: tickets,
      meta: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) },
      state,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets/:id — FR-11, BR-06 (ownership enforced server-side, 404 not 403)
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const requesterId = Number(req.query.requesterId);
    if (!requesterId) throw new AppError(400, "VALIDATION_ERROR", { requesterId: "required" });

    const ticket = await prisma.ticket.findFirst({
      where: { id, requesterId },
      include: {
        category: true,
        relatedSystem: true,
        requester: true,
        attachments: { orderBy: { uploadedAt: "desc" } },
      },
    });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");

    res.json({ data: ticket });
  } catch (err) {
    next(err);
  }
});

export default router;
