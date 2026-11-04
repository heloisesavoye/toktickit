-- Lab 4: Actions Taken, Ticket status history, optimistic concurrency.
-- Purely additive (docs/lab-04/api-spec.md §1): no existing row is modified
-- except that every legacy Ticket receives version = 1 via the column default.
-- Rollback: see down.sql in this folder.

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "ActionTaken" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actionAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "performedById" INTEGER NOT NULL,
    "assigneeId" INTEGER NOT NULL,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpNote" TEXT,
    "attachmentNotes" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "seedKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActionTaken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketStatusChange" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "fromStatus" "TicketStatus" NOT NULL,
    "toStatus" "TicketStatus" NOT NULL,
    "changedById" INTEGER NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketStatusChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActionTaken_seedKey_key" ON "ActionTaken"("seedKey");
CREATE INDEX "ActionTaken_ticketId_actionAt_idx" ON "ActionTaken"("ticketId", "actionAt");
CREATE INDEX "ActionTaken_assigneeId_status_idx" ON "ActionTaken"("assigneeId", "status");
CREATE INDEX "TicketStatusChange_ticketId_changedAt_idx" ON "TicketStatusChange"("ticketId", "changedAt");
CREATE INDEX "Ticket_updatedAt_idx" ON "Ticket"("updatedAt");
CREATE INDEX "Ticket_itPriority_idx" ON "Ticket"("itPriority");

-- AddForeignKey
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ActionTaken" ADD CONSTRAINT "ActionTaken_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketStatusChange" ADD CONSTRAINT "TicketStatusChange_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketStatusChange" ADD CONSTRAINT "TicketStatusChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
