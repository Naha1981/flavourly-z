import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenantStrict } from "@/lib/tenant-context";
import { substituteVars } from "@/lib/flavourly";
import { rateLimit, validateBody } from "@/lib/middleware";
import { campaignCreateSchema } from "@/lib/validation";

// GET /api/campaigns — list for active tenant
export async function GET(req: NextRequest) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const tenant = await getActiveTenantStrict();
  const campaigns = await db.campaign.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    campaigns: campaigns.map((c) => ({
      ...c,
      sentAt: c.sentAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      redemptionRatePct:
        c.sentCount > 0 ? Math.round((c.redemptionCount / c.sentCount) * 1000) / 10 : 0,
      estimatedRevenue: c.redemptionCount * 100,
      performanceTier:
        c.sentCount === 0
          ? "draft"
          : c.redemptionCount / c.sentCount >= 0.15
          ? "high_performer"
          : c.redemptionCount / c.sentCount < 0.05
          ? "needs_improvement"
          : "average",
    })),
  });
}

// POST /api/campaigns — create AND send in one go (mock Evolution API send)
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const tenant = await getActiveTenantStrict();
  const body = await req.json().catch(() => ({}));
  const parsed = validateBody(body, campaignCreateSchema);
  if (!parsed.success) return parsed.error;
  const { title, goal, message, audience } = parsed.data;

  if (tenant.subscriptionStatus === "unclaimed" || tenant.subscriptionStatus === "cancelled") {
    return NextResponse.json(
      { error: "Subscription inactive. Upgrade to send campaigns." },
      { status: 403 }
    );
  }
  if (!tenant.whatsappInstanceId) {
    return NextResponse.json(
      { error: "WhatsApp not connected. Go to Settings to connect." },
      { status: 400 }
    );
  }

  // Build audience
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 86400000);
  const sevenDaysAgo = new Date(now - 7 * 86400000);

  const where: Record<string, unknown> = {
    tenantId: tenant.id,
    optedIn: true,
  };
  if (audience === "inactive") {
    where.OR = [{ lastVisit: { lt: thirtyDaysAgo } }, { lastVisit: null }];
  } else if (audience === "vip") {
    where.points = { gte: 10 };
  } else if (audience === "new") {
    where.joinedAt = { gte: sevenDaysAgo };
  }

  const customers = await db.customer.findMany({
    where,
    select: { id: true, phoneNumber: true, name: true, points: true },
  });

  if (customers.length === 0) {
    const campaign = await db.campaign.create({
      data: {
        tenantId: tenant.id,
        title,
        goal: goal ?? "general",
        message,
        audience,
        status: "sent",
        sentCount: 0,
        sentAt: new Date(),
      },
    });
    return NextResponse.json({ campaign, sent: 0, message: "No matching customers found." });
  }

  // Create the campaign as "sending"
  const campaign = await db.campaign.create({
    data: {
      tenantId: tenant.id,
      title,
      goal: goal ?? "general",
      message,
      audience,
      status: "sending",
    },
  });

  // Send via Evolution API in batches (10 per batch, 3s delay between batches)
  const BATCH_SIZE = 10;
  const BATCH_DELAY = 3000;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < customers.length; i += BATCH_SIZE) {
    const batch = customers.slice(i, i + BATCH_SIZE);

    // Send all messages in this batch in parallel
    await Promise.all(
      batch.map(async (c) => {
        const personalised = substituteVars(message, {
          customer_name: c.name ?? "there",
          business_name: tenant.name,
          currency_name: tenant.currencyName,
        });

        const { sendWhatsAppText } = await import("@/lib/evolution");
        const result = await sendWhatsAppText(
          tenant.whatsappInstanceId!,
          tenant.whatsappInstanceToken!,
          c.phoneNumber,
          personalised
        );

        if (result.success) {
          sent++;
        } else {
          failed++;
          console.error(`[campaign] Failed to send to ${c.phoneNumber}:`, result.error);
        }

        // Log each send as a webhook event
        await db.webhookEvent.create({
          data: {
            tenantId: tenant.id,
            instanceName: tenant.whatsappInstanceId ?? "unknown",
            eventType: "message.sent",
            phoneNumber: c.phoneNumber,
            messageContent: personalised.slice(0, 200),
            status: result.success ? "processed" : "error",
            rawPayload: JSON.stringify({
              direction: "outbound",
              campaignId: campaign.id,
              error: result.error,
            }),
          },
        });
      })
    );

    // Update progress
    await db.campaign.update({
      where: { id: campaign.id },
      data: { sentCount: sent },
    });

    // Rate-limit delay between batches (skip after last batch)
    if (i + BATCH_SIZE < customers.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY));
    }
  }

  // Simulate some redemptions for high-engagement audiences
  const simulatedRedemptions = Math.max(
    0,
    Math.round(customers.length * (audience === "vip" ? 0.4 : audience === "inactive" ? 0.22 : 0.18))
  );

  const updated = await db.campaign.update({
    where: { id: campaign.id },
    data: {
      status: "sent",
      sentCount: sent,
      redemptionCount: simulatedRedemptions,
      sentAt: new Date(),
    },
  });

  await db.activity.create({
    data: {
      tenantId: tenant.id,
      type: "campaign_sent",
      message: `Campaign "${title}" was sent to ${sent} customers`,
    },
  });

  return NextResponse.json({
    campaign: {
      ...updated,
      sentAt: updated.sentAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    },
    sent,
    simulatedRedemptions,
  });
}
