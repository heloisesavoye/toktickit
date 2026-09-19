import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// BR-04: only active Development Requesters appear in the selector.
router.get("/", async (_req, res, next) => {
  try {
    const requesters = await prisma.requester.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    });
    res.json({ data: requesters });
  } catch (err) {
    next(err);
  }
});

export default router;
