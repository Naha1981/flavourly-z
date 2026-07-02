import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenant } from "@/lib/tenant-context";
import { toSlug } from "@/lib/flavourly";

// POST /api/whatsapp/connect — mock Evolution API instance creation + QR
// In production this calls Evolution API /instance/create and /instance/connect.
// Here we generate a deterministic fake QR (SVG data URL) and auto-connect after polling.
export async function POST(req: NextRequest) {
  const tenant = await getActiveTenant();
  if (!tenant) {
    return NextResponse.json({ error: "No active tenant" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const forceRefresh = body?.forceRefresh === true;

  // If already connected and not forcing refresh, short-circuit
  if (
    tenant.whatsappInstanceId &&
    tenant.whatsappInstanceToken &&
    tenant.whatsappPhone &&
    !forceRefresh
  ) {
    return NextResponse.json({
      alreadyConnected: true,
      instanceName: tenant.whatsappInstanceId,
      phone: tenant.whatsappPhone,
    });
  }

  const instanceName =
    tenant.whatsappInstanceId ?? `tenant_${toSlug(tenant.slug ?? tenant.name)}`;
  const instanceToken =
    tenant.whatsappInstanceToken ??
    Math.random().toString(36).slice(2).replace(/-/g, "").toUpperCase().padEnd(32, "X");

  // Persist instance name + token (not yet "open")
  await db.tenant.update({
    where: { id: tenant.id },
    data: {
      whatsappInstanceId: instanceName,
      whatsappInstanceToken: instanceToken,
    },
  });

  // Log the connection attempt as a webhook event
  await db.webhookEvent.create({
    data: {
      tenantId: tenant.id,
      instanceName,
      eventType: "connection.update",
      messageContent: "connecting",
      status: "processed",
      rawPayload: JSON.stringify({ event: "connection.update", state: "connecting" }),
    },
  });

  // Generate a fake QR as an SVG data URL. In production this is base64 from Evolution API.
  const qrSvg = generateFakeQrSvg(instanceName);
  const qrDataUrl = `data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`;

  return NextResponse.json({
    alreadyConnected: false,
    instanceName,
    qrBase64: qrDataUrl,
    // Hint the frontend to poll status; auto-connect after ~8s
    autoConnectAfterMs: 8000,
  });
}

// Deterministic pseudo-random QR-ish pattern
function generateFakeQrSvg(seed: string): string {
  const size = 21;
  const cell = 12;
  const dim = size * cell;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const rand = () => {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    return h / 0x7fffffff;
  };
  let rects = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (rand() > 0.5) {
        rects += `<rect x="${x * cell}" y="${y * cell}" width="${cell}" height="${cell}"/>`;
      }
    }
  }
  // Three position-detection squares
  const finder = (fx: number, fy: number) =>
    `<rect x="${fx}" y="${fy}" width="${cell * 7}" height="${cell * 7}" fill="white"/>
     <rect x="${fx}" y="${fy}" width="${cell * 7}" height="${cell * 7}" fill="none" stroke="black" stroke-width="${cell}"/>
     <rect x="${fx + cell * 2}" y="${fy + cell * 2}" width="${cell * 3}" height="${cell * 3}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" style="background:white">
    <rect width="${dim}" height="${dim}" fill="white"/>
    <g fill="black">${rects}</g>
    ${finder(0, 0)}
    ${finder(cell * 14, 0)}
    ${finder(0, cell * 14)}
  </svg>`;
}
