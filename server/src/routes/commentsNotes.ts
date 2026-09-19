import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { STAFF_ROLES } from "../lib/auth.js";
import { validateCommentContent } from "../lib/validators.js";

const router = Router();
router.use(requireAuth());

// Loads a ticket the caller may see: their own (Requester), or any (IT
// Staff/Administrator). Mirrors the 404-not-403 pattern from Lab 2 (FR-11)
// so an unauthorized id never confirms a ticket's existence.
async function loadVisibleTicket(userId: number, role: string, ticketId: number) {
  const where =
    role === "REQUESTER" ? { id: ticketId, requesterId: userId } : { id: ticketId };
  return prisma.ticket.findFirst({ where });
}

// POST /api/tickets/:id/comments — BR-04, BR-18, BR-19: Requester (own
// ticket) or IT Staff/Administrator (any ticket) may post.
router.post("/tickets/:id/comments", async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    const user = req.user!;
    const ticket = await loadVisibleTicket(user.id, user.role, ticketId);
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");

    const contentError = validateCommentContent(req.body?.content);
    if (contentError) throw new AppError(400, "VALIDATION_ERROR", { content: contentError });

    const comment = await prisma.publicComment.create({
      data: { ticketId, authorId: user.id, content: (req.body.content as string).trim() },
      include: { author: { select: { name: true, role: true } } },
    });

    res.status(201).json({ data: comment });
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets/:id/comments
router.get("/tickets/:id/comments", async (req, res, next) => {
  try {
    const ticketId = Number(req.params.id);
    const user = req.user!;
    const ticket = await loadVisibleTicket(user.id, user.role, ticketId);
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");

    const comments = await prisma.publicComment.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true, role: true } } },
    });
    res.json({ data: comments });
  } catch (err) {
    next(err);
  }
});

// POST /api/tickets/:id/notes — BR-04: IT Staff/Administrator only. A
// Requester never reaches this route (403, no note content ever returned).
router.post("/tickets/:id/notes", async (req, res, next) => {
  try {
    const user = req.user!;
    if (!STAFF_ROLES.includes(user.role)) throw new AppError(403, "FORBIDDEN");

    const ticketId = Number(req.params.id);
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");

    const contentError = validateCommentContent(req.body?.content);
    if (contentError) throw new AppError(400, "VALIDATION_ERROR", { content: contentError });

    const note = await prisma.internalNote.create({
      data: { ticketId, authorId: user.id, content: (req.body.content as string).trim() },
      include: { author: { select: { name: true, role: true } } },
    });

    res.status(201).json({ data: note });
  } catch (err) {
    next(err);
  }
});

// GET /api/tickets/:id/notes — AC-04, AC-13: a Requester gets 403 with no
// note content anywhere in the response body.
router.get("/tickets/:id/notes", async (req, res, next) => {
  try {
    const user = req.user!;
    if (!STAFF_ROLES.includes(user.role)) throw new AppError(403, "FORBIDDEN");

    const ticketId = Number(req.params.id);
    const ticket = await prisma.ticket.findFirst({ where: { id: ticketId } });
    if (!ticket) throw new AppError(404, "TICKET_NOT_FOUND");

    const notes = await prisma.internalNote.findMany({
      where: { ticketId },
      orderBy: { createdAt: "asc" },
      include: { author: { select: { name: true, role: true } } },
    });
    res.json({ data: notes });
  } catch (err) {
    next(err);
  }
});

export default router;
