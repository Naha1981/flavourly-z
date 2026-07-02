import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenant } from "@/lib/tenant-context";
import { rateLimit, validateBody } from "@/lib/middleware";
import { whatsappConnectSchema } from "@/lib/validation";
import {
  getInstanceQR,
  getConnectionState,
  getInstanceForTenant,
} from "@/lib/evolution";
import { getAppUrl } from "@/lib/app-url";

// POST /api/whatsapp/connect — fetches QR code for WhatsApp linking.
// Uses the shared Flavourly-os instance (or the tenant's own if configured).
// Does NOT create new instances — see lib/evolution.ts for architecture.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = validateBody(body, whatsappConnectSchema);
  if (!parsed.success) return parsed.error;
  const forceRefresh = parsed.data?.forceRefresh === true;

  // Determine which instance to use (tenant's own, or shared Flavourly-os)
  const instance = getInstanceForTenant(tenant);
  if (!instance) {
    return NextResponse.json(
      { error: "Evolution API not configured. Contact support." },
      { status: 503 }
    );
  }

  // If already connected, check the real connection state
  if (tenant.whatsappPhone && !forceRefresh) {
    const stateResult = await getConnectionState(
      instance.instanceName,
      instance.token
    );
    if (stateResult.success && stateResult.state === "open") {
      return NextResponse.json({
        alreadyConnected: true,
        instanceName: instance.instanceName,
        phone: tenant.whatsappPhone,
      });
    }
    // If not open, fall through to fetch a fresh QR
  }

  // Log the connection attempt
  await db.webhookEvent.create({
    data: {
      tenantId: tenant.id,
      instanceName: instance.instanceName,
      eventType: "connection.update",
      messageContent: "connecting",
      status: "processed",
      rawPayload: JSON.stringify({ event: "connection.update", state: "connecting" }),
    },
  });

  // Fetch the QR code from the existing Evolution API instance
  const qrResult = await getInstanceQR(instance.instanceName, instance.token);
  if (!qrResult.success || !qrResult.qrBase64) {
    return NextResponse.json(
      {
        error: qrResult.error ?? "Could not fetch QR — try again in a moment",
        instanceName: instance.instanceName,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    alreadyConnected: false,
    instanceName: instance.instanceName,
    qrBase64: qrResult.qrBase64,
    autoConnectAfterMs: 8000,
  });
}
