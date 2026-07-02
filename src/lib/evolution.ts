// Flavourly OS — Evolution API client helper
// Sends WhatsApp messages via the Evolution API gateway.

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_GLOBAL_KEY = process.env.EVOLUTION_GLOBAL_API_KEY;

export interface EvolutionInstance {
  instanceName: string;
  token: string;
}

/**
 * Send a text message via Evolution API.
 * Uses the tenant's instance name + token (stored on the Tenant record).
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

  // Clean the number (remove @s.whatsapp.net suffix if present)
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
          delay: 1200, // small delay to mimic human + avoid rate limits
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
 * Create a new Evolution API instance for a tenant.
 * Called by the WhatsApp connect flow in Settings.
 */
export async function createInstance(
  instanceName: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!EVOLUTION_API_URL || !EVOLUTION_GLOBAL_KEY) {
    return { success: false, error: "Evolution API not configured" };
  }

  // Generate a random token for this instance
  const token = crypto.randomUUID().replace(/-/g, "").toUpperCase();

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: EVOLUTION_GLOBAL_KEY,
      },
      body: JSON.stringify({
        instanceName,
        token,
        qrcode: true,
        number: "",
      }),
    });

    const data = await res.json().catch(() => ({}));

    // 403/400 with "already exists" is OK — we proceed to QR fetch
    const alreadyExists =
      !res.ok && JSON.stringify(data).toLowerCase().includes("already");

    if (!res.ok && !alreadyExists) {
      return {
        success: false,
        error: `Instance creation failed: ${JSON.stringify(data).slice(0, 200)}`,
      };
    }

    return { success: true, token };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Configure the webhook URL on an Evolution API instance.
 * This tells Evolution API to forward inbound messages to our app.
 */
export async function setWebhook(
  instanceName: string,
  instanceToken: string,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  if (!EVOLUTION_API_URL) {
    return { success: false, error: "EVOLUTION_API_URL not configured" };
  }

  try {
    const res = await fetch(`${EVOLUTION_API_URL}/webhook/set/${instanceName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: instanceToken,
      },
      body: JSON.stringify({
        url: webhookUrl,
        webhook_by_events: true,
        events: ["MESSAGES_UPSERT", "CONNECTION_UPDATE"],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { success: false, error: `HTTP ${res.status}: ${errText.slice(0, 100)}` };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Fetch the QR code for an instance (for WhatsApp linking).
 * Returns base64 image data.
 */
export async function getInstanceQR(
  instanceName: string,
  instanceToken: string
): Promise<{ success: boolean; qrBase64?: string; error?: string }> {
  if (!EVOLUTION_API_URL) {
    return { success: false, error: "EVOLUTION_API_URL not configured" };
  }

  try {
    // Small delay to let instance initialise
    await new Promise((r) => setTimeout(r, 1500));

    const res = await fetch(`${EVOLUTION_API_URL}/instance/connect/${instanceName}`, {
      headers: { apikey: instanceToken },
    });

    if (!res.ok) {
      return {
        success: false,
        error: `Could not fetch QR (HTTP ${res.status})`,
      };
    }

    const data = (await res.json()) as { base64?: string; code?: string; qrcode?: { code?: string } };
    // Evolution API returns QR as data.base64 (may or may not include the data:image prefix)
    let qrBase64 = data.base64 ?? data.qrcode?.code ?? null;

    // Ensure it has the data URI prefix
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

    const data = (await res.json()) as {
      instance?: { state?: string };
    };

    return {
      success: true,
      state: data.instance?.state ?? "unknown",
    };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}
