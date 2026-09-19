import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth.js";

const prisma = new PrismaClient();

// Local-development-only seed passwords, documented here and in the README.
// Never real credentials; every seeded account still enforces the same
// bcrypt-hashed storage as a real one (BR-07).
const REQUESTER_PASSWORD = "RequesterDev123!";
const STAFF_PASSWORD = "StaffDev123!";
const ADMIN_PASSWORD = "AdminDev123!";

// Idempotent: safe to run repeatedly (uses upsert everywhere), per handout §5.3.
async function main() {
  const categories = ["Account and Access", "Hardware", "Software", "Network"];
  for (const name of categories) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }

  const relatedSystems = [
    "Email",
    "Campus Wi-Fi",
    "VPN",
    "LEB2 App",
    "Grade Submission App",
    "Printer",
    "Corporate Laptop",
  ];
  for (const name of relatedSystems) {
    await prisma.relatedSystem.upsert({ where: { name }, update: {}, create: { name } });
  }

  // handout §5.3: >=4 active + 1 inactive Requester. These are the same
  // people migrated from Lab 2 (docs/lab-03/api-spec.md §7); upserting by
  // email fixes the migration's password-hash sentinel whether these rows
  // came from a real migration or a fresh database.
  const requesterPasswordHash = await hashPassword(REQUESTER_PASSWORD);
  const requesters = [
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", isActive: true },
    { name: "Michael Brown", email: "michael.brown@example.com", isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@example.com", isActive: true },
    { name: "David Lee", email: "david.lee@example.com", isActive: true },
    { name: "Former Employee", email: "former.employee@example.com", isActive: false },
  ];
  for (const r of requesters) {
    await prisma.user.upsert({
      where: { email: r.email },
      update: {
        name: r.name,
        isActive: r.isActive,
        passwordHash: requesterPasswordHash,
        requiresPasswordChange: false,
      },
      create: {
        ...r,
        role: "REQUESTER",
        passwordHash: requesterPasswordHash,
        requiresPasswordChange: false,
      },
    });
  }

  // handout §5.3: >=3 active + 1 inactive IT Staff.
  const staffPasswordHash = await hashPassword(STAFF_PASSWORD);
  const staff = [
    { name: "Priya Nakamura", email: "priya.nakamura@toktickit.local", isActive: true },
    { name: "Chalermchai Suk", email: "chalermchai.suk@toktickit.local", isActive: true },
    { name: "Emma Wilson", email: "emma.wilson@toktickit.local", isActive: true },
    { name: "Former IT Staff", email: "former.itstaff@toktickit.local", isActive: false },
  ];
  for (const s of staff) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {
        name: s.name,
        isActive: s.isActive,
        passwordHash: staffPasswordHash,
        requiresPasswordChange: false,
      },
      create: {
        ...s,
        role: "IT_STAFF",
        passwordHash: staffPasswordHash,
        requiresPasswordChange: false,
      },
    });
  }

  // handout §5.3: >=1 active Administrator.
  const adminPasswordHash = await hashPassword(ADMIN_PASSWORD);
  const admin = await prisma.user.upsert({
    where: { email: "admin@toktickit.local" },
    update: {
      name: "Alex Thompson",
      isActive: true,
      passwordHash: adminPasswordHash,
      requiresPasswordChange: false,
    },
    create: {
      name: "Alex Thompson",
      email: "admin@toktickit.local",
      role: "ADMINISTRATOR",
      isActive: true,
      passwordHash: adminPasswordHash,
      requiresPasswordChange: false,
    },
  });

  // One account still requiring a password change at next login, to
  // demonstrate/test the mandatory first-login flow (AC-01, AC-02).
  await prisma.user.upsert({
    where: { email: "new.hire@toktickit.local" },
    update: {},
    create: {
      name: "New Hire",
      email: "new.hire@toktickit.local",
      role: "IT_STAFF",
      isActive: true,
      passwordHash: await hashPassword("Temp1234!"),
      requiresPasswordChange: true,
    },
  });

  const category = await prisma.category.findFirstOrThrow({ where: { name: "Hardware" } });
  const network = await prisma.category.findFirstOrThrow({ where: { name: "Network" } });
  const laptop = await prisma.relatedSystem.findFirstOrThrow({ where: { name: "Corporate Laptop" } });
  const vpn = await prisma.relatedSystem.findFirstOrThrow({ where: { name: "VPN" } });
  const jennifer = await prisma.user.findFirstOrThrow({ where: { email: "jennifer.anderson@example.com" } });
  const michael = await prisma.user.findFirstOrThrow({ where: { email: "michael.brown@example.com" } });
  const priya = await prisma.user.findFirstOrThrow({ where: { email: "priya.nakamura@toktickit.local" } });
  const chalermchai = await prisma.user.findFirstOrThrow({ where: { email: "chalermchai.suk@toktickit.local" } });

  // Realistic Tickets distributed across Requesters, statuses, priorities,
  // and assigned/unassigned ownership (handout §5.3).
  const ticketPlans = [
    {
      number: "TKT-2026-000001",
      requester: jennifer,
      owner: michael,
      category,
      system: laptop,
      summary: "Laptop battery drains quickly",
      description: "My laptop battery is draining much faster than usual even when the system is idle.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "MEDIUM" as const,
      status: "IN_PROGRESS" as const,
    },
    {
      number: "TKT-2026-000002",
      requester: jennifer,
      owner: null,
      category: network,
      system: vpn,
      summary: "Cannot connect to VPN",
      description: "VPN client fails to connect from home network since this morning.",
      requestedPriority: "HIGH" as const,
      itPriority: null,
      status: "NEW" as const,
    },
    {
      number: "TKT-2026-000003",
      requester: michael,
      owner: priya,
      category,
      system: laptop,
      summary: "Docking station not detected",
      description: "External monitor and keyboard stop working when docked.",
      requestedPriority: "MEDIUM" as const,
      itPriority: "LOW" as const,
      status: "RESOLVED" as const,
    },
    {
      number: "TKT-2026-000004",
      requester: michael,
      owner: chalermchai,
      category: network,
      system: vpn,
      summary: "Printer keeps showing offline",
      description: "Shared floor printer intermittently shows offline in Windows.",
      requestedPriority: "LOW" as const,
      itPriority: "LOW" as const,
      status: "WAITING_FOR_REQUESTER" as const,
    },
  ];

  for (const plan of ticketPlans) {
    const ticket = await prisma.ticket.upsert({
      where: { ticketNumber: plan.number },
      update: {},
      create: {
        ticketNumber: plan.number,
        requesterId: plan.requester.id,
        ticketOwnerId: plan.owner?.id ?? null,
        categoryId: plan.category.id,
        relatedSystemId: plan.system.id,
        summary: plan.summary,
        description: plan.description,
        requestedPriority: plan.requestedPriority,
        itPriority: plan.itPriority,
        currentStatus: plan.status,
      },
    });

    if (plan.owner) {
      const existingComments = await prisma.publicComment.count({ where: { ticketId: ticket.id } });
      if (existingComments === 0) {
        await prisma.publicComment.create({
          data: {
            ticketId: ticket.id,
            authorId: plan.owner.id,
            content: "We are investigating the issue on your device. We'll update you shortly.",
          },
        });
        await prisma.internalNote.create({
          data: {
            ticketId: ticket.id,
            authorId: plan.owner.id,
            content: "Checked event logs, nothing conclusive yet. Escalating if unresolved by Friday.",
          },
        });
      }
    }
  }

  console.log(
    "Seed complete: 4 categories, 7 related systems, 4 active+1 inactive Requester, " +
      "3 active+1 inactive IT Staff (+1 pending-password-change), 1 active Administrator, " +
      "4 realistic tickets with comments/notes."
  );
  console.log(`Dev passwords — Requester: ${REQUESTER_PASSWORD} | IT Staff: ${STAFF_PASSWORD} | Administrator: ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
