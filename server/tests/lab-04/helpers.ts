import { prisma } from "../../src/lib/prisma.js";
import { generateTicketNumber } from "../../src/lib/ticketNumber.js";

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
