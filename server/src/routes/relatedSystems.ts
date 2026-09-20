import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const relatedSystems = await prisma.relatedSystem.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    res.json({ data: relatedSystems });
  } catch (err) {
    next(err);
  }
});

export default router;
