import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { substituteVars, INDUSTRY_LABELS } from "@/lib/flavourly";
import { rateLimit, validateBody } from "@/lib/middleware";
import { broadcastCreateSchema } from "@/lib/validation";

// GET /api/broadcasts — broadcast history log
export async function GET(req: NextRequest) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const logs = await db.broadcastLog.findMany({
    orderBy: { createdAt: "desc" },
    include: { recipients: { select: { tenantId: true, delivered: true } } },
  });
  return NextResponse.json({
    logs: logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
      recipientCount: l.recipients.length,
      deliveredCount: l.recipients.filter((r) => r.delivered).length,
      recipients: undefined,
    })),
  });
}

// POST /api/broadcasts — send platform broadcast to active tenants filtered by industry
// Body: { industryFilter, messageTemplate }
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const parsed = validateBody(body, broadcastCreateSchema);
  if (!parsed.success) return parsed.error;
  const industryFilter = parsed.data.industryFilter;
  const messageTemplate = parsed.data.messageTemplate;

  const where: Record<string, unknown> = {
    subscriptionStatus: { in: ["trial", "active"] },
    whatsappPhone: { not: null },
  };
  if (industryFilter !== "all") where.industry = industryFilter;

  const tenants = await db.tenant.findMany({
    where,
    select: { id: true, name: true, currencyName: true, whatsappPhone: true, ownerName: true, industry: true },
  });

  if (!tenants.length) {
    return NextResponse.json({ sent: 0, failed: 0, message: "No matching active tenants" });
  }

  let sent = 0;
  let failed = 0;
  const recipients: { tenantId: string; delivered: boolean }[] = [];

  const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;
  const EVOLUTION_INSTANCE_TOKEN = process.env.EVOLUTION_INSTANCE_TOKEN;

  if (!EVOLUTION_INSTANCE_NAME || !EVOLUTION_INSTANCE_TOKEN) {
    return NextResponse.json(
      { error: "Evolution API instance not configured" },
      { status: 503 }
    );
  }

  for (const t of tenants) {
    if (!t.whatsappPhone) { failed++; continue; }

    const message = substituteVars(messageTemplate, {
      business_name: t.name,
      owner_name: t.ownerName ?? "there",
      currency_name: t.currencyName,
    });

    // Send via the Flavourly-os Evolution API instance
    const { sendWhatsAppText } = await import("@/lib/evolution");
    const result = await sendWhatsAppText(
      EVOLUTION_INSTANCE_NAME,
      EVOLUTION_INSTANCE_TOKEN,
      t.whatsappPhone,
      message
    );

    await db.webhookEvent.create({
      data: {
        tenantId: t.id,
        instanceName: EVOLUTION_INSTANCE_NAME,
        eventType: "message.sent",
        phoneNumber: t.whatsappPhone,
        messageContent: message.slice(0, 200),
        status: result.success ? "processed" : "error",
        rawPayload: JSON.stringify({ direction: "broadcast", industryFilter, error: result.error }),
      },
    });

    if (result.success) {
      sent++;
      recipients.push({ tenantId: t.id, delivered: true });
    } else {
      failed++;
      recipients.push({ tenantId: t.id, delivered: false });
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  const log = await db.broadcastLog.create({
    data: {
      targetIndustry: industryFilter,
      messagePreview: messageTemplate.slice(0, 120),
      recipientCount: tenants.length,
      sentCount: sent,
      sentBy: "super_admin",
      recipients: { create: recipients },
    },
  });

  return NextResponse.json({
    sent,
    failed,
    total: tenants.length,
    logId: log.id,
    industryLabel: industryFilter === "all" ? "All Industries" : INDUSTRY_LABELS[industryFilter] ?? industryFilter,
  });
}
