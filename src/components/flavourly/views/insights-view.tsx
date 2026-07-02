"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  CoachAdviceBox,
  EmptyState,
  SectionHeading,
} from "@/components/flavourly/primitives";
import { timeAgo } from "@/lib/flavourly";
import { useFlavourly } from "@/lib/store";
import { Loader2, RefreshCw } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  industry: string;
  industryLabel: string;
  currencyName: string;
  brandColor: string;
  logoUrl: string | null;
  welcomePoints: number;
  rewardThreshold: number;
  subscriptionStatus: string;
  plan: string;
  trialDaysLeft: number | null;
  whatsappInstanceId: string | null;
  whatsappPhone: string | null;
  customerCount: number;
  campaignCount: number;
}

type Tier = "high_performer" | "needs_improvement" | "average" | "draft";

interface Campaign {
  id: string;
  title: string;
  goal: string;
  message: string;
  audience: string;
  status: string;
  sentCount: number;
  redemptionCount: number;
  sentAt: string | null;
  createdAt: string;
  redemptionRatePct: number;
  estimatedRevenue: number;
  performanceTier: Tier;
}

interface Advice {
  adviceKey: string;
  adviceText: string;
  suggestedTemplate: string;
  suggestedGoal: string;
  suggestedAudience: string;
}

interface NeedsImprovementCampaign extends Campaign {
  advice: Advice;
}

interface InsightsData {
  wins: {
    activeCustomers: number;
    redemptions30d: number;
    estimatedRevenue30d: number;
  };
  topCampaigns: Campaign[];
  needsImprovement: NeedsImprovementCampaign[];
  recommendations: {
    quietDay: { day: string; pctQuieter: number; busiestDay: string };
    inactiveCount: number;
    vipCount: number;
    atRiskCount: number;
  };
  tooltips: Record<string, string>;
}

// ─── Main View ───────────────────────────────────────────────────────────────

