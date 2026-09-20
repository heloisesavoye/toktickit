import type { NextFunction, Request, Response } from "express";
import type { Role, User } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { loadUserForSession, SESSION_COOKIE } from "../lib/auth.js";
import { AppError } from "./errorHandler.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

// FR-01..FR-08: attaches req.user from the session cookie, or rejects.
// Also enforces BR-02: a user who must change their password cannot reach
// any other protected route.
export function requireAuth(options: { allowPasswordChangePending?: boolean } = {}) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const sessionId = req.cookies?.[SESSION_COOKIE];
      const user = await loadUserForSession(prisma, sessionId);
      if (!user) throw new AppError(401, "UNAUTHENTICATED");

      if (user.requiresPasswordChange && !options.allowPasswordChangePending) {
        throw new AppError(403, "PASSWORD_CHANGE_REQUIRED");
      }

      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// FR-08: every authorization rule is enforced server-side regardless of the UI.
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError(401, "UNAUTHENTICATED"));
    if (!roles.includes(req.user.role)) return next(new AppError(403, "FORBIDDEN"));
    next();
  };
}
