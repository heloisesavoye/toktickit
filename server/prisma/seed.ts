import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

  const requesters = [
    { name: "Jennifer Anderson", email: "jennifer.anderson@example.com", isActive: true },
    { name: "Michael Brown", email: "michael.brown@example.com", isActive: true },
    { name: "Sarah Johnson", email: "sarah.johnson@example.com", isActive: true },
    { name: "David Lee", email: "david.lee@example.com", isActive: true },
    { name: "Former Employee", email: "former.employee@example.com", isActive: false },
  ];
  for (const r of requesters) {
    await prisma.requester.upsert({
      where: { email: r.email },
      update: { isActive: r.isActive, name: r.name },
      create: r,
    });
  }

  console.log("Seed complete: 4 categories, 7 related systems, 4 active + 1 inactive requester.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
