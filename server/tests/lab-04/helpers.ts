import { prisma } from "../../src/lib/prisma.js";
import { generateTicketNumber } from "../../src/lib/ticketNumber.js";
import { seedFixtures } from "../lab-03/testUtils.js";

// Lab 4 test helpers. Reuses the Lab 3 fixtures (resetDatabase, seedFixtures,
// loginAgent) from ../lab-03/testUtils.ts so every suite shares one reset path.
export { resetDatabase, seedFixtures, loginAgent, TEST_PASSWORD } from "../lab-03/testUtils.js";

export async function createTicket(
  requesterId: number,
  categoryId: number,
  relatedSystemId: number,
  overrides: Record<string, unknown> = {}
) {
  return prisma.ticket.create({
    data: {
      ticketNumber: await generateTicketNumber(prisma),
      requesterId,
      categoryId,
      relatedSystemId,
      summary: "Sample ticket summary",
      description: "Sample ticket description text.",
      requestedPriority: "MEDIUM",
      ...overrides,
    },
  });
}

export const validAction = {
  description: "Restarted the VPN client service",
  result: "Client connects again",
};

export async function createAction(
  ticketId: number,
  performedById: number,
  overrides: Record<string, unknown> = {}
) {
  return prisma.actionTaken.create({
    data: {
      ticketId,
      actionAt: new Date(),
      description: "Seeded action description",
      result: "Seeded result",
      performedById,
      assigneeId: performedById,
      ...overrides,
    },
  });
}

// Shared dashboard fixture: tickets for two Requesters across statuses,
// owners and IT priorities, plus open/completed Actions Taken.
export async function seedSpread() {
  const f = await seedFixtures();
  const mk = (requesterId: number, o: Record<string, unknown>) =>
    createTicket(requesterId, f.category.id, f.relatedSystem.id, o);
  const tickets = {
    aNew: await mk(f.requesterA.id, { currentStatus: "NEW", itPriority: "HIGH" }),
    aWaiting: await mk(f.requesterA.id, { currentStatus: "WAITING_FOR_REQUESTER", ticketOwnerId: f.staffA.id }),
    aResolved: await mk(f.requesterA.id, { currentStatus: "RESOLVED", ticketOwnerId: f.staffA.id }),
    aClosed: await mk(f.requesterA.id, { currentStatus: "CLOSED" }),
    bInProgress: await mk(f.requesterB.id, { currentStatus: "IN_PROGRESS", ticketOwnerId: f.staffA.id, itPriority: "HIGH" }),
    bReopened: await mk(f.requesterB.id, { currentStatus: "REOPENED", ticketOwnerId: f.staffB.id, itPriority: "LOW" }),
    bCancelled: await mk(f.requesterB.id, { currentStatus: "CANCELLED" }),
  };
  await createAction(tickets.bInProgress.id, f.staffA.id, { status: "OPEN", followUpRequired: true, followUpNote: "Call back" });
  await createAction(tickets.bReopened.id, f.staffB.id, { assigneeId: f.staffA.id, status: "OPEN" });
  await createAction(tickets.aResolved.id, f.staffA.id, { status: "COMPLETED", completedAt: new Date() });
  return { f, tickets };
}

