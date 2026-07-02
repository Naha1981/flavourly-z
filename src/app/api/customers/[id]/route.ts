import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenantStrict } from "@/lib/tenant-context";
import { churnRisk } from "@/lib/flavourly";
import { rateLimit, validateBody } from "@/lib/middleware";
import { customerAdjustSchema } from "@/lib/validation";

// GET /api/customers/:id — detail with loyalty history
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const tenant = await getActiveTenantStrict();
  const { id } = await params;

  const customer = await db.customer.findFirst({
    where: { id, tenantId: tenant.id },
  });
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [transactions, rewardEvents] = await Promise.all([
    db.loyaltyTransaction.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.rewardEvent.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    ...customer,
    churnRisk: churnRisk(customer.lastVisit),
    lastVisit: customer.lastVisit?.toISOString() ?? null,
    joinedAt: customer.joinedAt.toISOString(),
    transactions: transactions.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
    })),
    rewardEvents: rewardEvents.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString() ?? null,
      claimedAt: r.claimedAt?.toISOString() ?? null,
    })),
  });
}

// PATCH /api/customers/:id — manual point adjustment (+/-)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const tenant = await getActiveTenantStrict();
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = validateBody(body, customerAdjustSchema);
  if (!parsed.success) return parsed.error;
  const delta = parsed.data.pointsChange;
  const reason = parsed.data.reason ?? "manual_staff";
  const note = parsed.data.note ?? null;

  const customer = await db.customer.findFirst({ where: { id, tenantId: tenant.id } });
  if (!customer) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const newPoints = Math.max(0, customer.points + delta);
  const [updated] = await db.$transaction([
    db.customer.update({
      where: { id },
      data: { points: newPoints },
    }),
    db.loyaltyTransaction.create({
      data: {
        tenantId: tenant.id,
        customerId: id,
        pointsChange: delta,
        reason,
        note,
      },
    }),
  ]);

  await db.activity.create({
    data: {
      tenantId: tenant.id,
      type: "earned",
      customerId: id,
      customerName: customer.name ?? customer.phoneNumber,
      message: `${delta > 0 ? "was awarded" : "had deducted"} ${Math.abs(delta)} ${tenant.currencyName} by staff`,
    },
  });

  return NextResponse.json({
    ...updated,
    churnRisk: churnRisk(updated.lastVisit),
  });
}
