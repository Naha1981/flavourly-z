import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenant } from "@/lib/tenant-context";
import { rateLimit } from "@/lib/middleware";
import { getInstanceForTenant, getConnectionState } from "@/lib/evolution";

// GET /api/whatsapp/status — current connection state
// A tenant is "connected" ONLY if they have their own whatsappPhone stored.
// We do NOT use the shared instance's connection state as the source of truth,
// because the shared instance might be connected to a DIFFERENT tenant's number.
export async function GET(req: NextRequest) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }

  // A tenant is connected ONLY if they have their own phone number stored
  const connected = !!tenant.whatsappPhone;
  return NextResponse.json({
    connected,
    instanceName: tenant.whatsappInstanceId ?? getInstanceForTenant(tenant)?.instanceName ?? null,
    phone: tenant.whatsappPhone,
    connectedAt: tenant.whatsappConnectedAt?.toISOString() ?? null,
  });
}

// POST /api/whatsapp/status — check if the Evolution API instance is now "open"
// (i.e. the user scanned the QR). If so, fetch the connected phone number from
// the Evolution API and store it on the tenant. This is called by the frontend
// after polling. The real source of truth is the webhook connection.update event,
// but this endpoint lets the frontend detect the connection without waiting for
// the webhook (which may be delayed).
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }

  // Already connected — nothing to do
  if (tenant.whatsappPhone) {
    return NextResponse.json({ alreadyConnected: true, phone: tenant.whatsappPhone });
  }

  const instance = getInstanceForTenant(tenant);
  if (!instance) {
    return NextResponse.json({ error: "No instance configured" }, { status: 400 });
  }

  // Check the REAL connection state from Evolution API
  const stateResult = await getConnectionState(instance.instanceName, instance.token);

  if (!stateResult.success || stateResult.state !== "open") {
    // Not connected yet — tell the frontend to keep waiting
    return NextResponse.json({
      connected: false,
      state: stateResult.state ?? "unknown",
      message: "Scan the QR code with your WhatsApp to connect.",
    });
  }

  // The instance is "open" — but we need the ACTUAL phone number.
  // Try to fetch it from the Evolution API instance info.
  let phone: string | null = null;
  try {
    const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
    if (EVOLUTION_API_URL) {
      const infoRes = await fetch(
        `${EVOLUTION_API_URL}/instance/fetchInstances?instanceName=${instance.instanceName}`,
        { headers: { apikey: instance.token } }
      );
      if (infoRes.ok) {
        const infoData = await infoRes.json();
        // The response is an array of instances; get the first one's number
        const info = Array.isArray(infoData) ? infoData[0] : infoData;
        phone = info?.number ?? info?.instance?.number ?? null;
      }
    }
  } catch {
    // If we can't fetch the phone, we'll use the webhook event later
  }

  if (!phone) {
    // Can't determine the phone yet — the webhook will update it when it fires
    return NextResponse.json({
      connected: false,
      state: "open",
      message: "Connection detected. Waiting for phone number...",
    });
  }

  // Store the real phone number on THIS tenant
  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      whatsappPhone: phone,
      whatsappConnectedAt: new Date(),
    },
  });

  await db.webhookEvent.create({
    data: {
      tenantId: tenant.id,
      instanceName: instance.instanceName,
      eventType: "connection.update",
      messageContent: "open",
      status: "processed",
      rawPayload: JSON.stringify({
        event: "connection.update",
        instance: { instanceName: instance.instanceName },
        data: { state: "open", wuid: `${phone}@s.whatsapp.net` },
      }),
    },
  });

  return NextResponse.json({ connected: true, phone });
}
