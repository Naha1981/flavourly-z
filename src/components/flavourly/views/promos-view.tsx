"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  EmptyState,
  RealityCheckRoi,
  SectionHeading,
} from "@/components/flavourly/primitives";
import { substituteVars, timeAgo } from "@/lib/flavourly";
import { RefreshCw, Send, Check, Loader2, Lock } from "lucide-react";

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

type Goal = "quiet_hours" | "winback" | "vip";
type Audience = "all" | "inactive" | "vip" | "new";
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

// ─── Goal metadata ───────────────────────────────────────────────────────────

const GOALS: {
  key: Goal;
  emoji: string;
  title: string;
  blurb: string;
  defaultAudience: Audience;
  titleDerived: string;
}[] = [
  {
    key: "quiet_hours",
    emoji: "🪑",
    title: "Fill Quiet Hours",
    blurb: "Bring people in on your slowest days.",
    defaultAudience: "all",
    titleDerived: "🪑 Fill Quiet Hours",
  },
  {
    key: "winback",
    emoji: "🔁",
    title: "Bring Back Lost Faces",
    blurb: "Win back customers who haven't visited in 30+ days.",
    defaultAudience: "inactive",
    titleDerived: "👋 Winback Campaign",
  },
  {
    key: "vip",
    emoji: "👑",
    title: "Reward VIPs",
    blurb: "Surprise your most loyal regulars.",
    defaultAudience: "vip",
    titleDerived: "👑 VIP Reward",
  },
];

// ─── Message templates per goal (industry-flavored, SA-tone) ─────────────────

const TEMPLATES: Record<Goal, string[]> = {
  quiet_hours: [
    "🌧️ Rainy day special at {{business_name}}! Come in for DOUBLE {{currency_name}} today. Valid until 5pm only!",
    "🪑 Flash Tuesday at {{business_name}}! The next 10 customers get a FREE {{currency_name}}. Today only — first come, first served!",
    "☀️ Mid-week pick-me-up! Drop in before 3pm today and earn DOUBLE {{currency_name}} at {{business_name}}. Don't miss it!",
    "⏰ Flash Hour at {{business_name}}! From 2–4pm today only, get a free upgrade with your next {{currency_name}}. Tag a friend who needs a treat!",
  ],
  winback: [
    "👋 Hi {{customer_name}}, we miss you at {{business_name}}! Come back this week for a FREE {{currency_name}} on us. We saved your seat!",
    "💔 It's been a while, {{customer_name}}! Your favourite spot at {{business_name}} is calling. Here's 5 bonus {{currency_name}} just for coming back this week.",
    "🥹 We saved your loyalty {{currency_name}}, {{customer_name}}! Pop in this week and we'll throw in a free treat. We miss seeing you at {{business_name}}!",
    "📞 Long time no see, {{customer_name}}! {{business_name}} has new specials you'll love. Come in this week for a welcome-back surprise 🎁",
  ],
  vip: [
    "👑 VIP treat from {{business_name}}! {{customer_name}}, you're one of our most loyal regulars. Enjoy a FREE {{currency_name}} on us this week. You've earned it!",
    "🎁 Surprise, {{customer_name}}! Because you've been so loyal, your next {{currency_name}} is on the house at {{business_name}}. No strings, just thanks!",
    "🌟 You're a star at {{business_name}}, {{customer_name}}! Skip the queue this week — show this message for priority service + a free upgrade.",
    "🥂 Celebrating you, {{customer_name}}! Your loyalty means the world to {{business_name}}. Here's a free {{currency_name}} — on us, any day this week.",
  ],
};

const VAR_CHIPS = [
  { token: "{{customer_name}}", label: "Customer's first name" },
  { token: "{{business_name}}", label: "Your business name" },
  { token: "{{currency_name}}", label: `Your loyalty currency (e.g. Washes, Stamps)` },
];

const AUDIENCE_LABELS: Record<Audience, string> = {
  all: "👥 Everyone",
  inactive: "💤 Inactive (30+ days)",
  vip: "👑 VIPs",
  new: "🆕 New (7 days)",
};

// ─── Tier styling for past-promo cards ────────────────────────────────────────

function tierCardClass(tier: Tier): string {
  switch (tier) {
    case "high_performer":
      return "border-l-4 border-green-500 bg-green-50";
    case "needs_improvement":
      return "border-l-4 border-amber-400 bg-amber-50";
    case "average":
      return "border-l-4 border-gray-300 bg-white";
    default:
      return "border-l-4 border-gray-200 bg-gray-50";
  }
}

