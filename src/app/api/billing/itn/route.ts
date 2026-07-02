import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";

// POST /api/billing/itn — mock PayFast Instant Transaction Notification
// In production PayFast posts here with the 4-check security spec.
// For the demo, the frontend calls this directly to simulate a successful payment.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mPaymentId = body.m_payment_id;
  const pfPaymentId = body.pf_payment_id ?? `pf-${Date.now()}`;
  const payfastToken = body.token ?? `tok-${Math.random().toString(36).slice(2)}`;

  if (!mPaymentId) {
    return NextResponse.json({ error: "m_payment_id required" }, { status: 400 });
  }

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
