import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { substituteVars, INDUSTRY_LABELS } from "@/lib/flavourly";

// GET /api/broadcasts — broadcast history log
export async function GET() {
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
  const body = await req.json().catch(() => ({}));
  const industryFilter = (body.industryFilter ?? "all").toString();
  const messageTemplate = (body.messageTemplate ?? "").toString();

  if (!messageTemplate.trim()) {
    return NextResponse.json({ error: "messageTemplate required" }, { status: 400 });
  }

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
  const recipients: { tenantId: string; delivered: boolean }[] = [];

  for (const t of tenants) {
    const message = substituteVars(messageTemplate, {
      business_name: t.name,
      owner_name: t.ownerName ?? "there",
      currency_name: t.currencyName,
    });
    await db.webhookEvent.create({
      data: {
        tenantId: t.id,
        instanceName: "MITMAK",
        eventType: "message.sent",
        phoneNumber: t.whatsappPhone,
        messageContent: message.slice(0, 200),
        status: "processed",
        rawPayload: JSON.stringify({ direction: "broadcast", industryFilter }),
      },
    });
    sent++;
    recipients.push({ tenantId: t.id, delivered: true });
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
    failed: 0,
    total: tenants.length,
    logId: log.id,
    industryLabel: industryFilter === "all" ? "All Industries" : INDUSTRY_LABELS[industryFilter] ?? industryFilter,
  });
}