function tierBadge(tier: Tier): { label: string; cls: string } | null {
  switch (tier) {
    case "high_performer":
      return { label: "🏆 Top Performer", cls: "bg-success-light text-success-foreground" };
    case "needs_improvement":
      return { label: "📉 Needs Work", cls: "bg-warning-light text-warning-foreground" };
    case "average":
      return { label: "👍 Average", cls: "bg-gray-100 text-gray-600" };
    default:
      return null;
  }
}

// ─── Main View ───────────────────────────────────────────────────────────────

export function PromosView({ tenant }: { tenant: Tenant | null }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [templateIdx, setTemplateIdx] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("all");

  const [audienceCounts, setAudienceCounts] = useState<Record<Audience, number>>({
    all: 0,
    inactive: 0,
    vip: 0,
    new: 0,
  });
  const [countsLoading, setCountsLoading] = useState(true);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [rerunningId, setRerunningId] = useState<string | null>(null);

  const blocked =
    tenant?.subscriptionStatus === "unclaimed" ||
    tenant?.subscriptionStatus === "cancelled";
  const notConnected = !tenant?.whatsappInstanceId;

  // ── Fetch audience counts (4 filters in parallel) ─────────────────────────
  const loadCounts = useCallback(async () => {
    if (!tenant) return;
    setCountsLoading(true);
    try {
      const filters: Audience[] = ["all", "inactive", "vip", "new"];
      const results = await Promise.all(
        filters.map((f) =>
          fetch(`/api/customers?filter=${f}`).then((r) => r.json())
        )
      );
      const customerCount = tenant.customerCount;
      setAudienceCounts((prev) => {
        const counts: Record<Audience, number> = { ...prev };
        filters.forEach((f, i) => {
          // "all" filter is capped at 200 by API; prefer tenant.customerCount when larger
          const apiCount: number = results[i]?.count ?? 0;
          counts[f] = f === "all" ? Math.max(apiCount, customerCount) : apiCount;
        });
        return counts;
      });
    } catch {
      // silent — counts stay at 0
    } finally {
      setCountsLoading(false);
    }
  }, [tenant?.id, tenant?.customerCount]);

  // ── Fetch past campaigns ──────────────────────────────────────────────────
  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch("/api/campaigns");
      const data = await res.json();
      setCampaigns(data.campaigns ?? []);
    } catch {
      // silent
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCounts();
    loadCampaigns();
  }, [loadCounts, loadCampaigns]);

  // ── Live preview substitution ─────────────────────────────────────────────
  const preview = useMemo(() => {
    if (!tenant) return message;
    return substituteVars(message, {
      customer_name: "Sarah",
      business_name: tenant.name,
      currency_name: tenant.currencyName,
    });
  }, [message, tenant]);

  const selectedGoal = GOALS.find((g) => g.key === goal) ?? null;
  const audienceCount = audienceCounts[audience] ?? 0;
  const responders = Math.max(1, Math.round(audienceCount * 0.25));
  const estimatedRevenue = responders * 120;

  const offerText = preview.replace(/\s+/g, " ").trim().slice(0, 70) +
    (preview.length > 70 ? "…" : "");

  // ── Handlers ──────────────────────────────────────────────────────────────
  function pickGoal(g: Goal) {
    const meta = GOALS.find((x) => x.key === g)!;
    setGoal(g);
    setTemplateIdx(null);
    setMessage("");
    setAudience(meta.defaultAudience);
    setStep(2);
  }

  function pickTemplate(idx: number) {
    if (!goal) return;
    setTemplateIdx(idx);
    setMessage(TEMPLATES[goal][idx]);
  }

  async function handleSend() {
    if (!tenant || !goal || !message) return;
    if (blocked) {
      toast.error("Upgrade to send campaigns", {
        description: "Your subscription is inactive. Head to Settings to upgrade.",
      });
      return;
    }
    if (notConnected) {
      toast.error("Connect WhatsApp first", {
        description: "Go to Settings to link your WhatsApp number before sending promos.",
      });
      return;
    }
    const meta = GOALS.find((g) => g.key === goal)!;
    setSending(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: meta.titleDerived,
          goal,
          message,
          audience,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Couldn't send promo", {
          description: data?.error ?? "Please try again.",
        });
        return;
      }
      toast.success("📣 Promo sent!", {
        description: `Delivered to ${data.sent} customers. We'll track redemptions for you.`,
      });
      // Reset to step 1 + refresh campaign list
      setStep(1);
      setGoal(null);
      setTemplateIdx(null);
      setMessage("");
      setAudience("all");
      loadCampaigns();
    } catch {
      toast.error("Network error", { description: "Please check your connection and retry." });
    } finally {
      setSending(false);
    }
  }

  async function handleRunAgain(c: Campaign) {
    setRerunningId(c.id);
    try {
      const res = await fetch(`/api/campaigns/${c.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Couldn't re-send", {
          description: data?.error ?? "Please try again.",
        });
        return;
      }
      toast.success("🔄 Re-sent!", {
        description: `Re-sent "${c.title}" to ${data.sent} customers.`,
      });
      loadCampaigns();
    } catch {
      toast.error("Network error", { description: "Please retry." });
    } finally {
      setRerunningId(null);
    }
  }

  function reset() {
    setStep(1);
    setGoal(null);
    setTemplateIdx(null);
    setMessage("");
    setAudience("all");
  }

  if (!tenant) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-6xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <SectionHeading
        emoji="📣"
        title="Promos"
        subtitle="Goal-first campaigns. Pick what you want, we'll write the message. 🎯"
        action={
          <Button variant="outline" size="sm" onClick={loadCampaigns}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 items-start">
        {/* ─── LEFT: Builder ─────────────────────────────────────────────── */}
        <Card className="p-5 sm:p-6 gap-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              ✨ Start a New Promo
            </h2>
            {step !== 1 && (
              <button
                onClick={reset}
                className="text-xs text-muted-foreground hover:text-brand transition-colors"
              >
                Start over
              </button>
            )}
          </div>

          <Stepper step={step} />

          {/* Step 1 — Goal */}
          {step === 1 && (
            <div className="mt-6 space-y-3">
              <p className="text-sm font-semibold text-gray-700">
                ① What do you want to achieve?
              </p>
              <div className="grid grid-cols-1 gap-3">
                {GOALS.map((g) => (
                  <button
                    key={g.key}
                    onClick={() => pickGoal(g.key)}
                    className={`text-left rounded-xl border-2 p-5 cursor-pointer transition-all hover:shadow-md ${
                      goal === g.key
                        ? "border-brand bg-brand-light"
                        : "border-gray-200 bg-white hover:border-brand"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-3xl shrink-0">{g.emoji}</span>
                      <div>
                        <div className="font-bold text-gray-900">{g.title}</div>
                        <div className="text-sm text-gray-500 mt-0.5">{g.blurb}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2 — Message */}
          {step === 2 && goal && (
            <div className="mt-6 space-y-4">
              <p className="text-sm font-semibold text-gray-700">
                ② Pick a message template (you can edit it)
              </p>
              <div className="space-y-2">
                {TEMPLATES[goal].map((tpl, i) => {
                  const selPreview = substituteVars(tpl, {
                    customer_name: "Sarah",
                    business_name: tenant.name,
                    currency_name: tenant.currencyName,
                  });
                  const selected = templateIdx === i;
                  return (
                    <button
                      key={i}
                      onClick={() => pickTemplate(i)}
                      className={`w-full text-left rounded-lg border-2 p-3 cursor-pointer transition-all ${
                        selected
                          ? "border-brand bg-brand-light"
                          : "border-gray-200 bg-white hover:border-brand"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selected ? "border-brand bg-brand" : "border-gray-300"
                          }`}
                        >
                          {selected && <Check className="w-3 h-3 text-white" />}
                        </span>
                        <p className="text-sm text-gray-700 leading-relaxed">
                          {selPreview}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Variable chips */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Variables you can use
                </div>
                <div className="flex flex-wrap gap-2">
                  {VAR_CHIPS.map((v) => (
                    <span
                      key={v.token}
                      title={v.label}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-mono cursor-help"
                    >
                      {v.token}
                    </span>
                  ))}
                </div>
              </div>

              {/* Editable message */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Your message
                </label>
                <Textarea
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    setTemplateIdx(null);
                  }}
                  placeholder="Write your promo message…"
                  className="mt-1 min-h-24"
                  rows={4}
                />
              </div>

              {/* Live preview */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">
                  👀 Live preview (what Sarah will see)
                </div>
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">
                  {preview || (
                    <span className="text-gray-400 italic">Your message preview appears here…</span>
                  )}
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 sm:flex-none">
                  ← Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!message.trim()}
                  className="flex-1 bg-brand text-white hover:bg-brand-dark"
                >
                  Continue →
                </Button>
              </div>
            </div>
          )}

          {/* Step 3 — Audience & Send */}
          {step === 3 && goal && (
            <div className="mt-6 space-y-4">
              <p className="text-sm font-semibold text-gray-700">
                ③ Who should receive this?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(Object.keys(AUDIENCE_LABELS) as Audience[]).map((a) => {
                  const selected = audience === a;
                  const count = audienceCounts[a] ?? 0;
                  return (
                    <button
                      key={a}
                      onClick={() => setAudience(a)}
                      className={`text-left rounded-lg border-2 p-3 cursor-pointer transition-all ${
                        selected
                          ? "border-brand bg-brand-light"
                          : "border-gray-200 bg-white hover:border-brand"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sm text-gray-900">
                          {AUDIENCE_LABELS[a]}
                        </span>
                        {selected && <Check className="w-4 h-4 text-brand" />}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {countsLoading ? (
                          <span className="inline-flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> counting…
                          </span>
                        ) : (
                          <span>
                            <strong className="text-gray-700">{count}</strong> customer{count === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Reality-check ROI box */}
              <RealityCheckRoi
                audienceCount={audienceCount}
                offerText={offerText}
                estimatedRevenue={estimatedRevenue}
                tagline="An empty chair earns R0. A discounted service is still profit."
              />

              {/* Blocking notices */}
              {blocked && (
                <div className="bg-error-light border border-error/20 rounded-lg p-3 flex items-center gap-2 text-sm text-error-foreground">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Upgrade to send campaigns — your subscription is inactive.</span>
                </div>
              )}
              {!blocked && notConnected && (
                <div className="bg-warning-light border border-warning/20 rounded-lg p-3 flex items-center gap-2 text-sm text-warning-foreground">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>Connect WhatsApp in Settings before sending.</span>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 sm:flex-none">
                  ← Back
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={
                    sending ||
                    blocked ||
                    notConnected ||
                    audienceCount === 0
                  }
                  className="flex-1 bg-brand text-white hover:bg-brand-dark"
                >
                  {sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Sending…
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" /> Send to {audienceCount} Customer{audienceCount === 1 ? "" : "s"} →
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </Card>

        {/* ─── RIGHT: Past Promos ────────────────────────────────────────── */}
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
            📜 Past Promos
          </h2>

          {campaignsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <Card className="p-0">
              <EmptyState
                emoji="📣"
                title="No promos yet"
                message="Your customers are waiting! Create your first promo in under 2 minutes. ←"
              />
            </Card>
          ) : (
            <div className="space-y-3 max-h-[36rem] overflow-y-auto scroll-area-thin pr-1">
              {campaigns.map((c) => (
                <PastPromoCard
                  key={c.id}
                  campaign={c}
                  onRunAgain={handleRunAgain}
                  rerunning={rerunningId === c.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Goal" },
    { n: 2, label: "Message" },
    { n: 3, label: "Audience & Send" },
  ];
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {steps.map((s, i) => {
        const done = step > s.n;
        const active = step === s.n;
        return (
          <div key={s.n} className="flex items-center gap-1.5 sm:gap-2 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition-colors ${
                  done || active
                    ? "bg-brand text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {done ? <Check className="w-4 h-4" /> : s.n}
              </div>
              <span
                className={`text-xs sm:text-sm font-semibold truncate ${
                  done || active ? "text-brand" : "text-gray-400"
                }`}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 flex-1 rounded-full ${
                  done ? "bg-brand" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Past Promo Card ─────────────────────────────────────────────────────────

function PastPromoCard({
  campaign: c,
  onRunAgain,
  rerunning,
}: {
  campaign: Campaign;
  onRunAgain: (c: Campaign) => void;
  rerunning: boolean;
}) {
  const tb = tierBadge(c.performanceTier);
  return (
    <Card className={`p-4 gap-2 shadow-sm ${tierCardClass(c.performanceTier)}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-bold text-gray-900 leading-tight flex-1 min-w-0">
          {c.title}
        </h3>
        {tb && (
          <Badge
            variant="secondary"
            className={`shrink-0 ${tb.cls}`}
          >
            {tb.label}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <Badge variant="outline" className="font-normal">
          {AUDIENCE_LABELS[c.audience as Audience] ?? c.audience}
        </Badge>
        <span>·</span>
        <span title={c.sentAt ?? undefined}>
          {c.sentAt ? timeAgo(c.sentAt) : "Not sent"}
        </span>
        <span>·</span>
        <span>{c.sentCount} sent</span>
      </div>

      <p className="text-xs text-gray-600 line-clamp-2 italic">
        “{c.message.slice(0, 120)}{c.message.length > 120 ? "…" : ""}”
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div>
            <span className="text-2xl font-black text-gray-900">
              {c.redemptionCount}
            </span>
            <span className="text-xs text-gray-500 ml-1">redeemed</span>
          </div>
          <div className="text-sm font-bold text-green-600">
            ✅ Est. R{c.estimatedRevenue.toLocaleString()} in sales
          </div>
          <Badge
            variant="secondary"
            className="bg-gray-100 text-gray-600 font-semibold"
          >
            {c.redemptionRatePct}% rate
          </Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onRunAgain(c)}
          disabled={rerunning}
          className="shrink-0"
        >
          {rerunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            "🔁 Run Again"
          )}
        </Button>
      </div>
    </Card>
  );
}
