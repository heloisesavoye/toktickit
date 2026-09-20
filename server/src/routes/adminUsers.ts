import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import {
  destroyAllSessionsForUser,
  hashPassword,
  safeUser,
  validatePasswordPolicy,
} from "../lib/auth.js";
import { ROLES, validateEmail, validateName, validateRole } from "../lib/validators.js";

const router = Router();

// FR-20..FR-27: Administrator user management — Administrator only.
router.use(requireAuth(), requireRole("ADMINISTRATOR"));

async function countActiveAdmins(excludingUserId?: number) {
  return prisma.user.count({
    where: {
      role: "ADMINISTRATOR",
      isActive: true,
      ...(excludingUserId ? { id: { not: excludingUserId } } : {}),
    },
  });
}

// GET /api/admin/users — FR-20
router.get("/users", async (req, res, next) => {
  try {
    const where: any = {};
    if (req.query.search) {
      const term = String(req.query.search);
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { email: { contains: term, mode: "insensitive" } },
      ];
    }
    if (ROLES.includes(req.query.role as any)) {
      where.role = req.query.role;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    res.json({ data: users });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users — FR-21, BR-08, BR-11, BR-22
router.post("/users", async (req, res, next) => {
  try {
    const { name, email, role, isActive, initialPassword } = req.body ?? {};

    const fields: Record<string, string> = {};
    const nameErr = validateName(name);
    if (nameErr) fields.name = nameErr;
    const emailErr = validateEmail(email);
    if (emailErr) fields.email = emailErr;
    const roleErr = validateRole(role);
    if (roleErr) fields.role = roleErr;
    const passwordErr = validatePasswordPolicy(initialPassword);
    if (passwordErr) fields.initialPassword = passwordErr;
    if (Object.keys(fields).length > 0) throw new AppError(400, "VALIDATION_ERROR", fields);

    const passwordHash = await hashPassword(initialPassword);

    try {
      const user = await prisma.user.create({
        data: {
          name: (name as string).trim(),
          email: (email as string).trim().toLowerCase(),
          role,
          isActive: isActive !== false,
          passwordHash,
          requiresPasswordChange: true, // FR-21: always forced at next login
        },
      });
      res.status(201).json({ data: safeUser(user) });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError(409, "EMAIL_IN_USE"); // BR-11
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
});

// PATCH /api/admin/users/:id — FR-22, FR-24..FR-26, BR-11, BR-24
router.patch("/users/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new AppError(404, "USER_NOT_FOUND");

    const { name, email, role, isActive } = req.body ?? {};
    const fields: Record<string, string> = {};
    const data: Record<string, unknown> = {};

    if (name !== undefined) {
      const err = validateName(name);
      if (err) fields.name = err;
      else data.name = (name as string).trim();
    }
    if (email !== undefined) {
      const err = validateEmail(email);
      if (err) fields.email = err;
      else data.email = (email as string).trim().toLowerCase();
    }
    if (role !== undefined) {
      const err = validateRole(role);
      if (err) fields.role = err;
      else data.role = role;
    }
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    if (Object.keys(fields).length > 0) throw new AppError(400, "VALIDATION_ERROR", fields);

    const isSelf = target.id === req.user!.id;
    const wouldLeaveAdmin = target.role === "ADMINISTRATOR";
    const willStayAdmin = (data.role ?? target.role) === "ADMINISTRATOR";
    const willStayActive = (data.isActive ?? target.isActive) === true;

    // BR-24: an Administrator can never deactivate their own account...
    if (isSelf && data.isActive === false) {
      throw new AppError(
        409,
        "SELF_DEACTIVATION",
        undefined,
        "You cannot deactivate your own account."
      );
    }
    // ...and the system can never end up with zero active Administrators.
    if (wouldLeaveAdmin && (!willStayAdmin || !willStayActive)) {
      const remaining = await countActiveAdmins(target.id);
      if (remaining === 0) {
        throw new AppError(
          409,
          "LAST_ADMIN",
          undefined,
          "At least one active Administrator must remain."
        );
      }
    }

    try {
      const updated = await prisma.user.update({ where: { id }, data });
      res.json({ data: safeUser(updated) });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new AppError(409, "EMAIL_IN_USE");
      }
      throw e;
    }
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/users/:id/password — FR-23, BR-08, BR-26
router.post("/users/:id/password", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) throw new AppError(404, "USER_NOT_FOUND");

    const passwordErr = validatePasswordPolicy(req.body?.newInitialPassword);
    if (passwordErr) throw new AppError(400, "WEAK_PASSWORD", { newInitialPassword: passwordErr });

    const passwordHash = await hashPassword(req.body.newInitialPassword);
    await prisma.user.update({
      where: { id },
      data: { passwordHash, requiresPasswordChange: true },
    });
    await destroyAllSessionsForUser(prisma, id); // BR-26

    res.json({ data: { requiresPasswordChange: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
