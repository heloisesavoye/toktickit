import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/auth.js";
import {
  createSession,
  destroySession,
  hashPassword,
  safeUser,
  SESSION_COOKIE,
  validatePasswordPolicy,
  verifyPassword,
} from "../lib/auth.js";

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

// POST /api/auth/login — FR-01, FR-02, BR-01, BR-06, BR-10
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    const genericError = () =>
      new AppError(401, "INVALID_CREDENTIALS", undefined, "Invalid email or password.");

    if (typeof email !== "string" || typeof password !== "string") {
      throw genericError();
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    // BR-06: identical response whether the account is unknown, inactive, or
    // the password is wrong — never reveal which.
    if (!user || !user.isActive) throw genericError();

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) throw genericError();

    const session = await createSession(prisma, user.id);
    res.cookie(SESSION_COOKIE, session.id, COOKIE_OPTIONS);
    res.json({ data: safeUser(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout — BR-09
router.post("/logout", requireAuth({ allowPasswordChangePending: true }), async (req, res, next) => {
  try {
    const sessionId = req.cookies?.[SESSION_COOKIE];
    if (sessionId) await destroySession(prisma, sessionId);
    res.clearCookie(SESSION_COOKIE, COOKIE_OPTIONS);
    res.json({ data: { loggedOut: true } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — FR-05, BR-12
router.get("/me", requireAuth({ allowPasswordChangePending: true }), async (req, res) => {
  res.json({ data: safeUser(req.user!) });
});

// POST /api/auth/change-password — FR-03, FR-04, BR-02, BR-08
router.post(
  "/change-password",
  requireAuth({ allowPasswordChangePending: true }),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body ?? {};
      const user = req.user!;

      const currentValid = await verifyPassword(currentPassword ?? "", user.passwordHash);
      if (!currentValid) throw new AppError(401, "INVALID_CREDENTIALS");

      const policyError = validatePasswordPolicy(newPassword);
      if (policyError) throw new AppError(400, "WEAK_PASSWORD", { newPassword: policyError });

      const passwordHash = await hashPassword(newPassword);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash, requiresPasswordChange: false },
      });

      res.json({ data: { requiresPasswordChange: false } });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
