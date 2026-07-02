import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  fullName: z.string().min(1, "Your name is required").max(80),
  // Optional: link to an existing (ghost) tenant via claim token
  claimToken: z.string().optional(),
});

// POST /api/auth/signup — create a User + Profile, optionally claim a ghost tenant
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, fullName, claimToken } = parsed.data;
  const emailLower = email.toLowerCase().trim();

  // Check for existing user
  const existing = await db.user.findUnique({ where: { email: emailLower } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Try logging in." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  // If claimToken provided, verify and claim the ghost tenant
  let tenantId: string | null = null;
  if (claimToken) {
    const tenant = await db.tenant.findUnique({ where: { claimToken } });
    if (!tenant || tenant.subscriptionStatus !== "unclaimed") {
      return NextResponse.json(
        { error: "This claim link is invalid or already used." },
        { status: 400 }
      );
    }
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);
    const updated = await db.tenant.update({
      where: { id: tenant.id },
      data: {
        ownerName: fullName,
        ownerEmail: emailLower,
        subscriptionStatus: "trial",
        trialEndsAt,
        claimedAt: new Date(),
      },
    });
    tenantId = updated.id;
  }

  // Create User + Profile in a transaction
  const user = await db.user.create({
    data: {
      email: emailLower,
      name: fullName,
      passwordHash,
      profiles: {
        create: {
          fullName,
          role: claimToken ? "owner" : "owner",
          tenantId,
        },
      },
    },
    include: { profiles: true },
  });

  return NextResponse.json({
    success: true,
    userId: user.id,
    email: user.email,
    tenantId,
    message: claimToken
      ? "Dashboard claimed! Your 14-day free trial has started."
      : "Account created. You can now log in.",
  });
}