export function InsightsView({ tenant }: { tenant: Tenant | null }) {
  const { setTenantView } = useFlavourly();
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rerunningId, setRerunningId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/insights");
      if (res.ok) setData(await res.json());
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRunAgain(c: Campaign) {
    setRerunningId(c.id);
    try {
      const res = await fetch(`/api/campaigns/${c.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error("Couldn't re-send", { description: d?.error ?? "Try again." });
        return;
      }
      toast.success("🔄 Re-sent!", {
        description: `Re-sent "${c.title}" to ${d.sent} customers.`,
      });
      load();
    } catch {
      toast.error("Network error", { description: "Please retry." });
    } finally {
      setRerunningId(null);
    }
  }

  function handleTryBetter() {
    setTenantView("promos");
    toast.info("✨ Template loaded!", {
      description: "Head to Promos to send the improved version.",
    });
  }

  if (!tenant) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <SectionHeading
        emoji="🧠"
        title="Insights"
        subtitle="Your wise business coach. Numbers, plain-English advice, and what to do next. 📈"
        action={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        }
      />

      {/* ─── Section A — This Month's Wins ─────────────────────────────── */}
      {loading || !data ? (
        <Skeleton className="h-40 sm:h-36 rounded-2xl" />
      ) : (
        <WinsHero data={data} />
      )}

      {/* ─── Section B — Winning Campaigns ─────────────────────────────── */}
      <section>
        <SectionHeading
          emoji="🔥"
          title="Your Winning Campaigns"
          subtitle="Promos that brought customers through the door."
        />
        {loading || !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : data.topCampaigns.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              emoji="🏆"
              title="No winners yet"
              message="Send a promo to see your winners here! Even one good campaign can pay for the month."
              action={
                <Button
                  className="bg-brand text-white hover:bg-brand-dark"
                  onClick={() => setTenantView("promos")}
                >
                  📣 Send a Promo
                </Button>
              }
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.topCampaigns.map((c) => (
              <TopCampaignCard
                key={c.id}
                campaign={c}
                onRunAgain={handleRunAgain}
                rerunning={rerunningId === c.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── Section C — Needs Improvement ─────────────────────────────── */}
      <section>
        <SectionHeading
          emoji="💡"
          title="Let's Do Better Next Time"
          subtitle="Every miss is a lesson. Here's how to turn these around."
        />
        {loading || !data ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : data.needsImprovement.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              emoji="✨"
              title="Nothing to fix — nice work!"
              message="All your recent campaigns are performing well. Keep testing new offers and audiences."
            />
          </Card>
        ) : (
          <div className="space-y-3 max-h-[36rem] overflow-y-auto scroll-area-thin pr-1">
            {data.needsImprovement.map((c) => (
              <NeedsWorkCard
                key={c.id}
                campaign={c}
                onTryBetter={handleTryBetter}
              />
            ))}
          </div>
        )}
      </section>

      {/* ─── Section D — Smart Recommendations ─────────────────────────── */}
      <section>
        <SectionHeading
          emoji="🚀"
          title="What You Should Do This Week"
          subtitle="Three concrete moves that could move the needle. Pick one — it takes 2 minutes."
        />
        {loading || !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <RecommendationCard
              emoji="🪑"
              title={`Fill ${data.recommendations.quietDay.day}s`}
              body={`Your ${data.recommendations.quietDay.day}s are ${data.recommendations.quietDay.pctQuieter}% quieter than ${data.recommendations.quietDay.busiestDay}s. That's empty capacity you can sell.`}
              cta="Send a Quiet-Hours Promo"
              onClick={() => setTenantView("promos")}
            />
            <RecommendationCard
              emoji="👋"
              title="Bring Back Lost Customers"
              body={`${data.recommendations.inactiveCount} customer${data.recommendations.inactiveCount === 1 ? "" : "s"} haven't visited in 30+ days. A friendly nudge can win back roughly 1 in 4.`}
              cta="Send a Winback Promo"
              onClick={() => setTenantView("promos")}
            />
            <RecommendationCard
              emoji="👑"
              title="Reward Your VIPs"
              body={`${data.recommendations.vipCount} loyal customer${data.recommendations.vipCount === 1 ? "" : "s"} deserve a surprise. VIPs refer friends — your cheapest marketing.`}
              cta="Send a VIP Promo"
              onClick={() => setTenantView("promos")}
            />
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Section A — Wins Hero ───────────────────────────────────────────────────

function WinsHero({ data }: { data: InsightsData }) {
  const stats = [
    {
      emoji: "🎉",
      value: data.wins.activeCustomers,
      label: "Customers Engaged",
      tooltip: data.tooltips?.activeCustomers ?? "Customers who visited in the last 30 days.",
    },
    {
      emoji: "🎁",
      value: data.wins.redemptions30d,
      label: "Rewards Redeemed",
      tooltip: data.tooltips?.redemptions30d ?? "Rewards unlocked by customers this month.",
    },
    {
      emoji: "💰",
      value: `R${data.wins.estimatedRevenue30d.toLocaleString()}`,
      label: "Est. Revenue Created",
      tooltip: data.tooltips?.estimatedRevenue30d ?? "Calculated as redemptions × R100 conservative basket size.",
    },
  ];
  return (
    <div className="bg-gradient-to-br from-brand to-pink-500 text-white rounded-2xl p-5 sm:p-6 shadow-md">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">✨</span>
        <h2 className="text-lg sm:text-xl font-bold">This Month&apos;s Wins</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {stats.map((s) => (
          <div
            key={s.label}
            title={s.tooltip}
            className="bg-white/15 backdrop-blur-sm rounded-xl p-4 cursor-help"
          >
            <div className="text-2xl">{s.emoji}</div>
            <div className="text-4xl sm:text-5xl font-black mt-1 leading-none">
              {s.value}
            </div>
            <div className="text-xs sm:text-sm font-semibold text-white/90 uppercase tracking-widest mt-2">
              {s.label}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-white/80 mt-4 italic">
        💡 Based on redemptions × R100 conservative basket size. Hover any number for the detail.
      </p>
    </div>
  );
}

// ─── Section B — Top Campaign Card ───────────────────────────────────────────

function TopCampaignCard({
  campaign: c,
  onRunAgain,
  rerunning,
}: {
  campaign: Campaign;
  onRunAgain: (c: Campaign) => void;
  rerunning: boolean;
}) {
  return (
    <Card className="border-l-4 border-green-500 bg-green-50 p-4 gap-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-gray-900 leading-tight flex-1 min-w-0">
          {c.title}
        </h3>
        <Badge className="shrink-0 bg-success-light text-success-foreground">
          🏆 Top
        </Badge>
      </div>

      <p className="text-sm text-gray-600">
        🎯 <strong className="text-gray-900">{c.redemptionCount}</strong> customers redeemed this
        {c.sentAt && (
          <span className="text-xs text-gray-400 ml-1">· {timeAgo(c.sentAt)}</span>
        )}
      </p>

      <p className="text-sm font-bold text-green-600">
        ✅ Brought in an estimated R{c.estimatedRevenue.toLocaleString()}
      </p>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onRunAgain(c)}
        disabled={rerunning}
        className="mt-1 w-full sm:w-auto"
      >
        {rerunning ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          "🔁 Run Again"
        )}
      </Button>
    </Card>
  );
}

// ─── Section C — Needs Improvement Card ──────────────────────────────────────

function NeedsWorkCard({
  campaign: c,
  onTryBetter,
}: {
  campaign: NeedsImprovementCampaign;
  onTryBetter: () => void;
}) {
  // Per F-I03 acceptance: do NOT show advice for campaigns with >15% redemption rate.
  // The API already filters these out of needsImprovement, but we double-guard here.
  if (c.redemptionRatePct > 15) return null;

  return (
    <Card className="border-l-4 border-amber-400 bg-amber-50 p-4 gap-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-gray-900 leading-tight flex-1 min-w-0">
          {c.title}
        </h3>
        <Badge className="shrink-0 bg-warning-light text-warning-foreground">
          📉 Needs Work
        </Badge>
      </div>

      <p className="text-sm text-gray-600">
        Only <strong className="text-gray-900">{c.redemptionCount}</strong> out of{" "}
        <strong className="text-gray-900">{c.sentCount}</strong> used this offer
        {c.sentAt && (
          <span className="text-xs text-gray-400 ml-1">· {timeAgo(c.sentAt)}</span>
        )}
      </p>

      <p className="text-xs text-gray-500 italic line-clamp-2">
        “{c.message.slice(0, 110)}{c.message.length > 110 ? "…" : ""}”
      </p>

      <CoachAdviceBox advice={c.advice.adviceText} onTryBetter={onTryBetter} />
    </Card>
  );
}

// ─── Section D — Recommendation Card ─────────────────────────────────────────

function RecommendationCard({
  emoji,
  title,
  body,
  cta,
  onClick,
}: {
  emoji: string;
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="bg-brand-light border border-brand/20 rounded-xl p-5 flex flex-col">
      <div className="text-3xl mb-2">{emoji}</div>
      <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600 leading-relaxed flex-1">{body}</p>
      <Button
        onClick={onClick}
        className="mt-4 bg-brand text-white hover:bg-brand-dark w-full"
      >
        {cta} →
      </Button>
    </div>
  );
}
