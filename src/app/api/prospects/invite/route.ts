import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rateLimit, validateBody } from "@/lib/middleware";
import { prospectInviteSchema } from "@/lib/validation";
import { sendWhatsAppText } from "@/lib/evolution";
import { getAppUrl } from "@/lib/app-url";

const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME;
const EVOLUTION_INSTANCE_TOKEN = process.env.EVOLUTION_INSTANCE_TOKEN;

// POST /api/prospects/invite — send WhatsApp invites to selected prospects
// via the Flavourly-os (MITMAK) Evolution API instance.
// Body: { prospectIds: string[] }
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { windowMs: 60_000, max: 10 });
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const parsed = validateBody(body, prospectInviteSchema);
  if (!parsed.success) return parsed.error;
  const ids = parsed.data.prospectIds;

  if (!EVOLUTION_INSTANCE_NAME || !EVOLUTION_INSTANCE_TOKEN) {
    return NextResponse.json(
      { error: "Evolution API instance not configured" },
      { status: 503 }
    );
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const pid of ids) {
    const prospect = await db.prospect.findUnique({
      where: { id: pid },
      include: { tenant: true },
    });
    if (!prospect || !prospect.tenant) {
      failed++;
      continue;
    }

    const claimUrl = `${getAppUrl()}/claim/${prospect.tenant.claimToken}`;
    const ownerName = prospect.ownerName ?? "there";
    const message =
      `Hi ${ownerName} 👋\n\n` +
      `I'm the founder of Flavourly. I noticed ${prospect.businessName} doesn't have a digital loyalty system to bring customers back on quiet days.\n\n` +
      `I went ahead and built a custom WhatsApp loyalty profile for you — your '${prospect.tenant.currencyName}' tracker and QR codes are already set up. It's 100% free for 14 days.\n\n` +
      `See your ready-made dashboard here:\n👉 ${claimUrl}\n\n` +
      `Start turning your walk-ins into regulars today 🚀`;

    // Send via the Flavourly-os Evolution API instance
    const result = await sendWhatsAppText(
      EVOLUTION_INSTANCE_NAME,
      EVOLUTION_INSTANCE_TOKEN,
      prospect.phoneNumber,
      message
    );

    // Log the outbound invite
    await db.webhookEvent.create({
      data: {
        tenantId: prospect.tenant.id,
        instanceName: EVOLUTION_INSTANCE_NAME,
        eventType: "message.sent",
        phoneNumber: prospect.phoneNumber,
        messageContent: message.slice(0, 200),
        status: result.success ? "processed" : "error",
        rawPayload: JSON.stringify({
          direction: "outbound_invite",
          prospectId: pid,
          error: result.error,
        }),
      },
    });

    if (result.success) {
      await db.prospect.update({
        where: { id: pid },
        data: { status: "invited", inviteSentAt: new Date() },
      });
      sent++;
    } else {
      failed++;
      errors.push(`${prospect.businessName}: ${result.error}`);
    }

    // Small delay between each send to avoid WhatsApp rate limits
    await new Promise((r) => setTimeout(r, 1500));
  }

  return NextResponse.json({ sent, failed, errors });
}
