import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { rateLimit, validateBody } from "@/lib/middleware";
import { z } from "zod";
import { INDUSTRY_CURRENCY, INDUSTRY_LABELS, INDUSTRY_EMOJI } from "@/lib/flavourly";

const claimSchema = z.object({
  ownerName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// GET /api/claim/:token — fetch ghost tenant by claim token
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = rateLimit(req, { max: 120 });
  if (limited) return limited;

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

// POST /api/claim/:token — claim the dashboard + create the owner's auth account
// Body: { ownerName, email, password }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const limited = rateLimit(req, { max: 30 });
  if (limited) return limited;

  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = validateBody(body, claimSchema);
  if (!parsed.success) return parsed.error;
  const { ownerName, email, password } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  // Check for existing user
  const existingUser = await db.user.findUnique({ where: { email: emailLower } });
  if (existingUser) {
    return NextResponse.json(
      { error: "An account with this email already exists. Log in instead." },
      { status: 409 }
    );
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
  const passwordHash = await bcrypt.hash(password, 10);

  // Claim the tenant + create the owner's User + Profile atomically
  const [updated] = await db.$transaction([
    db.tenant.update({
      where: { id: tenant.id },
      data: {
        ownerName,
        ownerEmail: emailLower,
        subscriptionStatus: "trial",
        trialEndsAt,
        claimedAt: new Date(),
      },
    }),
    db.user.create({
      data: {
        email: emailLower,
        name: ownerName,
        passwordHash,
        profiles: {
          create: {
            fullName: ownerName,
            role: "owner",
            tenantId: tenant.id,
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    tenantId: updated.id,
    tenantName: updated.name,
    email: emailLower,
    trialEndsAt: updated.trialEndsAt?.toISOString(),
    message: "Dashboard claimed! Your 14-day free trial has started.",
  });
}
