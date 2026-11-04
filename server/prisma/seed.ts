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
      // Lab 4 fix: was `michael` (a Requester), which violates Lab 3 BR-13
      // (a Ticket Owner must be IT Staff/Administrator).
      owner: priya,
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

  // ---------------------------------------------------------------------
  // Lab 4 (docs/lab-04/specification.md §7): Tickets in every status and
  // priority, assigned/unassigned, with 0, 1 and 3 Actions Taken, plus a
  // Requester with no tickets (zero-metric dashboard). Idempotent: tickets
  // upsert on ticketNumber, actions on seedKey, history only if absent.
  // ---------------------------------------------------------------------
  const software = await prisma.category.findFirstOrThrow({ where: { name: "Software" } });
  const access = await prisma.category.findFirstOrThrow({ where: { name: "Account and Access" } });
  const email = await prisma.relatedSystem.findFirstOrThrow({ where: { name: "Email" } });
  const wifi = await prisma.relatedSystem.findFirstOrThrow({ where: { name: "Campus Wi-Fi" } });
  const leb2 = await prisma.relatedSystem.findFirstOrThrow({ where: { name: "LEB2 App" } });
  const printer = await prisma.relatedSystem.findFirstOrThrow({ where: { name: "Printer" } });
  const sarah = await prisma.user.findFirstOrThrow({ where: { email: "sarah.johnson@example.com" } });
  const david = await prisma.user.findFirstOrThrow({ where: { email: "david.lee@example.com" } });
  const emma = await prisma.user.findFirstOrThrow({ where: { email: "emma.wilson@toktickit.local" } });
  const formerStaff = await prisma.user.findFirstOrThrow({ where: { email: "former.itstaff@toktickit.local" } });

  await prisma.user.upsert({
    where: { email: "new.requester@example.com" },
    update: { passwordHash: requesterPasswordHash, isActive: true, requiresPasswordChange: false },
    create: {
      name: "Nina Patel",
      email: "new.requester@example.com",
      role: "REQUESTER",
      isActive: true,
      passwordHash: requesterPasswordHash,
      requiresPasswordChange: false,
    },
  });

  const daysAgo = (d: number, h = 0) => new Date(Date.now() - (d * 24 + h) * 60 * 60 * 1000);

  type SeedAction = {
    key: string;
    hoursAfter: number;
    description: string;
    result: string;
    performedBy: { id: number };
    assignee: { id: number };
    status: "OPEN" | "COMPLETED" | "CANCELLED";
    followUpNote?: string;
    attachmentNotes?: string;
  };
  type Lab4Plan = {
    number: string;
    requester: { id: number };
    owner: { id: number } | null;
    category: { id: number };
    system: { id: number };
    summary: string;
    description: string;
    requestedPriority: "LOW" | "MEDIUM" | "HIGH";
    itPriority: "LOW" | "MEDIUM" | "HIGH" | null;
    status:
      | "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_FOR_REQUESTER"
      | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
    createdDaysAgo: number;
    appearsResolved?: boolean;
    history: string[]; // statuses after NEW, in order
    actions: SeedAction[];
  };

  const lab4Plans: Lab4Plan[] = [
    {
      number: "TKT-2026-000005",
      requester: sarah, owner: null, category: access, system: email,
      summary: "Outlook keeps asking for my password",
      description: "Since the weekend Outlook prompts for my password every few minutes on my laptop.",
      requestedPriority: "HIGH", itPriority: "HIGH", status: "NEW", createdDaysAgo: 0,
      history: [], actions: [],
    },
    {
      number: "TKT-2026-000006",
      requester: david, owner: emma, category: network, system: wifi,
      summary: "Campus Wi-Fi drops in building 4",
      description: "Wi-Fi disconnects every 10 minutes in the 4th floor meeting rooms of building 4.",
      requestedPriority: "MEDIUM", itPriority: "HIGH", status: "OPEN", createdDaysAgo: 2,
      history: ["OPEN"], actions: [],
    },
    {
      number: "TKT-2026-000007",
      requester: sarah, owner: priya, category: software, system: leb2,
      summary: "LEB2 app crashes when uploading homework",
      description: "The LEB2 app closes immediately when I upload a PDF larger than 5 MB.",
      requestedPriority: "HIGH", itPriority: "HIGH", status: "IN_PROGRESS", createdDaysAgo: 3,
      history: ["OPEN", "IN_PROGRESS"],
      actions: [
        { key: "t7-a1", hoursAfter: 2, description: "Reproduced crash with a 6 MB PDF on Android 14", result: "Crash confirmed; logs collected", performedBy: priya, assignee: priya, status: "COMPLETED", attachmentNotes: "See leb2-crash-log.txt in Attachments" },
        { key: "t7-a2", hoursAfter: 20, description: "Escalated to LEB2 vendor with logs and device details", result: "Vendor acknowledged, fix expected next release", performedBy: priya, assignee: chalermchai, status: "OPEN", followUpNote: "Check vendor ticket status on Friday" },
        { key: "t7-a3", hoursAfter: 22, description: "Tried clearing app cache as a workaround", result: "No effect; workaround abandoned", performedBy: chalermchai, assignee: chalermchai, status: "CANCELLED" },
      ],
    },
    {
      number: "TKT-2026-000008",
      requester: david, owner: chalermchai, category, system: printer,
      summary: "Printer jams on double-sided printing",
      description: "The floor 2 printer jams every time I print double-sided documents.",
      requestedPriority: "LOW", itPriority: "MEDIUM", status: "RESOLVED", createdDaysAgo: 4,
      appearsResolved: true,
      history: ["OPEN", "IN_PROGRESS", "RESOLVED"],
      actions: [
        { key: "t8-a1", hoursAfter: 5, description: "Replaced the duplex unit roller", result: "Ten double-sided test prints without a jam", performedBy: chalermchai, assignee: chalermchai, status: "COMPLETED" },
      ],
    },
    {
      number: "TKT-2026-000009",
      requester: jennifer, owner: priya, category: software, system: email,
      summary: "Shared mailbox not visible",
      description: "The IT-helpdesk shared mailbox disappeared from my Outlook folder list.",
      requestedPriority: "MEDIUM", itPriority: "LOW", status: "CLOSED", createdDaysAgo: 12,
      history: ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
      actions: [
        { key: "t9-a1", hoursAfter: 3, description: "Re-added mailbox permissions in Exchange admin", result: "Mailbox visible after Outlook restart", performedBy: priya, assignee: priya, status: "COMPLETED" },
      ],
    },
    {
      number: "TKT-2026-000010",
      requester: michael, owner: emma, category: access, system: leb2,
      summary: "Cannot see my course grades",
      description: "My grades page in LEB2 is empty although the instructor says grades are published.",
      requestedPriority: "MEDIUM", itPriority: "MEDIUM", status: "REOPENED", createdDaysAgo: 6,
      history: ["OPEN", "IN_PROGRESS", "RESOLVED", "REOPENED"],
      actions: [
        { key: "t10-a1", hoursAfter: 4, description: "Re-synced student enrollment from the registrar", result: "Grades appeared for one course only", performedBy: emma, assignee: emma, status: "COMPLETED" },
        { key: "t10-a2", hoursAfter: 50, description: "Investigate missing second course after reopen", result: "Pending registrar export", performedBy: emma, assignee: emma, status: "OPEN", followUpNote: "Ask registrar for the 2nd course export" },
      ],
    },
    {
      number: "TKT-2026-000011",
      requester: jennifer, owner: null, category: network, system: vpn,
      summary: "Duplicate of VPN connection issue",
      description: "Submitted twice by mistake — same issue as my other VPN ticket.",
      requestedPriority: "LOW", itPriority: null, status: "CANCELLED", createdDaysAgo: 1,
      history: ["CANCELLED"], actions: [],
    },
    {
      number: "TKT-2026-000012",
      requester: sarah, owner: formerStaff, category, system: laptop,
      summary: "Laptop fan very loud",
      description: "The laptop fan runs at full speed constantly, even with no apps open.",
      requestedPriority: "LOW", itPriority: "LOW", status: "WAITING_FOR_REQUESTER", createdDaysAgo: 9,
      history: ["OPEN", "WAITING_FOR_REQUESTER"],
      actions: [
        { key: "t12-a1", hoursAfter: 6, description: "Asked requester to run the hardware diagnostic tool", result: "Waiting for diagnostic report", performedBy: formerStaff, assignee: priya, status: "OPEN", followUpNote: "Collect diagnostic report from requester" },
      ],
    },
  ];

  for (const plan of lab4Plans) {
    const createdAt = daysAgo(plan.createdDaysAgo, 1);
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
        appearsResolved: plan.appearsResolved ?? false,
        ticketDate: createdAt,
        createdAt,
      },
    });

    for (const a of plan.actions) {
      const actionAt = new Date(createdAt.getTime() + a.hoursAfter * 60 * 60 * 1000);
      await prisma.actionTaken.upsert({
        where: { seedKey: `${plan.number}:${a.key}` },
        update: {},
        create: {
          seedKey: `${plan.number}:${a.key}`,
          ticketId: ticket.id,
          actionAt,
          description: a.description,
          result: a.result,
          performedById: a.performedBy.id,
          assigneeId: a.assignee.id,
          followUpRequired: Boolean(a.followUpNote),
          followUpNote: a.followUpNote ?? null,
          attachmentNotes: a.attachmentNotes ?? null,
          status: a.status,
          completedAt: a.status === "COMPLETED" ? actionAt : null,
          cancelledAt: a.status === "CANCELLED" ? actionAt : null,
        },
      });
    }

    const historyCount = await prisma.ticketStatusChange.count({ where: { ticketId: ticket.id } });
    if (historyCount === 0 && plan.history.length > 0) {
      let from = "NEW";
      let i = 1;
      for (const to of plan.history) {
        await prisma.ticketStatusChange.create({
          data: {
            ticketId: ticket.id,
            fromStatus: from as any,
            toStatus: to as any,
            changedById: (plan.owner ?? priya).id,
            changedAt: new Date(createdAt.getTime() + i * 3 * 60 * 60 * 1000),
          },
        });
        from = to;
        i += 1;
      }
    }
  }

  // Lab 4 fix: keep the per-year Ticket Number sequence ahead of the seeded
  // numbers, otherwise the first ticket created after a fresh seed collides
  // with TKT-2026-000001 (unique constraint on ticketNumber, BR-01).
  const seededNumbers = await prisma.ticket.findMany({ select: { ticketNumber: true } });
  const maxByYear = new Map<number, number>();
  for (const { ticketNumber } of seededNumbers) {
    const m = /^TKT-(\d{4})-(\d{6})$/.exec(ticketNumber);
    if (!m) continue;
    const year = Number(m[1]);
    maxByYear.set(year, Math.max(maxByYear.get(year) ?? 0, Number(m[2])));
  }
  for (const [year, max] of maxByYear) {
    const current = await prisma.ticketSequence.findUnique({ where: { year } });
    if (!current || current.value < max) {
      await prisma.ticketSequence.upsert({ where: { year }, create: { year, value: max }, update: { value: max } });
    }
  }

  console.log(
    "Seed complete: 4 categories, 7 related systems, 4 active+1 inactive Requester, " +
      "3 active+1 inactive IT Staff (+1 pending-password-change), 1 active Administrator, " +
      "12 realistic tickets (every status) with comments/notes and Lab 4 Actions Taken."
  );
  console.log(`Dev passwords — Requester: ${REQUESTER_PASSWORD} | IT Staff: ${STAFF_PASSWORD} | Administrator: ${ADMIN_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
