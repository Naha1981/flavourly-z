import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenant } from "@/lib/tenant-context";
import { rateLimit, validateBody } from "@/lib/middleware";
import { whatsappConnectSchema } from "@/lib/validation";
import {
  getInstanceQR,
  getConnectionState,
  getInstanceForTenant,
  logoutInstance,
  warmUpEvolutionApi,
} from "@/lib/evolution";

// POST /api/whatsapp/connect — fetches QR code for WhatsApp linking.
// Body options:
//   { forceRefresh?: boolean }   — fetch a fresh QR
//   { forceNewNumber?: boolean } — logout old session, clear phone, fetch fresh QR
//
// The forceNewNumber flow does everything in ONE request (logout + delay + QR)
// to match the pattern in the Evolution API reference. A warm-up ping is sent
// first to avoid Render cold-start timeouts.
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
  const forceNewNumber = (body as Record<string, unknown>)?.forceNewNumber === true;

  const instance = getInstanceForTenant(tenant);
  if (!instance) {
    return NextResponse.json(
      { error: "Evolution API not configured. Contact support." },
      { status: 503 }
    );
  }

  // Warm up the Evolution API (Render free tier cold starts can take 30-60s)
  await warmUpEvolutionApi();

  // ── "Change WhatsApp Number" flow ────────────────────────────────────────
  if (forceNewNumber) {
    // 1. Logout the current WhatsApp session
    const logoutResult = await logoutInstance(instance.instanceName, instance.token);
    // 400 "not connected" is OK — means it was already logged out
    if (!logoutResult.success) {
      return NextResponse.json(
        { error: `Could not disconnect old number: ${logoutResult.error}` },
        { status: 502 }
      );
    }

    // 2. Clear the tenant's stored phone
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

    // 4. Give Evolution API a moment to reset internal session state
    await new Promise((r) => setTimeout(r, 1500));

    // Fall through to fetch a fresh QR below
  }

  // If already connected (and not forcing), check the real state
  if (tenant.whatsappPhone && !forceRefresh && !forceNewNumber) {
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

  // Fetch the QR code
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
  });
}
