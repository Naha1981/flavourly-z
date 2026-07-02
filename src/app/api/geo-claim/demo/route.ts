import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenantStrict } from "@/lib/tenant-context";

// POST /api/geo-claim/demo — create a fresh reward event for demo purposes
// Returns the event id so the frontend can open /geo-claim/:id
export async function POST() {
  const tenant = await getActiveTenantStrict();

  // pick a customer with enough points (or the first customer)
  const customer = await db.customer.findFirst({
    where: { tenantId: tenant.id, points: { gte: tenant.rewardThreshold } },
    orderBy: { points: "desc" },
  });
  const target = customer ?? (await db.customer.findFirst({ where: { tenantId: tenant.id } }));
  if (!target) {
    return NextResponse.json({ error: "No customers to demo with" }, { status: 400 });
  }

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const event = await db.rewardEvent.create({
    data: {
      tenantId: tenant.id,
      customerId: target.id,
      triggerType: "geo",
      status: "sent",
      pointsCost: tenant.rewardThreshold,
      expiresAt,
    },
  });

  return NextResponse.json({
    eventId: event.id,
    customerName: target.name,
    expiresAt: expiresAt.toISOString(),
  });
}
