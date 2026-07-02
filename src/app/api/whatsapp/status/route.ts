import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenant } from "@/lib/tenant-context";

// GET /api/whatsapp/status — current connection state
export async function GET() {
  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }

  const connected = !!(tenant.whatsappInstanceId && tenant.whatsappPhone);
  return NextResponse.json({
    connected,
    instanceName: tenant.whatsappInstanceId,
    phone: tenant.whatsappPhone,
    connectedAt: tenant.whatsappConnectedAt?.toISOString() ?? null,
  });
}

// POST /api/whatsapp/status — simulate the "open" event arriving from Evolution API
// (In production this happens via the webhook. Here the frontend polls connect, then
// calls this to flip the tenant to connected after the QR has been shown.)
export async function POST() {
  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }
  if (!tenant.whatsappInstanceId) {
    return NextResponse.json({ error: "No instance to connect" }, { status: 400 });
  }
  if (tenant.whatsappPhone) {
    return NextResponse.json({ alreadyConnected: true, phone: tenant.whatsappPhone });
  }

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
      instanceName: tenant.whatsappInstanceId,
      eventType: "connection.update",
      messageContent: "open",
      status: "processed",
      rawPayload: JSON.stringify({
        event: "connection.update",
        instance: { instanceName: tenant.whatsappInstanceId },
        data: { state: "open", wuid: `${phone}@s.whatsapp.net` },
      }),
    },
  });

  return NextResponse.json({ connected: true, phone });
}
