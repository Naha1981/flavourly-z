// Seed auth users for Flavourly OS demo
// Run: bunx bun prisma/seed-auth.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  console.log("🔑 Seeding auth users...");

  const passwordHash = await bcrypt.hash("demo1234", 10);

  // 1. Mike (tenant owner) — linked to Mike's Car Wash
  const mikeTenant = await db.tenant.findUnique({ where: { slug: "mikes-car-wash" } });
  if (mikeTenant) {
    await db.user.upsert({
      where: { email: "mike@mikescarwash.co.za" },
      update: {},
      create: {
        email: "mike@mikescarwash.co.za",
        name: 'Michael "Mike" Nkosi',
        passwordHash,
        profiles: {
          create: {
            fullName: 'Michael "Mike" Nkosi',
            role: "owner",
            tenantId: mikeTenant.id,
          },
        },
      },
    });
    console.log("  ✅ Mike (owner) → mike@mikescarwash.co.za / demo1234");
  }

  // 2. Super Admin (founder) — no tenant, role=super_admin
  await db.user.upsert({
    where: { email: "admin@flavourly.os" },
    update: {},
    create: {
      email: "admin@flavourly.os",
      name: "Flavourly Founder",
      passwordHash,
      profiles: {
        create: {
          fullName: "Flavourly Founder",
          role: "super_admin",
          tenantId: null,
        },
      },
    },
  });
  console.log("  ✅ Super Admin → admin@flavourly.os / demo1234");

  console.log("\n🔑 Auth seed complete. Login credentials:");
  console.log("   Tenant owner: mike@mikescarwash.co.za / demo1234");
  console.log("   Super Admin:  admin@flavourly.os / demo1234");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
