import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INDUSTRY_CURRENCY, INDUSTRY_LABELS, normalizeZAPhone, toSlug } from "@/lib/flavourly";

// GET /api/prospects
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const industry = searchParams.get("industry");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (industry) where.industry = industry;

  const prospects = await db.prospect.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { tenant: { select: { id: true, name: true, claimToken: true, currencyName: true, subscriptionStatus: true } } },
  });

  return NextResponse.json({
    prospects: prospects.map((p) => ({
      ...p,
      industryLabel: INDUSTRY_LABELS[p.industry] ?? p.industry,
      claimToken: p.tenant?.claimToken ?? null,
      claimUrl: p.tenant?.claimToken
        ? `/claim/${p.tenant.claimToken}`
        : null,
      tenantStatus: p.tenant?.subscriptionStatus ?? null,
      tenant: undefined,
    })),
  });
}

// POST /api/prospects — bulk ingest (replaces CSV upload server-side parsing for demo)
// Body: { industry, rows: [{ businessName, ownerName?, phoneNumber, location? }] }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const industry = (body.industry ?? "restaurant").toString().toLowerCase();
  const rows: Array<Record<string, string>> = Array.isArray(body.rows) ? body.rows : [];

  if (!rows.length) {
    return NextResponse.json({ error: "No rows provided" }, { status: 400 });
  }

  const currencyName = INDUSTRY_CURRENCY[industry] ?? "Points";
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const businessName = (row.businessName ?? row.business_name ?? "").trim();
    const ownerName = (row.ownerName ?? row.owner_name ?? "").trim() || null;
    const phone = normalizeZAPhone(row.phoneNumber ?? row.phone_number ?? "");
    const location = (row.location ?? "").trim() || null;

    if (!businessName || !phone) {
      skipped++;
      continue;
    }

    try {
      const baseSlug = toSlug(businessName);
      const tenantSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      const tenant = await db.tenant.create({
        data: {
          name: businessName,
          slug: tenantSlug,
          industry,
          currencyName,
          subscriptionStatus: "unclaimed",
          plan: "starter",
        },
      });
      await db.prospect.create({
        data: {
          businessName,
          ownerName,
          phoneNumber: phone,
          location,
          industry,
          status: "new",
          tenantId: tenant.id,
        },
      });
      created++;
    } catch (e) {
      errors.push(`${businessName}: ${(e as Error).message}`);
      skipped++;
    }
  }

  return NextResponse.json({ created, skipped, errors: errors.slice(0, 10) });
}
