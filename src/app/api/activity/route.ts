import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenantStrict } from "@/lib/tenant-context";
import { timeAgo } from "@/lib/flavourly";

// GET /api/activity?limit=20
export async function GET(req: NextRequest) {
  const tenant = await getActiveTenantStrict();
  const { searchParams } = new URL(req.url);
  const limit = Math.min(50, Number(searchParams.get("limit") ?? 20));

  const items = await db.activity.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    items: items.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      timeAgo: timeAgo(a.createdAt),
      emoji:
        a.type === "joined"
          ? "🎉"
          : a.type === "redeemed"
          ? "🎁"
          : a.type === "earned"
          ? "✨"
          : a.type === "visit"
          ? "👣"
          : a.type === "campaign_sent"
          ? "📣"
          : "👤",
    })),
  });
}
