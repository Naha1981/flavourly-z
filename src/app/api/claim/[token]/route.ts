import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INDUSTRY_CURRENCY, INDUSTRY_LABELS, INDUSTRY_EMOJI } from "@/lib/flavourly";

// GET /api/claim/:token — fetch ghost tenant by claim token
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const tenant = await db.tenant.findUnique({
    where: { claimToken: token },
  });

  if (!tenant) {
    return NextResponse.json({ error: "expired", message: "This link has expired or is invalid." }, { status: 404 });
  }
  if (tenant.subscriptionStatus !== "unclaimed") {
    return NextResponse.json({
      error: "claimed",
      message: "This dashboard has already been claimed.",
      tenantName: tenant.name,
    }, { status: 410 });
  }

  return NextResponse.json({
    id: tenant.id,
    name: tenant.name,
    industry: tenant.industry,
    industryLabel: INDUSTRY_LABELS[tenant.industry] ?? tenant.industry,
    industryEmoji: INDUSTRY_EMOJI[tenant.industry] ?? "✨",
    currencyName: tenant.currencyName ?? INDUSTRY_CURRENCY[tenant.industry] ?? "Points",
    brandColor: tenant.brandColor,
    logoUrl: tenant.logoUrl,
    locationLabel: tenant.locationLabel,
  });
}

// POST /api/claim/:token — claim the dashboard (set owner password + flip to trial)
// Body: { ownerName, email, password }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const ownerName = (body.ownerName ?? "").trim();
  const email = (body.email ?? "").trim();
  const password = (body.password ?? "").toString();

  if (!ownerName || !email || !password || password.length < 6) {
    return NextResponse.json({ error: "All fields required (password min 6 chars)" }, { status: 400 });
  }

  const tenant = await db.tenant.findUnique({ where: { claimToken: token } });
  if (!tenant) {
    return NextResponse.json({ error: "expired" }, { status: 404 });
  }
  if (tenant.subscriptionStatus !== "unclaimed") {
    return NextResponse.json({ error: "claimed" }, { status: 410 });
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const updated = await db.tenant.update({
    where: { id: tenant.id },
    data: {
      ownerName,
      ownerEmail: email,
      subscriptionStatus: "trial",
      trialEndsAt,
      claimedAt: new Date(),
    },
  });

  return NextResponse.json({
    success: true,
    tenantId: updated.id,
    tenantName: updated.name,
    trialEndsAt: updated.trialEndsAt?.toISOString(),
    message: "Dashboard claimed! Your 14-day free trial has started.",
  });
}
