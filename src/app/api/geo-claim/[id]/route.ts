import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { haversineMeters } from "@/lib/flavourly";

// GET /api/geo-claim/:id — reward event + tenant details
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const event = await db.rewardEvent.findUnique({
    where: { id },
    include: { tenant: true, customer: true },
  });
  if (!event) {
    return NextResponse.json({ error: "expired", message: "This reward link is invalid." }, { status: 404 });
  }

  const now = Date.now();
  const expired = event.expiresAt ? new Date(event.expiresAt).getTime() < now : false;
  if (event.status === "claimed") {
    return NextResponse.json({
      alreadyClaimed: true,
      tenantName: event.tenant.name,
      claimedAt: event.claimedAt?.toISOString() ?? null,
    });
  }
  if (expired) {
    await db.rewardEvent.update({ where: { id }, data: { status: "expired" } });
    return NextResponse.json({ error: "expired", message: "This reward has expired." }, { status: 410 });
  }

  return NextResponse.json({
    id: event.id,
    tenantName: event.tenant.name,
    tenantId: event.tenant.id,
    currencyName: event.tenant.currencyName,
    customerName: event.customer.name,
    pointsCost: event.pointsCost,
    status: event.status,
    expiresAt: event.expiresAt?.toISOString() ?? null,
    location: {
      lat: event.tenant.locationLat,
      lng: event.tenant.locationLng,
      label: event.tenant.locationLabel,
    },
    brandColor: event.tenant.brandColor,
  });
}

// POST /api/geo-claim/:id — verify geolocation, claim if within 500m
// Body: { lat, lng }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Location required" }, { status: 400 });
  }

  const event = await db.rewardEvent.findUnique({
    where: { id },
    include: { tenant: true },
  });
  if (!event) {
    return NextResponse.json({ error: "expired" }, { status: 404 });
  }
  if (event.status === "claimed") {
    return NextResponse.json({ error: "already_claimed" }, { status: 409 });
  }

  const now = Date.now();
  const expired = event.expiresAt ? new Date(event.expiresAt).getTime() < now : false;
  if (expired) {
    await db.rewardEvent.update({ where: { id }, data: { status: "expired" } });
    return NextResponse.json({ error: "expired" }, { status: 410 });
  }

  if (!event.tenant.locationLat || !event.tenant.locationLng) {
    // No tenant location set — allow manual claim (demo fallback)
    await db.rewardEvent.update({
      where: { id },
      data: { status: "claimed", claimedAt: new Date() },
    });
    return NextResponse.json({
      claimed: true,
      message: "Reward unlocked (manual check-in).",
      tenantName: event.tenant.name,
    });
  }

  const distance = haversineMeters(lat, lng, event.tenant.locationLat, event.tenant.locationLng);
  const withinRange = distance <= 500;

  if (!withinRange) {
    return NextResponse.json({
      claimed: false,
      distance: Math.round(distance),
      message: `You're ${Math.round(distance)}m away. Come to ${event.tenant.name} to unlock this reward.`,
    });
  }

  // Deduct points + mark claimed
  await db.$transaction([
    db.rewardEvent.update({
      where: { id },
      data: { status: "claimed", claimedAt: new Date() },
    }),
    db.customer.update({
      where: { id: event.customerId },
      data: { points: { decrement: event.pointsCost } },
    }),
    db.loyaltyTransaction.create({
      data: {
        tenantId: event.tenantId,
        customerId: event.customerId,
        pointsChange: -event.pointsCost,
        reason: "redeem",
        note: "Geo-claim reward",
      },
    }),
  ]);

  await db.activity.create({
    data: {
      tenantId: event.tenantId,
      type: "redeemed",
      customerId: event.customerId,
      message: `redeemed a reward via geo-claim (${Math.round(distance)}m away)`,
    },
  });

  return NextResponse.json({
    claimed: true,
    distance: Math.round(distance),
    message: "Reward unlocked!",
    tenantName: event.tenant.name,
  });
}
