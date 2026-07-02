import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getActiveTenantStrict, REVENUE_PER_REDEMPTION } from "@/lib/tenant-context";
import { buildCoachAdvice } from "@/lib/flavourly";
import { rateLimit } from "@/lib/middleware";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// GET /api/insights — rule-based smart advisor
export async function GET(req: NextRequest) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const tenant = await getActiveTenantStrict();
  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 86400000);
  const sixtyDaysAgo = new Date(now - 60 * 86400000);

  // ── Section A: Wins ──────────────────────────────────────────────────────
  const [activeCustomers, redemptions, campaigns] = await Promise.all([
    db.customer.count({
      where: { tenantId: tenant.id, lastVisit: { gte: thirtyDaysAgo } },
    }),
    db.rewardEvent.count({
      where: { tenantId: tenant.id, status: "claimed", createdAt: { gte: thirtyDaysAgo } },
    }),
    db.campaign.findMany({
      where: { tenantId: tenant.id, sentAt: { gte: thirtyDaysAgo } },
      orderBy: { sentAt: "desc" },
    }),
  ]);

  const estimatedRevenue = redemptions * REVENUE_PER_REDEMPTION;

  // ── Section B & C: Campaign performance ──────────────────────────────────
  const perf = campaigns.map((c) => {
    const rate = c.sentCount > 0 ? (c.redemptionCount / c.sentCount) * 100 : 0;
    const tier =
      c.sentCount === 0
        ? "draft"
        : rate >= 15
        ? "high_performer"
        : rate < 5
        ? "needs_improvement"
        : "average";
    return {
      ...c,
      sentAt: c.sentAt?.toISOString() ?? null,
      createdAt: c.createdAt.toISOString(),
      redemptionRatePct: Math.round(rate * 10) / 10,
      estimatedRevenue: c.redemptionCount * REVENUE_PER_REDEMPTION,
      performanceTier: tier,
    };
  });

  const topCampaigns = perf
    .filter((c) => c.performanceTier === "high_performer")
    .sort((a, b) => b.redemptionCount - a.redemptionCount)
    .slice(0, 3);

  const needsImprovement = perf
    .filter((c) => c.performanceTier === "needs_improvement")
    .map((c) => ({
      ...c,
      advice: buildCoachAdvice({
        redemptionRatePct: c.redemptionRatePct,
        audience: c.audience,
        sentAt: c.sentAt,
        message: c.message,
      }),
    }));

  // ── Section D: Recommendations ───────────────────────────────────────────
  const [allCustomers, atRisk, vips] = await Promise.all([
    db.customer.findMany({
      where: { tenantId: tenant.id },
      select: { lastVisit: true, points: true },
    }),
    db.customer.count({
      where: {
        tenantId: tenant.id,
        OR: [
          { lastVisit: { lt: thirtyDaysAgo } },
        ],
      },
    }),
    db.customer.count({ where: { tenantId: tenant.id, points: { gte: 10 } } }),
  ]);

  // Quietest day from last visits
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const c of allCustomers) {
    if (c.lastVisit) {
      dayCounts[new Date(c.lastVisit).getDay()]++;
    }
  }
  const nonZero = dayCounts.map((v, i) => ({ v, i })).filter((x) => x.v > 0);
  const maxVisits = Math.max(...dayCounts, 1);
  const minVisits = nonZero.length ? Math.min(...nonZero.map((x) => x.v)) : 0;
  const quietestIdx = nonZero.length
    ? nonZero.reduce((a, b) => (a.v <= b.v ? a : b)).i
    : 2; // default Tuesday
  const pctQuieter = maxVisits > 0 ? Math.round(((maxVisits - minVisits) / maxVisits) * 100) : 0;

  // customers who haven't visited in 30+ days (true dormant + at-risk combined for the nudge)
  const inactiveCount = allCustomers.filter(
    (c) => !c.lastVisit || new Date(c.lastVisit).getTime() < now - 30 * 86400000
  ).length;

  return NextResponse.json({
    wins: {
      activeCustomers,
      redemptions30d: redemptions,
      estimatedRevenue30d: estimatedRevenue,
    },
    topCampaigns,
    needsImprovement,
    recommendations: {
      quietDay: { day: DAYS[quietestIdx], pctQuieter, busiestDay: DAYS[dayCounts.indexOf(maxVisits)] },
      inactiveCount,
      vipCount: vips,
      atRiskCount: atRisk,
    },
    tooltips: {
      activeCustomers: "Customers who visited in the last 30 days.",
      redemptions30d: "Rewards unlocked by customers this month.",
      estimatedRevenue30d: `Calculated as redemptions × R${REVENUE_PER_REDEMPTION} conservative basket size.`,
    },
  });
}
