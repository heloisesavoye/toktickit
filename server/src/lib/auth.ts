import bcrypt from "bcryptjs";
import type { PrismaClient, Role, User } from "@prisma/client";

// BR-07: strong, salted hashing, cost factor >= 12.
const BCRYPT_COST = 12;
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
export const SESSION_COOKIE = "toktickit_session";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  // A sentinel/malformed hash (e.g. the migration placeholder) must fail safe,
  // never throw and never match.
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

// BR-08: password policy for both initial and user-chosen passwords.
export function validatePasswordPolicy(password: unknown): string | null {
  if (typeof password !== "string") return "Password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter";
  if (!/[0-9]/.test(password)) return "Password must include a number";
  if (!/[^a-zA-Z0-9]/.test(password)) return "Password must include a special character";
  return null;
}

export function safeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    requiresPasswordChange: user.requiresPasswordChange,
  };
}

// BR-09: server-side session, invalidated on logout. BR-26: a new password
// invalidates every other session for that user.
export async function createSession(prisma: PrismaClient, userId: number) {
  return prisma.session.create({
    data: { userId, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
}

export async function destroySession(prisma: PrismaClient, sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}

export async function destroyAllSessionsForUser(prisma: PrismaClient, userId: number) {
  await prisma.session.deleteMany({ where: { userId } });
}

export async function loadUserForSession(prisma: PrismaClient, sessionId: string | undefined) {
  if (!sessionId) return null;
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await destroySession(prisma, sessionId);
    return null;
  }
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user || !user.isActive) return null; // BR-10: deactivated users lose access immediately
  return user;
}

export const STAFF_ROLES: Role[] = ["IT_STAFF", "ADMINISTRATOR"];
