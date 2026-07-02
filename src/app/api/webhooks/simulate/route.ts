import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenantStrict } from "@/lib/tenant-context";
import { normalizeZAPhone } from "@/lib/flavourly";

// POST /api/webhooks/simulate — simulate an inbound WhatsApp keyword
// Body: { keyword: "JOIN"|"BALANCE"|"REDEEM"|"STOP"|"hi", phone?: string }
// Lets the super admin / user trigger the customer-facing flows manually
// to see them reflected in the dashboard, activity feed, and webhooks log.
export async function POST(req: NextRequest) {
  const tenant = await getActiveTenantStrict();
  const body = await req.json().catch(() => ({}));
  const keyword = (body.keyword ?? "").toString().trim();
  const phone = normalizeZAPhone(body.phone ?? "27835559999");

  if (!keyword) {
    return NextResponse.json({ error: "keyword required" }, { status: 400 });
  }
  const text = keyword.toLowerCase();

  // Log the inbound webhook event (as if Evolution API delivered it)
  await db.webhookEvent.create({
    data: {
      tenantId: tenant.id,
      instanceName: tenant.whatsappInstanceId ?? "tenant_mikes-car-wash",
      eventType: "messages.upsert",
      phoneNumber: phone,
      messageContent: keyword,
      status: "processed",
      rawPayload: JSON.stringify({
        event: "messages.upsert",
        instance: { instanceName: tenant.whatsappInstanceId },
        data: {
          key: { remoteJid: `${phone}@s.whatsapp.net`, fromMe: false },
          message: { conversation: keyword },
        },
      }),
    },
  });

  let reply = "";
  let activity: { type: string; customerName: string; message: string } | null = null;

  if (text === "join") {
    let customer = await db.customer.findUnique({
      where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: phone } },
    });
    if (!customer) {
      customer = await db.customer.create({
        data: {
          tenantId: tenant.id,
          phoneNumber: phone,
          points: tenant.welcomePoints,
          visits: 0,
        },
      });
      await db.loyaltyTransaction.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          pointsChange: tenant.welcomePoints,
          reason: "join_bonus",
        },
      });
      activity = {
        type: "joined",
        customerName: phone,
        message: `just joined and earned ${tenant.welcomePoints} ${tenant.currencyName}`,
      };
    } else if (!customer.optedIn) {
      await db.customer.update({ where: { id: customer.id }, data: { optedIn: true } });
    }
    reply = `🎉 Welcome to ${tenant.name}!\n\nYou've earned ${tenant.welcomePoints} ${tenant.currencyName} for joining.\nText BALANCE anytime to check your score. See you soon! 🙌`;
  } else if (text === "balance" || text === "points") {
    const customer = await db.customer.findUnique({
      where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: phone } },
    });
    if (!customer) {
      reply = `You're not on ${tenant.name}'s loyalty list yet! Text JOIN to sign up. 😊`;
    } else {
      const needed = Math.max(0, tenant.rewardThreshold - customer.points);
      reply = `💳 Your ${tenant.name} Balance:\n\n${customer.points} ${tenant.currencyName}\n\n${
        needed > 0
          ? `${needed} more ${tenant.currencyName} until your next reward! 🎯`
          : `🎁 You've unlocked a reward! Text REDEEM to claim it.`
      }`;
    }
  } else if (text === "redeem") {
    const customer = await db.customer.findUnique({
      where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: phone } },
    });
    if (!customer) {
      reply = `Text JOIN first to start earning ${tenant.currencyName}! 😊`;
    } else if (customer.points < tenant.rewardThreshold) {
      reply = `Not quite yet! 😊 You need ${tenant.rewardThreshold - customer.points} more ${tenant.currencyName} to unlock your reward.`;
    } else {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
      const event = await db.rewardEvent.create({
        data: {
          tenantId: tenant.id,
          customerId: customer.id,
          triggerType: "manual",
          status: "sent",
          pointsCost: tenant.rewardThreshold,
          expiresAt,
        },
      });
      reply = `🎁 Your reward is ready!\n\nOpen this link at ${tenant.name} to unlock it:\n👉 /geo-claim/${event.id}\n\n⏰ Valid for 15 minutes.`;
      activity = {
        type: "redeemed",
        customerName: customer.name ?? customer.phoneNumber,
        message: "requested a reward (REDEEM)",
      };
    }
  } else if (text === "stop") {
    await db.customer.updateMany({
      where: { tenantId: tenant.id, phoneNumber: phone },
      data: { optedIn: false },
    });
    reply = `You've been unsubscribed from ${tenant.name} loyalty messages. ✅ Text JOIN to re-subscribe.`;
  } else {
    reply = `👋 Hi! Welcome to ${tenant.name}'s loyalty programme.\n\nText:\n📝 JOIN — sign up & earn ${tenant.currencyName}\n💰 BALANCE — check your score\n🎁 REDEEM — claim a reward\n🚫 STOP — unsubscribe`;
  }

  if (activity) {
    await db.activity.create({
      data: {
        tenantId: tenant.id,
        type: activity.type,
        customerName: activity.customerName,
        message: activity.message,
      },
    });
  }

  // Log the outbound reply
  await db.webhookEvent.create({
    data: {
      tenantId: tenant.id,
      instanceName: tenant.whatsappInstanceId ?? "tenant_mikes-car-wash",
      eventType: "message.sent",
      phoneNumber: phone,
      messageContent: reply.slice(0, 200),
      status: "processed",
      rawPayload: JSON.stringify({ direction: "outbound_reply", keyword }),
    },
  });

  return NextResponse.json({ reply, activity });
}
