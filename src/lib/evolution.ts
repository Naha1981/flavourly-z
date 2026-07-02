// Flavourly OS — Evolution API client helper
// Sends WhatsApp messages via the Evolution API gateway.
//
// ARCHITECTURE: All tenants share the single "Flavourly-os" Evolution API
// instance (configured via EVOLUTION_INSTANCE_NAME + EVOLUTION_INSTANCE_TOKEN).
// We do NOT create per-tenant instances via API — the global API key on this
// Evolution deployment doesn't allow /instance/create. If you need per-tenant
// instances, create them manually in Evolution Manager and store the token
// on each Tenant record.

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;
const EVOLUTION_INSTANCE_TOKEN = process.env.EVOLUTION_INSTANCE_TOKEN;

/**
 * Get the instance name + token to use for a given tenant.
 * Falls back to the shared Flavourly-os instance if the tenant doesn't
 * have its own instance configured.
 */
export function getInstanceForTenant(tenant: {
  whatsappInstanceId: string | null;
  whatsappInstanceToken: string | null;
}): EvolutionInstance | null {
  // If tenant has its own instance + token, use it
  if (tenant.whatsappInstanceId && tenant.whatsappInstanceToken) {
    return {
      instanceName: tenant.whatsappInstanceId,
      token: tenant.whatsappInstanceToken,
    };
  }
  // Fall back to the shared Flavourly-os instance
  if (EVOLUTION_INSTANCE_NAME && EVOLUTION_INSTANCE_TOKEN) {
    return {
      instanceName: EVOLUTION_INSTANCE_NAME,
      token: EVOLUTION_INSTANCE_TOKEN,
    };
  }
  return null;
}

export interface EvolutionInstance {
  instanceName: string;
  token: string;
}

/**
 * Send a text message via Evolution API.
 */
export async function sendWhatsAppText(
  instanceName: string,
  instanceToken: string,
  number: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  if (!EVOLUTION_API_URL) {
    return { success: false, error: "EVOLUTION_API_URL not configured" };
  }

  const cleanNumber = number.replace(/@s\.whatsapp\.net$/, "").replace(/\D/g, "");

  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/message/sendText/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: instanceToken,
        },
        body: JSON.stringify({
          number: cleanNumber,
          text,
          delay: 1200,
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error(`[evolution] sendText failed [${res.status}]:`, errText.slice(0, 200));
      return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 100)}` };
    }

    return { success: true };
  } catch (err) {
    console.error("[evolution] sendText error:", err);
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Fetch the QR code for an existing instance (for WhatsApp linking).
 * Does NOT create a new instance — uses getInstanceForTenant() to pick
 * the right one.
 */
export async function getInstanceQR(
  instanceName: string,
  instanceToken: string
): Promise<{ success: boolean; qrBase64?: string; error?: string }> {
  if (!EVOLUTION_API_URL) {
    return { success: false, error: "EVOLUTION_API_URL not configured" };
  }

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
      headers: { apikey: instanceToken },
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Could not fetch QR (HTTP ${res.status})`,
      };
    }

    const data = (await res.json()) as {
      base64?: string;
      code?: string;
      qrcode?: { code?: string };
    };
    let qrBase64 = data.base64 ?? data.qrcode?.code ?? null;

    if (qrBase64 && !qrBase64.startsWith("data:")) {
      qrBase64 = `data:image/png;base64,${qrBase64}`;
    }

    return { success: true, qrBase64: qrBase64 ?? undefined };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Check the connection state of an instance.
 */
export async function getConnectionState(
  instanceName: string,
  instanceToken: string
): Promise<{ success: boolean; state?: string; error?: string }> {
  if (!EVOLUTION_API_URL) {
    return { success: false, error: "EVOLUTION_API_URL not configured" };
  }

  try {
    const res = await fetch(
      `${EVOLUTION_API_URL}/instance/connectionState/${instanceName}`,
      { headers: { apikey: instanceToken } }
    );

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const data = (await res.json()) as { instance?: { state?: string } };
    return {
      success: true,
      state: data.instance?.state ?? "unknown",
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
