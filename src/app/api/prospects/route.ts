import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INDUSTRY_CURRENCY, INDUSTRY_LABELS, normalizeZAPhone, toSlug } from "@/lib/flavourly";
import { rateLimit, validateBody } from "@/lib/middleware";
import { prospectIngestSchema } from "@/lib/validation";

// GET /api/prospects
export async function GET(req: NextRequest) {
  const limited = rateLimit(req);
  if (limited) return limited;

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
  const limited = rateLimit(req, { windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const parsed = validateBody(body, prospectIngestSchema);
  if (!parsed.success) return parsed.error;
  const industry = parsed.data.industry;
  const rows = parsed.data.rows;

  const currencyName = INDUSTRY_CURRENCY[industry] ?? "Points";
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const businessName = (row.businessName ?? "").trim();
    const ownerName = (row.ownerName ?? "").trim() || null;
    const phone = normalizeZAPhone(row.phoneNumber ?? "");
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
