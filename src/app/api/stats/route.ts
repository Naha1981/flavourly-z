import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenantStrict } from "@/lib/tenant-context";

// GET /api/stats — dashboard headline stats + today's counts
export async function GET() {
  const tenant = await getActiveTenantStrict();
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const [joinedToday, redeemedToday, visitsToday, totalCustomers, totalRedemptions] =
    await Promise.all([
      db.customer.count({
        where: { tenantId: tenant.id, joinedAt: { gte: startOfToday } },
      }),
      db.rewardEvent.count({
        where: { tenantId: tenant.id, status: "claimed", claimedAt: { gte: startOfToday } },
      }),
      db.loyaltyTransaction.count({
        where: { tenantId: tenant.id, reason: "visit", createdAt: { gte: startOfToday } },
      }),
      db.customer.count({ where: { tenantId: tenant.id } }),
      db.rewardEvent.count({ where: { tenantId: tenant.id, status: "claimed" } }),
    ]);

  return NextResponse.json({
    joinedToday,
    redeemedToday,
    visitsToday,
    totalCustomers,
    totalRedemptions,
  });
}
