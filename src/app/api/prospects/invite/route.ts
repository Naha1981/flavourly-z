import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toSlug } from "@/lib/flavourly";

// POST /api/prospects/invite — send WhatsApp invites to selected prospects (mock)
// Body: { prospectIds: string[] }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.prospectIds) ? body.prospectIds : [];
  if (!ids.length) {
    return NextResponse.json({ error: "prospectIds required" }, { status: 400 });
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

    const claimUrl = `/claim/${prospect.tenant.claimToken}`;
    const ownerName = prospect.ownerName ?? "there";
    const message =
      `Hi ${ownerName} 👋\n\n` +
      `I'm the founder of Flavourly. I noticed ${prospect.businessName} doesn't have a digital loyalty system to bring customers back on quiet days.\n\n` +
      `I went ahead and built a custom WhatsApp loyalty profile for you — your '${prospect.tenant.currencyName}' tracker and QR codes are already set up. It's 100% free for 14 days.\n\n` +
      `See your ready-made dashboard here:\n👉 ${claimUrl}\n\n` +
      `Start turning your walk-ins into regulars today 🚀`;

    // Log the outbound invite as a webhook event (mock MITMAK send)
    await db.webhookEvent.create({
      data: {
        tenantId: prospect.tenant.id,
        instanceName: "MITMAK",
        eventType: "message.sent",
        phoneNumber: prospect.phoneNumber,
        messageContent: message.slice(0, 200),
        status: "processed",
        rawPayload: JSON.stringify({ direction: "outbound_invite", prospectId: pid }),
      },
    });

    await db.prospect.update({
      where: { id: pid },
      data: { status: "invited", inviteSentAt: new Date() },
    });
    sent++;
  }

  return NextResponse.json({ sent, failed, errors });
}
