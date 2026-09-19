import { prisma } from "../../src/lib/prisma.js";

// Shared fixtures for lab-02 API tests. Requires a real test database
// (set DATABASE_URL to a disposable DB before running `npm run test`).
export async function resetDatabase() {
  await prisma.attachment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.ticketSequence.deleteMany();
  await prisma.requester.deleteMany();
  await prisma.category.deleteMany();
  await prisma.relatedSystem.deleteMany();
}

export async function seedFixtures() {
  const [requesterA, requesterB, inactiveRequester] = await Promise.all([
    prisma.requester.create({ data: { name: "Requester A", email: "a@example.com", isActive: true } }),
    prisma.requester.create({ data: { name: "Requester B", email: "b@example.com", isActive: true } }),
    prisma.requester.create({ data: { name: "Inactive R", email: "inactive@example.com", isActive: false } }),
  ]);
  const category = await prisma.category.create({ data: { name: "Hardware", isActive: true } });
  const relatedSystem = await prisma.relatedSystem.create({
    data: { name: "Corporate Laptop", isActive: true },
  });
  return { requesterA, requesterB, inactiveRequester, category, relatedSystem };
}
