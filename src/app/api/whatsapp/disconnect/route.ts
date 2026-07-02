import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenant } from "@/lib/tenant-context";
import { rateLimit } from "@/lib/middleware";
import { getInstanceForTenant, logoutInstance } from "@/lib/evolution";

// POST /api/whatsapp/disconnect — logout the current WhatsApp session
// and clear the tenant's phone. Used by the "Change WhatsApp Number" flow.
// This is a SEPARATE endpoint from /connect so each call is fast (the
// Evolution API on Render's free tier can take 30-60s on cold starts).
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }

  const instance = getInstanceForTenant(tenant);
  if (!instance) {
    return NextResponse.json(
      { error: "Evolution API not configured" },
      { status: 503 }
    );
  }

  // 1. Logout the current WhatsApp session on Evolution API
  const logoutResult = await logoutInstance(instance.instanceName, instance.token);
  if (!logoutResult.success) {
    return NextResponse.json(
      { error: `Could not disconnect: ${logoutResult.error}` },
      { status: 502 }
    );
  }

  // 2. Clear the tenant's stored phone + connection timestamp
  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      whatsappPhone: null,
      whatsappConnectedAt: null,
    },
  });

  // 3. Log the disconnect event
  await db.webhookEvent.create({
    data: {
      tenantId: tenant.id,
      instanceName: instance.instanceName,
      eventType: "connection.update",
      messageContent: "disconnected_by_user",
      status: "processed",
      rawPayload: JSON.stringify({
        event: "connection.update",
        data: { state: "disconnected", reason: "user_requested_new_number" },
      }),
    },
  });

  return NextResponse.json({
    success: true,
    message: "Old number disconnected. Now fetch a new QR.",
  });
}
