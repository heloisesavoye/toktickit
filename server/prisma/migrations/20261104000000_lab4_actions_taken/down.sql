-- Lab 4 rollback (manual): reverses migration.sql. Touches only Lab 4 objects;
-- Users, Tickets' Lab 3 columns, Attachments, Public Comments and Internal
-- Notes are left exactly as they were.
--   psql "$DATABASE_URL" -f down.sql
--   DELETE FROM "_prisma_migrations" WHERE migration_name = '20261104000000_lab4_actions_taken';
BEGIN;
DROP TABLE IF EXISTS "TicketStatusChange";
DROP TABLE IF EXISTS "ActionTaken";
DROP INDEX IF EXISTS "Ticket_updatedAt_idx";
DROP INDEX IF EXISTS "Ticket_itPriority_idx";
ALTER TABLE "Ticket" DROP COLUMN IF EXISTS "version";
DROP TYPE IF EXISTS "ActionStatus";
COMMIT;
