import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/middleware";
import { getAppUrl } from "@/lib/app-url";

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

  // Evolution API sends: { event, instance: { instanceName }, data: { ... } }
  // Also support flat shape: { event, instanceName, data }
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

  // ── connection.update ────────────────────────────────────────────────────
  if (event === "connection.update" || event === "CONNECTION_UPDATE") {
    const state =
      (data?.state as string) ??
      (body.status as string) ??
      null;
    const ev = await db.webhookEvent.create({
      data: {
        tenantId: tenant?.id,
        instanceName,
        eventType: event,
        messageContent: state,
        status: "processed",
        rawPayload: JSON.stringify(body),
      },
    });
    // If state is "open", capture the phone number from wuid
    if (state === "open" && tenant) {
      const wuid =
        (data?.wuid as string) ??
        (body.wuid as string) ??
        null;
      const phone = wuid?.replace("@s.whatsapp.net", "") ?? tenant.whatsappPhone;
      await db.tenant.update({
        where: { id: tenant.id },
        data: { whatsappPhone: phone, whatsappConnectedAt: new Date() },
      });
    }
    return NextResponse.json({ ok: true, id: ev.id });
  }

  // ── messages.upsert (inbound WhatsApp message) ───────────────────────────
  if (event === "messages.upsert" || event === "MESSAGES_UPSERT") {
    const key = data?.key as Record<string, unknown> | undefined;
    const fromMe = key?.fromMe as boolean;

    // Ignore outbound echoes (our own sent messages)
    if (fromMe) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const remoteJid =
      (key?.remoteJid as string) ??
      (key?.participant as string) ??
      null;
    const phone = remoteJid?.replace("@s.whatsapp.net", "").replace(/[^0-9]/g, "") ?? null;

    // Extract message text — handle plain text, extended text, and other formats
    const msg = data?.message as Record<string, unknown> | undefined;
    const rawText =
      (msg?.conversation as string) ??
      (msg?.extendedTextMessage as Record<string, string>)?.text ??
      (msg?.imageMessage as Record<string, string>)?.caption ??
      (msg?.videoMessage as Record<string, string>)?.caption ??
      "";
    const text = rawText.trim().toLowerCase();

    // Log the inbound event
    await db.webhookEvent.create({
      data: {
        tenantId: tenant?.id,
        instanceName,
        eventType: event,
        phoneNumber: phone,
        messageContent: rawText.slice(0, 500),
        status: "processed",
        rawPayload: JSON.stringify(body),
      },
    });

    // If no tenant found for this instance, can't process
    if (!tenant || !tenant.whatsappInstanceToken) {
      return NextResponse.json({ ok: true, error: "tenant not found" }, { status: 404 });
    }

    // ── Keyword handlers ──────────────────────────────────────────────────
    let reply = "";
    let activity: { type: string; customerName: string; message: string } | null = null;

    if (text === "join") {
      // Upsert customer
      let customer = await db.customer.findUnique({
        where: phone
          ? { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: phone } }
          : undefined as never,
      });
      if (!customer && phone) {
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
      } else if (customer && !customer.optedIn) {
        await db.customer.update({ where: { id: customer.id }, data: { optedIn: true } });
      }

      if (customer) {
        const toNext = Math.max(0, tenant.rewardThreshold - customer.points);
        reply =
          `🎉 Welcome to ${tenant.name}!\n\n` +
          `You've earned ${tenant.welcomePoints} ${tenant.currencyName} for joining.\n` +
          (toNext > 0
            ? `You need ${toNext} more to unlock your first reward. 🎯`
            : `You've already unlocked a reward! Text REDEEM to claim it. 🎁`) +
          `\n\nText BALANCE anytime to check your score. See you soon! 🙌`;
      } else {
        reply = `🎉 Welcome to ${tenant.name}! Text JOIN to sign up and earn ${tenant.welcomePoints} ${tenant.currencyName}. 🙌`;
      }
    } else if (text === "balance" || text === "points") {
      const customer = phone
        ? await db.customer.findUnique({
            where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: phone } },
          })
        : null;
      if (!customer) {
        reply = `You're not on ${tenant.name}'s loyalty list yet!\n\nText JOIN to sign up and earn your first ${tenant.currencyName}. 😊`;
      } else {
        const needed = Math.max(0, tenant.rewardThreshold - customer.points);
        const greeting = customer.name ? `Hi ${customer.name}! ` : "";
        reply =
          `${greeting}💳 Your ${tenant.name} Balance:\n\n` +
          `${customer.points} ${tenant.currencyName}\n\n` +
          (needed > 0
            ? `${needed} more ${tenant.currencyName} until your next reward! 🎯`
            : `🎁 You've unlocked a reward! Text REDEEM to claim it.`);
      }
    } else if (text === "redeem") {
      const customer = phone
        ? await db.customer.findUnique({
            where: { tenantId_phoneNumber: { tenantId: tenant.id, phoneNumber: phone } },
          })
        : null;
      if (!customer) {
        reply = `Text JOIN first to start earning ${tenant.currencyName}! 😊`;
      } else if (customer.points < tenant.rewardThreshold) {
        const needed = tenant.rewardThreshold - customer.points;
        reply = `Not quite yet! 😊\n\nYou need ${needed} more ${tenant.currencyName} to unlock your reward.\n\nText BALANCE to check your score.`;
      } else {
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        const rewardEvent = await db.rewardEvent.create({
          data: {
            tenantId: tenant.id,
            customerId: customer.id,
            triggerType: "manual",
            status: "sent",
            pointsCost: tenant.rewardThreshold,
            expiresAt,
          },
        });
        const claimUrl = `${getAppUrl()}/geo-claim/${rewardEvent.id}`;
        reply =
          `🎁 Your reward is ready!\n\n` +
          `Click the link — you need to be at ${tenant.name} to unlock it:\n` +
          `👉 ${claimUrl}\n\n` +
          `⏰ Valid for 15 minutes. Show the screen to the cashier.`;
        activity = {
          type: "redeemed",
          customerName: customer.name ?? customer.phoneNumber,
          message: "requested a reward (REDEEM)",
        };
      }
    } else if (text === "stop") {
      if (phone) {
        await db.customer.updateMany({
          where: { tenantId: tenant.id, phoneNumber: phone },
          data: { optedIn: false },
        });
      }
      reply = `You've been unsubscribed from ${tenant.name} loyalty messages. ✅\n\nText JOIN anytime to re-subscribe and start earning again.`;
    } else {
      // Fallback — show the keyword menu
      reply =
        `👋 Hi! Welcome to ${tenant.name}'s loyalty programme.\n\n` +
        `Text:\n📝 JOIN — sign up & earn ${tenant.currencyName}\n` +
        `💰 BALANCE — check your score\n🎁 REDEEM — claim a reward\n🚫 STOP — unsubscribe`;
    }

    // Send the reply via Evolution API
    if (reply && phone) {
      const { sendWhatsAppText } = await import("@/lib/evolution");
      await sendWhatsAppText(
        tenant.whatsappInstanceId!,
        tenant.whatsappInstanceToken!,
        phone,
        reply
      );

      // Log the outbound reply
      await db.webhookEvent.create({
        data: {
          tenantId: tenant.id,
          instanceName,
          eventType: "message.sent",
          phoneNumber: phone,
          messageContent: reply.slice(0, 500),
          status: "processed",
          rawPayload: JSON.stringify({ direction: "outbound_reply", keyword: text }),
        },
      });
    }

    // Create activity feed item
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

    return NextResponse.json({ ok: true, processed: true });
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
