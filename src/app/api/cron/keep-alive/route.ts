import { NextResponse } from "next/server";

// GET /api/cron/keep-alive
// Called by Vercel Cron every 10 minutes to keep the Evolution API awake.
// Render's free tier sleeps after 15 min of inactivity, which drops the
// WhatsApp session. This ping prevents that.
//
// Vercel Cron is configured in vercel.json:
//   { "crons": [{ "path": "/api/cron/keep-alive", "schedule": "*/10 * * * *" }] }
//
// Security: Vercel Cron sends an Authorization header with the CRON_SECRET
// env var. We verify it if set, otherwise allow (the endpoint is harmless).

export async function GET(req: Request) {
  const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;

  if (!EVOLUTION_API_URL) {
    return NextResponse.json({ error: "EVOLUTION_API_URL not configured" }, { status: 503 });
  }

  // Optional: verify Vercel Cron auth header if CRON_SECRET is set
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
  };

  // 1. Ping the Evolution API base URL (wakes Render)
  try {
    const start = Date.now();
    const res = await fetch(EVOLUTION_API_URL, {
      method: "GET",
      signal: AbortSignal.timeout(30000),
    });
    results.evolutionApi = {
      status: res.status,
      responseTimeMs: Date.now() - start,
      ok: res.ok,
    };
  } catch (err) {
    results.evolutionApi = {
      error: (err as Error).message,
      ok: false,
    };
  }

  // 2. Also check the WhatsApp connection state (keeps the session active)
  const INSTANCE_TOKEN = process.env.EVOLUTION_INSTANCE_TOKEN;
  const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;
  if (INSTANCE_TOKEN && INSTANCE_NAME) {
    try {
      const stateRes = await fetch(
        `${EVOLUTION_API_URL}/instance/connectionState/${INSTANCE_NAME}`,
        {
          headers: { apikey: INSTANCE_TOKEN },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        results.whatsappState = stateData?.instance?.state ?? "unknown";
      } else {
        results.whatsappState = `HTTP ${stateRes.status}`;
      }
    } catch (err) {
      results.whatsappState = { error: (err as Error).message };
    }
  }

  const allOk =
    (results.evolutionApi as Record<string, unknown>)?.ok === true;

  return NextResponse.json(
    {
      ok: allOk,
      ...results,
    },
    { status: allOk ? 200 : 502 }
  );
}
