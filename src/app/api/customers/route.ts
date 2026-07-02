import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenantStrict } from "@/lib/tenant-context";
import { churnRisk, normalizeZAPhone } from "@/lib/flavourly";

// GET /api/customers?filter=all|active|at_risk|vip|new&q=&sort=
export async function GET(req: NextRequest) {
  const tenant = await getActiveTenantStrict();
  const { searchParams } = new URL(req.url);
  const filter = searchParams.get("filter") ?? "all";
  const q = searchParams.get("q")?.trim() ?? "";
  const sort = searchParams.get("sort") ?? "recent";

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 86400000);
  const sevenDaysAgo = new Date(now - 7 * 86400000);

  const where: Record<string, unknown> = { tenantId: tenant.id };

  if (filter === "active") {
    where.lastVisit = { gte: thirtyDaysAgo };
  } else if (filter === "inactive") {
    where.OR = [{ lastVisit: { lt: thirtyDaysAgo } }, { lastVisit: null }];
  } else if (filter === "at_risk") {
    where.OR = [
      { lastVisit: { lt: thirtyDaysAgo } },
    ];
    // also exclude dormant (>60d) — handled in post for simplicity? keep at_risk = 30-60
    where.AND = [
      { OR: [{ lastVisit: { lt: thirtyDaysAgo } }, { lastVisit: null }] },
    ];
  } else if (filter === "vip") {
    // top 10% by points
    const all = await db.customer.findMany({
      where: { tenantId: tenant.id },
      select: { points: true },
      orderBy: { points: "desc" },
    });
    const cutoff = Math.max(1, Math.ceil(all.length * 0.1));
    const vipThreshold = all[cutoff - 1]?.points ?? 10;
    where.points = { gte: vipThreshold };
  } else if (filter === "new") {
    where.joinedAt = { gte: sevenDaysAgo };
  }

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { phoneNumber: { contains: q } },
    ];
  }

  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (sort === "recent") orderBy = { lastVisit: "desc" };
  else if (sort === "name") orderBy = { name: "asc" };
  else if (sort === "points") orderBy = { points: "desc" };
  else if (sort === "visits") orderBy = { visits: "desc" };

  const customers = await db.customer.findMany({
    where,
    orderBy,
    take: 200,
  });

  const enriched = customers.map((c) => {
    const risk = churnRisk(c.lastVisit);
    return {
      ...c,
      churnRisk: risk,
      lastVisit: c.lastVisit?.toISOString() ?? null,
      joinedAt: c.joinedAt.toISOString(),
    };
  });

  return NextResponse.json({ customers: enriched, count: enriched.length });
}

// POST /api/customers — manually add a customer (sends mock WhatsApp welcome)
export async function POST(req: NextRequest) {
  const tenant = await getActiveTenantStrict();
  const body = await req.json().catch(() => ({}));
  const phone = normalizeZAPhone(body.phoneNumber ?? "");
  const name = (body.name ?? "").trim() || null;

  if (!phone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }

  const existing = await db.customer.findUnique({
    where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: phone } },
  });
  if (existing) {
    return NextResponse.json({ error: "Customer already exists" }, { status: 409 });
  }

  const customer = await db.customer.create({
    data: {
      tenantId: tenant.id,
      phoneNumber: phone,
      name,
      points: tenant.welcomePoints,
      visits: 0,
    },
  });

  await db.loyaltyTransaction.create({
    data: {
      tenantId: tenant.id,
      customerId: customer.id,
      pointsChange: tenant.welcomePoints,
      reason: "join_bonus",
    },
  });

  await db.activity.create({
    data: {
      tenantId: tenant.id,
      type: "added",
      customerId: customer.id,
      customerName: name ?? phone,
      message: `was added by staff and earned ${tenant.welcomePoints} ${tenant.currencyName}`,
    },
  });

  // Log a mock outbound webhook echo (as if the welcome was delivered)
  await db.webhookEvent.create({
    data: {
      tenantId: tenant.id,
      instanceName: tenant.whatsappInstanceId ?? "unknown",
      eventType: "message.sent",
      phoneNumber: phone,
      messageContent: `🎉 Welcome to ${tenant.name}! You've earned ${tenant.welcomePoints} ${tenant.currencyName} for joining.`,
      status: "processed",
      rawPayload: JSON.stringify({ direction: "outbound", to: phone }),
    },
  });

  return NextResponse.json({ ...customer, churnRisk: "active" }, { status: 201 });
}
