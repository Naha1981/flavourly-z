import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/middleware";

// GET /api/webhooks?instance=&eventType=&status=&limit=
export async function GET(req: NextRequest) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const { searchParams } = new URL(req.url);
  const instance = searchParams.get("instance");
  const eventType = searchParams.get("eventType");
  const status = searchParams.get("status");
  const limit = Math.min(100, Number(searchParams.get("limit") ?? 50));

  const where: Record<string, unknown> = {};
  if (instance) where.instanceName = { contains: instance };
  if (eventType) where.eventType = eventType;
  if (status) where.status = status;

  const events = await db.webhookEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    events: events.map((e) => ({
      ...e,
      createdAt: e.createdAt.toISOString(),
      timeAgo: relativeTime(e.createdAt),
    })),
  });
}

// POST /api/webhooks — simulate an inbound webhook event (e.g. a customer texting JOIN)
// Also acts as the receiver the real Evolution API would POST to.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 120 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const event = body.event as string | undefined;
  const instanceName =
    (body.instance as Record<string, string> | undefined)?.instanceName ?? body.instanceName;
  const data = body.data as Record<string, unknown> | undefined;

  if (!event || !instanceName) {
    return NextResponse.json({ error: "Missing event or instanceName" }, { status: 400 });
  }

  // Find tenant by instance name
  const tenant = await db.tenant.findFirst({
    where: { whatsappInstanceId: instanceName },
  });

  // connection.update
  if (event === "connection.update") {
    const state = (data as Record<string, unknown>)?.state as string;
    const ev = await db.webhookEvent.create({
      data: {
        tenantId: tenant?.id,
        instanceName,
        eventType: event,
        messageContent: state ?? null,
        status: "processed",
        rawPayload: JSON.stringify(body),
      },
    });
    if (state === "open" && tenant && (data as Record<string, unknown>)?.wuid) {
      const wuid = (data as Record<string, unknown>).wuid as string;
      const phone = wuid.replace("@s.whatsapp.net", "");
      await db.tenant.update({
        where: { id: tenant.id },
        data: { whatsappPhone: phone, whatsappConnectedAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true, id: ev.id });
  }

  // messages.upsert
  if (event === "messages.upsert") {
    const key = (data as Record<string, unknown>)?.key as Record<string, unknown> | undefined;
    const fromMe = key?.fromMe as boolean;
    const phone = (key?.remoteJid as string | undefined)?.replace("@s.whatsapp.net", "") ?? null;
    const msg = (data as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
    const content =
      (msg?.conversation as string) ??
      (msg?.extendedTextMessage as Record<string, string>)?.text ??
      "";

    const status = fromMe ? "ignored" : "processed";
    const ev = await db.webhookEvent.create({
      data: {
        tenantId: tenant?.id,
        instanceName,
        eventType: event,
        phoneNumber: phone,
        messageContent: content.slice(0, 500),
        status,
        rawPayload: JSON.stringify(body),
      },
    });
    return NextResponse.json({ ok: true, id: ev.id });
  }

  // Unknown event — log as ignored
  const ev = await db.webhookEvent.create({
    data: {
      tenantId: tenant?.id,
      instanceName,
      eventType: event,
      status: "ignored",
      rawPayload: JSON.stringify(body),
    },
  });
  return NextResponse.json({ ok: true, id: ev.id });
}

function relativeTime(d: Date) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
