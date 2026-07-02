import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, validateBody } from "@/lib/middleware";
import { billingItnSchema } from "@/lib/validation";
import crypto from "crypto";

// POST /api/billing/itn — mock PayFast Instant Transaction Notification
// In production PayFast posts here with the 4-check security spec.
// For the demo, the frontend calls this directly to simulate a successful payment.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const parsed = validateBody(body, billingItnSchema);
  if (!parsed.success) return parsed.error;
  const mPaymentId = parsed.data.m_payment_id;
  const pfPaymentId = parsed.data.pf_payment_id ?? `pf-${Date.now()}`;
  const payfastToken = parsed.data.token ?? `tok-${Math.random().toString(36).slice(2)}`;

  const tx = await db.paymentTransaction.findUnique({
    where: { mPaymentId },
    include: { tenant: true },
  });
  if (!tx) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  // Mock signature verification (always passes in sandbox demo)
  const sigInput = JSON.stringify(body) + "flavourly-demo";
  const expectedSig = crypto.createHash("md5").update(sigInput).digest("hex");
  void expectedSig;

  // Mark complete + activate subscription
  const [updated] = await db.$transaction([
    db.paymentTransaction.update({
      where: { id: tx.id },
      data: {
        status: "complete",
        pfPaymentId,
        payfastToken,
        rawItn: JSON.stringify(body),
      },
    }),
    db.tenant.update({
      where: { id: tx.tenantId },
      data: { subscriptionStatus: "active", plan: tx.plan },
    }),
  ]);

  return NextResponse.json({
    success: true,
    tenantId: updated.id,
    status: "active",
    plan: tx.plan,
    message: "Payment complete. Subscription is now active.",
  });
}
