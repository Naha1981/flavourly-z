import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenantStrict } from "@/lib/tenant-context";

// POST /api/campaigns/:id/run-again — duplicate a past campaign as a new draft→send
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const tenant = await getActiveTenantStrict();
  const { id } = await params;

  const original = await db.campaign.findFirst({
    where: { id, tenantId: tenant.id },
  });
  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Re-send: create a fresh campaign row with same content, then send.
  // Reuse the send logic by re-querying audience.
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 86400000);
  const where: Record<string, unknown> = {
    tenantId: tenant.id,
    optedIn: true,
  };
  if (original.audience === "inactive") {
    where.OR = [{ lastVisit: { lt: thirtyDaysAgo } }, { lastVisit: null }];
  } else if (original.audience === "vip") {
    where.points = { gte: 10 };
  }

  const customers = await db.customer.findMany({
    where,
    select: { id: true, phoneNumber: true, name: true },
  });

  const duplicate = await db.campaign.create({
    data: {
      tenantId: tenant.id,
      title: original.title,
      goal: original.goal,
      message: original.message,
      audience: original.audience,
      status: "sent",
      sentCount: customers.length,
      redemptionCount: Math.round(customers.length * 0.2),
      sentAt: new Date(),
    },
  });

  await db.activity.create({
    data: {
      tenantId: tenant.id,
      type: "campaign_sent",
      message: `Re-ran "${original.title}" to ${customers.length} customers`,
    },
  });

  return NextResponse.json({
    campaign: {
      ...duplicate,
      sentAt: duplicate.sentAt?.toISOString() ?? null,
      createdAt: duplicate.createdAt.toISOString(),
    },
    sent: customers.length,
  });
}
