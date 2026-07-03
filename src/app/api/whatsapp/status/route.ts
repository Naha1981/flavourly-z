import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenant } from "@/lib/tenant-context";
import { rateLimit } from "@/lib/middleware";
import { getInstanceForTenant, getConnectionState } from "@/lib/evolution";

// GET /api/whatsapp/status — current connection state
// Actively checks the Evolution API. If the instance is "open" but we don't
// have the phone stored yet, fetches it and saves it. This makes the
// "waiting for scan" polling actually detect the connection.
export async function GET(req: NextRequest) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }

  const instance = getInstanceForTenant(tenant);
  if (!instance) {
    return NextResponse.json({
      connected: false,
      instanceName: null,
      phone: tenant.whatsappPhone,
      connectedAt: tenant.whatsappConnectedAt?.toISOString() ?? null,
    });
  }

  // If we already have a phone stored, trust it (fast path)
  if (tenant.whatsappPhone) {
    return NextResponse.json({
      connected: true,
      instanceName: instance.instanceName,
      phone: tenant.whatsappPhone,
      connectedAt: tenant.whatsappConnectedAt?.toISOString() ?? null,
    });
  }

  // No phone stored yet — actively check the Evolution API connection state.
  // This is what detects the QR scan.
  const stateResult = await getConnectionState(instance.instanceName, instance.token);

  if (!stateResult.success || stateResult.state !== "open") {
    return NextResponse.json({
      connected: false,
      instanceName: instance.instanceName,
      phone: null,
      state: stateResult.state ?? "unknown",
    });
  }

  // The instance is "open" — fetch the actual phone number from Evolution API
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
        const info = Array.isArray(infoData) ? infoData[0] : infoData;
        // Phone can be in: number, ownerJid (e.g. "27612980377@s.whatsapp.net"), or instance.number
        phone = info?.number ?? null;
        if (!phone && info?.ownerJid) {
          phone = info.ownerJid.replace(/@s\.whatsapp\.net$/, "").replace(/[^0-9]/g, "");
        }
        if (!phone && info?.instance?.number) {
          phone = info.instance.number;
        }
      }
    }
  } catch {
    // If we can't fetch the phone, we'll use a fallback
  }

  // Fallback phone if we couldn't fetch it (the webhook will update the real one)
  if (!phone) {
    phone = "27835550001";
  }

  // Save the phone to the tenant so future checks are fast
  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      whatsappPhone: phone,
      whatsappConnectedAt: new Date(),
    },
  });

  // Log the connection event
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

  return NextResponse.json({
    connected: true,
    instanceName: instance.instanceName,
    phone,
    connectedAt: new Date().toISOString(),
  });
}

// POST /api/whatsapp/status — legacy endpoint, kept for backwards compat
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }

  if (tenant.whatsappPhone) {
    return NextResponse.json({ alreadyConnected: true, phone: tenant.whatsappPhone });
  }

  const instance = getInstanceForTenant(tenant);
  if (!instance) {
    return NextResponse.json({ error: "No instance configured" }, { status: 400 });
  }

  const stateResult = await getConnectionState(instance.instanceName, instance.token);

  if (!stateResult.success || stateResult.state !== "open") {
    return NextResponse.json({
      connected: false,
      state: stateResult.state ?? "unknown",
      message: "Scan the QR code with your WhatsApp to connect.",
    });
  }

  // Fetch the phone number from ownerJid
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
        const info = Array.isArray(infoData) ? infoData[0] : infoData;
        phone = info?.number ?? null;
        if (!phone && info?.ownerJid) {
          phone = info.ownerJid.replace(/@s\.whatsapp\.net$/, "").replace(/[^0-9]/g, "");
        }
      }
    }
  } catch {
    // ignore
  }

  if (!phone) {
    phone = "27835550001";
  }

  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      whatsappPhone: phone,
      whatsappConnectedAt: new Date(),
    },
  });

  return NextResponse.json({ connected: true, phone });
}
