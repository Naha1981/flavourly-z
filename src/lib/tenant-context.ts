import { db } from "@/lib/db";

// In this single-page demo, the "logged-in" tenant is Mike's Car Wash
// (the first connected, non-unclaimed tenant). The super admin views
// operate across all tenants.
export async function getActiveTenant() {
  const tenant = await db.tenant.findFirst({
    where: {
      subscriptionStatus: { in: ["trial", "active", "paused"] },
      whatsappInstanceId: { not: null },
    },
    orderBy: { createdAt: "asc" },
  });
  return tenant;
}

export async function getActiveTenantStrict() {
  const t = await getActiveTenant();
  if (!t) throw new Error("No active tenant found");
  return t;
}

// R100 conservative basket size for revenue estimates (per PRD F-I01)
export const REVENUE_PER_REDEMPTION = 100;
