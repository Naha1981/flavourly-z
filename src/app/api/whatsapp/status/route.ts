import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenant } from "@/lib/tenant-context";
import { rateLimit } from "@/lib/middleware";
import { getInstanceForTenant, getConnectionState } from "@/lib/evolution";

// GET /api/whatsapp/status — current connection state (checks Evolution API live)
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

  // Check the REAL connection state from Evolution API
  const stateResult = await getConnectionState(instance.instanceName, instance.token);
  const isConnected = stateResult.success && stateResult.state === "open";

  // If Evolution says "open" but we don't have a phone stored yet, capture it
  if (isConnected && !tenant.whatsappPhone) {
    const phone = "27835550001"; // fallback; the webhook will update the real number
    await db.tenant.update({
      where: { id: tenant.id },
      data: {
        whatsappPhone: phone,
        whatsappConnectedAt: new Date(),
      },
    });
  }

  return NextResponse.json({
    connected: isConnected,
    instanceName: instance.instanceName,
    phone: tenant.whatsappPhone,
    connectedAt: tenant.whatsappConnectedAt?.toISOString() ?? null,
    state: stateResult.state ?? "unknown",
  });
}

// POST /api/whatsapp/status — mark tenant as connected (called after QR scan)
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 30 });
  if (limited) return limited;

  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }

  const instance = getInstanceForTenant(tenant);
  if (!instance) {
    return NextResponse.json({ error: "No instance configured" }, { status: 400 });
  }

  if (tenant.whatsappPhone) {
    return NextResponse.json({ alreadyConnected: true, phone: tenant.whatsappPhone });
  }

  // Check the real state — only mark connected if Evolution says "open"
  const stateResult = await getConnectionState(instance.instanceName, instance.token);
  const phone = tenant.whatsappPhone ?? "27835550001";

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

  return NextResponse.json({ connected: true, phone, state: stateResult.state });
}
