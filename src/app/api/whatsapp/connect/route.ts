import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenant } from "@/lib/tenant-context";
import { toSlug } from "@/lib/flavourly";
import { rateLimit, validateBody } from "@/lib/middleware";
import { whatsappConnectSchema } from "@/lib/validation";
import {
  createInstance,
  getInstanceQR,
  setWebhook,
  getConnectionState,
} from "@/lib/evolution";
import { getAppUrl } from "@/lib/app-url";

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;

// POST /api/whatsapp/connect — creates/fetches an Evolution API instance + QR code
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

  // If already connected, check the real connection state
  if (
    tenant.whatsappInstanceId &&
    tenant.whatsappInstanceToken &&
    tenant.whatsappPhone &&
    !forceRefresh
  ) {
    const stateResult = await getConnectionState(
      tenant.whatsappInstanceId,
      tenant.whatsappInstanceToken
    );
    if (stateResult.success && stateResult.state === "open") {
      return NextResponse.json({
        alreadyConnected: true,
        instanceName: tenant.whatsappInstanceId,
        phone: tenant.whatsappPhone,
      });
    }
    // If not open, fall through to fetch a fresh QR
  }

  // Determine instance name + token
  const instanceName =
    tenant.whatsappInstanceId ?? `tenant_${toSlug(tenant.slug ?? tenant.name)}`;

  // If tenant doesn't have a token yet, try to create the instance
  let instanceToken = tenant.whatsappInstanceToken;

  if (!instanceToken) {
    // Create a new instance via Evolution API
    const createResult = await createInstance(instanceName);
    if (!createResult.success || !createResult.token) {
      return NextResponse.json(
        { error: createResult.error ?? "Failed to create instance" },
        { status: 502 }
      );
    }
    instanceToken = createResult.token;

    // Persist instance name + token
    await db.tenant.update({
      where: { id: tenant.id },
      data: {
        whatsappInstanceId: instanceName,
        whatsappInstanceToken: instanceToken,
      },
    });

    // Set the webhook URL on this instance so it forwards to our app
    const webhookUrl = `${getAppUrl()}/api/webhooks`;
    await setWebhook(instanceName, instanceToken, webhookUrl);
  } else if (forceRefresh) {
    // Already has a token — just set the webhook again to make sure
    const webhookUrl = `${getAppUrl()}/api/webhooks`;
    await setWebhook(instanceName, instanceToken, webhookUrl);
  }

  // Log the connection attempt
  await db.webhookEvent.create({
    data: {
      tenantId: tenant.id,
      instanceName,
      eventType: "connection.update",
      messageContent: "connecting",
      status: "processed",
      rawPayload: JSON.stringify({ event: "connection.update", state: "connecting" }),
    },
  });

  // Fetch the QR code from Evolution API
  const qrResult = await getInstanceQR(instanceName, instanceToken);
  if (!qrResult.success || !qrResult.qrBase64) {
    return NextResponse.json(
      {
        error: qrResult.error ?? "Could not fetch QR — try again in a moment",
        instanceName,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    alreadyConnected: false,
    instanceName,
    qrBase64: qrResult.qrBase64,
    // The frontend polls /api/whatsapp/status; Evolution API fires a
    // connection.update webhook when the user scans the QR.
    autoConnectAfterMs: 8000,
  });
}
