import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenant } from "@/lib/tenant-context";
import { INDUSTRY_CURRENCY, INDUSTRY_LABELS } from "@/lib/flavourly";

// GET /api/tenant — active demo tenant
export async function GET() {
  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }

  const [customerCount, campaignCount] = await Promise.all([
    db.customer.count({ where: { tenantId: tenant.id } }),
    db.campaign.count({ where: { tenantId: tenant.id } }),
  ]);

  return NextResponse.json({
    ...tenant,
    industryLabel: INDUSTRY_LABELS[tenant.industry] ?? tenant.industry,
    currencyName: tenant.currencyName ?? INDUSTRY_CURRENCY[tenant.industry] ?? "Points",
    trialDaysLeft: tenant.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000))
      : null,
    customerCount,
    campaignCount,
  });
}

// PATCH /api/tenant — update business profile (settings)
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }

  const allowed = [
    "name", "industry", "currencyName", "brandColor", "logoUrl",
    "welcomePoints", "rewardThreshold", "locationLabel", "locationLat", "locationLng",
    "ownerName", "ownerEmail",
  ] as const;

  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (body[k] !== undefined) data[k] = body[k];
  }

  if (body.industry && body.currencyName === undefined) {
    data.currencyName = INDUSTRY_CURRENCY[body.industry] ?? "Points";
  }

  const updated = await db.tenant.update({
    where: { id: tenant.id },
    data,
  });

  return NextResponse.json({
    ...updated,
    industryLabel: INDUSTRY_LABELS[updated.industry] ?? updated.industry,
    trialDaysLeft: updated.trialEndsAt
      ? Math.max(0, Math.ceil((new Date(updated.trialEndsAt).getTime() - Date.now()) / 86400000))
      : null,
  });
}
