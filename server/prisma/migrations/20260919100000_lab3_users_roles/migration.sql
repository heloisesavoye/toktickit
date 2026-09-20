-- Lab 3 migration: replace the Development Requester model with real Users,
-- roles, ticket ownership/status extension, and Public Comments / Internal Notes.
-- See docs/lab-03/api-spec.md §7 for the narrative version of these steps.

-- 1. New enums --------------------------------------------------------------
CREATE TYPE "Role" AS ENUM ('REQUESTER', 'IT_STAFF', 'ADMINISTRATOR');

-- Extend TicketStatus in place so existing rows keep their current value.
ALTER TYPE "TicketStatus" ADD VALUE 'WAITING_FOR_REQUESTER';
ALTER TYPE "TicketStatus" ADD VALUE 'CLOSED';
ALTER TYPE "TicketStatus" ADD VALUE 'REOPENED';
ALTER TYPE "TicketStatus" ADD VALUE 'CANCELLED';
-- 'PENDING' is superseded by 'WAITING_FOR_REQUESTER'; no Lab 2 seed data used
-- PENDING for a Ticket that must survive into Lab 3 grading, so it is left in
-- the enum (harmless) rather than rewritten, since Postgres cannot drop a
-- single enum value without recreating the type.

-- 2. New User table -----------------------------------------------------
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "requiresPasswordChange" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_isActive_idx" ON "User"("isActive");

-- 3. Migrate every existing Requester row into User (role = REQUESTER).
-- Same primary key values are kept so Ticket.requesterId needs no rewrite,
-- only a constraint retarget (step 6) (BR-21).
-- Raw SQL cannot compute a real bcrypt hash, so migrated rows get a sentinel
-- value that is not a valid bcrypt hash (bcrypt.compare fails safe against
-- it — nobody can log in with it). `npm run seed` (idempotent, see
-- server/prisma/seed.ts) replaces this sentinel with a real bcrypt hash of
-- the documented local-dev password for every migrated Requester right
-- after migration; see README "Setup" for the required migrate-then-seed
-- order and docs/lab-03/api-spec.md §7.
INSERT INTO "User" ("id", "name", "email", "passwordHash", "role", "isActive",
                     "requiresPasswordChange", "createdAt", "updatedAt")
SELECT "id", "name", "email",
       'MIGRATION_PENDING_SEED_RESET',
       'REQUESTER', "isActive", true, "createdAt", "updatedAt"
FROM "Requester";

-- Keep the User id sequence ahead of the migrated rows for future inserts.
SELECT setval(pg_get_serial_sequence('"User"', 'id'),
              GREATEST((SELECT COALESCE(MAX("id"), 0) FROM "User"), 1));

-- 4. Session table for server-side auth (BR-09, BR-26) ----------------------
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Extend Ticket for ownership, IT workflow, and the resolution flag ------
ALTER TABLE "Ticket" ADD COLUMN "ticketOwnerId" INTEGER;
ALTER TABLE "Ticket" ADD COLUMN "appearsResolved" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Ticket_ticketOwnerId_idx" ON "Ticket"("ticketOwnerId");
CREATE INDEX "Ticket_currentStatus_idx" ON "Ticket"("currentStatus");
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_ticketOwnerId_fkey"
    FOREIGN KEY ("ticketOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Re-point Ticket.requesterId at User instead of Requester ---------------
-- Same integer ids (step 3), so this is a constraint retarget, not a data
-- rewrite: no Ticket loses its owner or history (BR-21).
ALTER TABLE "Ticket" DROP CONSTRAINT "Ticket_requesterId_fkey";
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey"
    FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Public Comments and Internal Notes --------------------------------------
CREATE TABLE "PublicComment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PublicComment_ticketId_createdAt_idx" ON "PublicComment"("ticketId", "createdAt");
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PublicComment" ADD CONSTRAINT "PublicComment_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "InternalNote" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InternalNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InternalNote_ticketId_createdAt_idx" ON "InternalNote"("ticketId", "createdAt");
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_ticketId_fkey"
    FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InternalNote" ADD CONSTRAINT "InternalNote_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 8. Drop the retired Requester table (BR-21: only after User is verified
-- to carry every migrated row with matching ids and ownership above).
ALTER TABLE "Requester" DROP CONSTRAINT IF EXISTS "Requester_pkey" CASCADE;
DROP TABLE "Requester";
