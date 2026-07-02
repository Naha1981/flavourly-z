import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenant } from "@/lib/tenant-context";
import { rateLimit, validateBody } from "@/lib/middleware";
import { billingCheckoutSchema } from "@/lib/validation";
import crypto from "crypto";

const PLANS: Record<string, { amount: string; label: string }> = {
  starter: { amount: "299.00", label: "Flavourly OS — Starter Plan" },
  growth: { amount: "499.00", label: "Flavourly OS — Growth Plan" },
};

// POST /api/billing/checkout — generate a (mock) signed PayFast payload
// In production this builds the MD5 signature over the field-order spec.
// Here we create a pending payment_transactions row and return a mock payload.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = validateBody(body, billingCheckoutSchema);
  if (!parsed.success) return parsed.error;
  const plan = parsed.data.plan;
  const planConfig = PLANS[plan];
  const mPaymentId = crypto.randomUUID();

  await db.paymentTransaction.create({
    data: {
      tenantId: tenant.id,
      plan,
      amount: parseFloat(planConfig.amount),
      mPaymentId,
      status: "pending",
    },
  });

  // Mock signed payload (real PayFast would post these fields to sandbox.payfast.co.za)
  const fields: Record<string, string> = {
    merchant_id: "10000100",
    merchant_key: "46f0cd694581a",
    return_url: "/settings?upgrade=success",
    cancel_url: "/settings?upgrade=cancelled",
    notify_url: "/api/billing/itn",
    name_first: (tenant.ownerName ?? "").split(" ")[0] ?? "",
    name_last: (tenant.ownerName ?? "").split(" ").slice(1).join(" "),
    email_address: tenant.ownerEmail ?? "",
    m_payment_id: mPaymentId,
    amount: planConfig.amount,
    item_name: planConfig.label,
    item_description: `Monthly WhatsApp loyalty subscription for ${tenant.name}`,
    custom_str1: tenant.id,
    custom_str2: plan,
    subscription_type: "1",
    recurring_amount: planConfig.amount,
    frequency: "3", // monthly
    cycles: "0", // indefinite
  };

  // Mock signature (deterministic so the demo ITN can "verify" it)
  const sigInput = Object.entries(fields)
    .map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%20/g, "+")}`)
    .join("&") + "&passphrase=flavourly-demo";
  const signature = crypto.createHash("md5").update(sigInput).digest("hex");
  fields.signature = signature;

  return NextResponse.json({
    payfastUrl: "https://sandbox.payfast.co.za/eng/process",
    sandbox: true,
    plan,
    amount: planConfig.amount,
    itemName: planConfig.label,
    mPaymentId,
    fields,
    // For the demo: a one-click "simulate payment" hint
    simulateItnUrl: "/api/billing/itn",
  });
}
