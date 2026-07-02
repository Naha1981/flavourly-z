"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Store,
  MessageCircle,
  CreditCard,
  Save,
  RefreshCw,
  CheckCircle2,
  QrCode,
  ExternalLink,
  Lock,
  Sparkles,
  ShieldCheck,
  Zap,
} from "lucide-react";
import {
  SectionHeading,
  StatusBadge,
} from "@/components/flavourly/primitives";
import {
  INDUSTRY_CURRENCY,
  INDUSTRY_LABELS,
  INDUSTRY_EMOJI,
  formatPhone,
} from "@/lib/flavourly";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  industry: string;
  industryLabel: string;
  currencyName: string;
  brandColor: string;
  logoUrl: string | null;
  welcomePoints: number;
  rewardThreshold: number;
  subscriptionStatus: string;
  plan: string;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  locationLat: number | null;
  locationLng: number | null;
  locationLabel: string | null;
  whatsappInstanceId: string | null;
  whatsappInstanceToken: string | null;
  whatsappPhone: string | null;
  whatsappConnectedAt: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  customerCount: number;
  campaignCount: number;
}

const BRAND_SWATCHES = [
  { hex: "#FF6B00", name: "Flavourly Orange" },
  { hex: "#16A34A", name: "Forest Green" },
  { hex: "#DC2626", name: "Chilli Red" },
  { hex: "#D97706", name: "Sunset Amber" },
  { hex: "#7C3AED", name: "Royal Purple" },
  { hex: "#0891B2", name: "Ocean Teal" },
];

const INDUSTRY_KEYS = ["restaurant", "cafe", "carwash", "salon", "barber", "retail"];

export function SettingsView({
  tenant,
  onUpdated,
}: {
  tenant: Tenant | null;
  onUpdated: () => void;
}) {
  if (!tenant) {
    return (
      <div className="p-4 sm:p-6">
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <SectionHeading
        emoji="⚙️"
        title="Settings"
        subtitle="Tune your business profile, WhatsApp link and subscription."
      />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="w-full sm:w-auto flex flex-wrap h-auto sm:h-9">
          <TabsTrigger value="profile" className="flex-1 sm:flex-initial">
            <Store className="w-4 h-4 mr-1.5" /> Business
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex-1 sm:flex-initial">
            <MessageCircle className="w-4 h-4 mr-1.5" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex-1 sm:flex-initial">
            <CreditCard className="w-4 h-4 mr-1.5" /> Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <ProfileTab tenant={tenant} onUpdated={onUpdated} />
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-4">
          <WhatsAppTab tenant={tenant} onUpdated={onUpdated} />
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <BillingTab tenant={tenant} onUpdated={onUpdated} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — Business Profile
// ════════════════════════════════════════════════════════════════════════════
function ProfileTab({
  tenant,
  onUpdated,
}: {
  tenant: Tenant;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState({
    name: tenant.name ?? "",
    industry: tenant.industry ?? "restaurant",
    currencyName: tenant.currencyName ?? "Points",
    brandColor: tenant.brandColor ?? "#FF6B00",
    welcomePoints: tenant.welcomePoints ?? 0,
    rewardThreshold: tenant.rewardThreshold ?? 10,
    ownerName: tenant.ownerName ?? "",
    ownerEmail: tenant.ownerEmail ?? "",
    locationLabel: tenant.locationLabel ?? "",
  });
  const [saving, setSaving] = useState(false);

  const onIndustryChange = (key: string) => {
    setForm((f) => ({
      ...f,
      industry: key,
      // auto-sync currency unless user has overridden — keep simple: always resync
      currencyName: INDUSTRY_CURRENCY[key] ?? f.currencyName,
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim() || tenant.name,
          industry: form.industry,
          currencyName: form.currencyName.trim() || "Points",
          brandColor: form.brandColor,
          welcomePoints: Number(form.welcomePoints) || 0,
          rewardThreshold: Number(form.rewardThreshold) || 0,
          ownerName: form.ownerName.trim() || null,
          ownerEmail: form.ownerEmail.trim() || null,
          locationLabel: form.locationLabel.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("✅ Saved!", {
        description: "Your changes are live.",
      });
      onUpdated();
    } catch {
      toast.error("Couldn't save", {
        description: "Please try again in a moment.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-4 sm:p-6 space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="🏪 Business Name" htmlFor="f-name">
          <Input
            id="f-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Mike's Car Wash"
          />
        </Field>

        <Field label={INDUSTRY_EMOJI[form.industry] ?? "🏭"} htmlFor="f-industry" textLabel="Industry">
          <Select value={form.industry} onValueChange={onIndustryChange}>
            <SelectTrigger id="f-industry" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_KEYS.map((k) => (
                <SelectItem key={k} value={k}>
                  {INDUSTRY_EMOJI[k]} {INDUSTRY_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="💰 Currency Name" htmlFor="f-currency">
          <Input
            id="f-currency"
            value={form.currencyName}
            onChange={(e) =>
              setForm((f) => ({ ...f, currencyName: e.target.value }))
            }
            placeholder="Washes, Stamps, Points…"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            What your customers earn. Auto-syncs with industry but you can rename it.
          </p>
        </Field>

        <Field label="🎨 Brand Color" htmlFor="f-color">
          <div className="flex items-center gap-2">
            <input
              id="f-color"
              type="color"
              value={form.brandColor}
              onChange={(e) =>
                setForm((f) => ({ ...f, brandColor: e.target.value }))
              }
              className="w-12 h-9 rounded-md border border-gray-200 bg-white p-1 cursor-pointer"
              aria-label="Pick brand color"
            />
            <Input
              value={form.brandColor}
              onChange={(e) =>
                setForm((f) => ({ ...f, brandColor: e.target.value }))
              }
              className="w-28 font-mono"
              placeholder="#FF6B00"
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {BRAND_SWATCHES.map((s) => (
              <button
                key={s.hex}
                type="button"
                title={s.name}
                onClick={() => setForm((f) => ({ ...f, brandColor: s.hex }))}
                className={[
                  "w-7 h-7 rounded-full border-2 transition-transform hover:scale-110",
                  form.brandColor.toLowerCase() === s.hex.toLowerCase()
                    ? "border-gray-900 ring-2 ring-offset-1 ring-gray-400"
                    : "border-white shadow-sm",
                ].join(" ")}
                style={{ background: s.hex }}
                aria-label={`Use ${s.name}`}
              />
            ))}
          </div>
        </Field>

        <Field label="🎁 Welcome Bonus" htmlFor="f-welcome">
          <Input
            id="f-welcome"
            type="number"
            min={0}
            value={form.welcomePoints}
            onChange={(e) =>
              setForm((f) => ({ ...f, welcomePoints: Number(e.target.value) }))
            }
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            {form.currencyName} given to every new customer who joins.
          </p>
        </Field>

        <Field label="🎯 Reward Threshold" htmlFor="f-threshold">
          <Input
            id="f-threshold"
            type="number"
            min={1}
            value={form.rewardThreshold}
            onChange={(e) =>
              setForm((f) => ({ ...f, rewardThreshold: Number(e.target.value) }))
            }
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            When a customer hits this many {form.currencyName.toLowerCase()}, they unlock a reward.
          </p>
        </Field>

        <Field label="👤 Owner Name" htmlFor="f-owner">
          <Input
            id="f-owner"
            value={form.ownerName}
            onChange={(e) =>
              setForm((f) => ({ ...f, ownerName: e.target.value }))
            }
            placeholder="Mike Nkosi"
          />
        </Field>

        <Field label="✉️ Owner Email" htmlFor="f-email">
          <Input
            id="f-email"
            type="email"
            value={form.ownerEmail}
            onChange={(e) =>
              setForm((f) => ({ ...f, ownerEmail: e.target.value }))
            }
            placeholder="mike@mikescarwash.co.za"
          />
        </Field>

        <Field label="📍 Location Label" htmlFor="f-loc" full>
          <Input
            id="f-loc"
            value={form.locationLabel}
            onChange={(e) =>
              setForm((f) => ({ ...f, locationLabel: e.target.value }))
            }
            placeholder="12 Rivonia Rd, Sandton, JHB"
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Shown on your QR poster and customer messages.
          </p>
        </Field>
      </div>

      <Separator />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          💡 Changes apply instantly across your QR poster, customer messages and dashboard.
        </p>
        <Button
          onClick={save}
          disabled={saving}
          className="bg-brand hover:bg-brand-dark text-white"
        >
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-1.5" /> Save Changes
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  htmlFor,
  textLabel,
  children,
  full,
}: {
  label?: string;
  textLabel?: string;
  htmlFor?: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label htmlFor={htmlFor} className="text-xs font-semibold text-gray-700">
        {label ?? textLabel}
      </Label>
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — WhatsApp Connection
// ════════════════════════════════════════════════════════════════════════════
function WhatsAppTab({
  tenant,
  onUpdated,
}: {
  tenant: Tenant;
  onUpdated: () => void;
}) {
  const connected = !!tenant.whatsappPhone;
  const [qrData, setQrData] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState<string | null>(
    tenant.whatsappInstanceId
  );
  const [connecting, setConnecting] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    pollRef.current = null;
    autoTimerRef.current = null;
    setPolling(false);
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const checkStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/whatsapp/status");
      const j = await res.json();
      if (j.connected) {
        cleanup();
        setConnecting(false);
        setQrData(null);
        toast.success("✅ WhatsApp connected!", {
          description: "Customers can now text JOIN to start earning.",
        });
        onUpdated();
        return true;
      }
    } catch {
      // ignore transient errors
    }
    return false;
  }, [cleanup, onUpdated]);

  const startConnect = useCallback(
    async (forceRefresh = false) => {
      setConnecting(true);
      try {
        const res = await fetch("/api/whatsapp/connect", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceRefresh }),
        });
        const j = await res.json();
        if (j.alreadyConnected && !forceRefresh) {
          toast.success("✅ Already connected!", {
            description: `WhatsApp is linked to ${formatPhone(j.phone)}.`,
          });
          setConnecting(false);
          onUpdated();
          return;
        }
        setQrData(j.qrBase64);
        setInstanceName(j.instanceName);
        toast.info("📲 QR ready", {
          description: "Open WhatsApp → Settings → Linked Devices → Scan.",
        });

        // Poll every 4s
        cleanup();
        setPolling(true);
        pollRef.current = setInterval(() => {
          void checkStatus();
        }, 4000);

        // Auto-flip after autoConnectAfterMs (simulating the 'open' webhook)
        autoTimerRef.current = setTimeout(async () => {
          try {
            await fetch("/api/whatsapp/status", { method: "POST" });
          } catch {
            // ignore
          }
          await checkStatus();
        }, j.autoConnectAfterMs ?? 8000);
      } catch {
        toast.error("Couldn't generate QR", {
          description: "Please try again.",
        });
        setConnecting(false);
      }
    },
    [checkStatus, cleanup, onUpdated]
  );

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {connected ? (
        <Card className="p-5 border-success/30 bg-success-light/50">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-success-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-bold text-success-foreground flex items-center gap-2 flex-wrap">
                ✅ WhatsApp Connected
                <StatusBadge variant="active" label="Live" />
              </div>
              <p className="text-sm text-success-foreground/80 mt-0.5">
                Linked to <span className="font-mono font-semibold">{formatPhone(tenant.whatsappPhone!)}</span>
                {tenant.whatsappConnectedAt && (
                  <> · joined {new Date(tenant.whatsappConnectedAt).toLocaleDateString()}</>
                )}
              </p>
              {instanceName && (
                <p className="text-[11px] text-success-foreground/60 mt-1 font-mono">
                  Instance: {instanceName}
                </p>
              )}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-5 border-warning/30 bg-warning-light/40">
          <div className="flex items-start gap-3">
            <span className="text-2xl shrink-0">⚠️</span>
            <div className="flex-1">
              <div className="font-bold text-warning-foreground">
                Your WhatsApp isn&apos;t connected yet
              </div>
              <p className="text-sm text-warning-foreground/80 mt-0.5">
                Customers can&apos;t text JOIN until you link your number. It takes 30 seconds. ⏱️
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Connect / QR card */}
      <Card className="p-5 sm:p-6">
        {!connected && !qrData && (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">💬</div>
            <h3 className="text-lg font-bold mb-1">Connect Your WhatsApp</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
              We&apos;ll spin up a dedicated WhatsApp instance for {tenant.name}. Scan one
              QR code and you&apos;re live — no app to install, no SIM juggling.
            </p>
            <Button
              onClick={() => startConnect(false)}
              disabled={connecting}
              size="lg"
              className="bg-brand hover:bg-brand-dark text-white"
            >
              {connecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Generating QR…
                </>
              ) : (
                <>
                  <QrCode className="w-4 h-4 mr-1.5" /> Connect WhatsApp
                </>
              )}
            </Button>
          </div>
        )}

        {!connected && qrData && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-bold flex items-center justify-center gap-2">
                <QrCode className="w-5 h-5 text-brand" /> Scan to Link
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                On your phone: WhatsApp → Settings → Linked Devices → Link a Device.
              </p>
            </div>
            <div className="flex justify-center">
              <div className="bg-white p-4 rounded-xl border-2 border-brand/30 shadow-sm">
                <img
                  src={qrData}
                  alt="WhatsApp QR code"
                  className="w-56 h-56 sm:w-64 sm:h-64"
                />
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm">
              {polling ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand" />
                  <span className="text-muted-foreground">
                    Waiting for scan… this auto-completes in a few seconds.
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">✅ Connected!</span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => startConnect(true)}
                disabled={connecting}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh QR
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              🔄 QR auto-refreshes. Keep this page open while you scan.
            </p>
          </div>
        )}

        {connected && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">🟢</span>
              <div className="flex-1">
                <h3 className="font-bold">Connection Healthy</h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Your WhatsApp instance is linked and receiving customer messages.
                  Need to switch phones or troubleshoot? Generate a fresh QR below —
                  your customer data is never affected.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => startConnect(true)}
              disabled={connecting}
            >
              {connecting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Reconnecting…
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-1.5" /> Reconnect / Get Fresh QR
                </>
              )}
            </Button>
          </div>
        )}
      </Card>

      {/* Webhook hint */}
      <Card className="p-4 bg-gray-50 border-dashed">
        <div className="flex items-start gap-2">
          <span className="text-lg">🔗</span>
          <div className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-gray-700">Webhook URL:</strong>{" "}
            <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-[11px]">
              /api/webhooks
            </code>{" "}
            — auto-configured on your Evolution API instance. Inbound messages
            (JOIN, BALANCE, REDEEM, STOP) are processed automatically.
          </div>
        </div>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// TAB 3 — Subscription & Billing
// ════════════════════════════════════════════════════════════════════════════
function BillingTab({
  tenant,
  onUpdated,
}: {
  tenant: Tenant;
  onUpdated: () => void;
}) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutData, setCheckoutData] = useState<{
    plan: "starter" | "growth";
    amount: string;
    itemName: string;
    mPaymentId: string;
  } | null>(null);
  const [paying, setPaying] = useState(false);

  const isTrial = tenant.subscriptionStatus === "trial";
  const isActive = tenant.subscriptionStatus === "active";
  const trialDaysLeft = tenant.trialDaysLeft ?? 0;
  const trialUsedPct = isTrial ? Math.max(0, Math.min(100, ((14 - trialDaysLeft) / 14) * 100)) : 0;

  const openCheckout = async (plan: "starter" | "growth") => {
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error("Couldn't start checkout", { description: j.error ?? "Try again." });
        return;
      }
      setCheckoutData({
        plan: j.plan,
        amount: j.amount,
        itemName: j.itemName,
        mPaymentId: j.mPaymentId,
      });
      setCheckoutOpen(true);
    } catch {
      toast.error("Network error", { description: "Please try again." });
    }
  };

  const completePayment = async () => {
    if (!checkoutData) return;
    setPaying(true);
    try {
      const res = await fetch("/api/billing/itn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ m_payment_id: checkoutData.mPaymentId }),
      });
      const j = await res.json();
      if (!res.ok || !j.success) {
        toast.error("Payment failed", { description: j.error ?? "Please try again." });
        return;
      }
      toast.success("🎉 Payment successful!", {
        description: "Your subscription is now active.",
      });
      setCheckoutOpen(false);
      setCheckoutData(null);
      onUpdated();
    } catch {
      toast.error("Network error", { description: "Please try again." });
    } finally {
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Current plan card */}
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Current Plan
            </div>
            <div className="text-2xl font-black flex items-center gap-2 mt-1">
              {tenant.plan === "growth" ? "🚀 Growth" : tenant.plan === "starter" ? "🌱 Starter" : "🆓 Free Trial"}
              <StatusBadge
                variant={
                  isActive ? "active" : isTrial ? "at_risk" : "dormant"
                }
                label={
                  isActive
                    ? "Active"
                    : isTrial
                    ? "Trial"
                    : tenant.subscriptionStatus
                }
              />
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Customers</div>
            <div className="text-2xl font-black text-brand">{tenant.customerCount}</div>
          </div>
        </div>

        {isTrial && (
          <div className="mt-4 bg-brand-light/60 rounded-lg p-3">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="font-semibold text-brand">
                ⏳ {trialDaysLeft} day{trialDaysLeft === 1 ? "" : "s"} left on your free trial
              </span>
              <span className="text-xs text-muted-foreground">
                {Math.round(trialUsedPct)}% used
              </span>
            </div>
            <Progress value={trialUsedPct} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              💡 You&apos;ll keep all your customer data when you upgrade — no migration needed.
            </p>
          </div>
        )}

        {isActive && (
          <div className="mt-4 bg-success-light/60 rounded-lg p-3 text-sm text-success-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            Your subscription is active. Renewal happens automatically each month via PayFast.
          </div>
        )}
      </Card>

      {/* Pricing cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PricingCard
          name="Starter"
          emoji="🌱"
          price="R299"
          cadence="/month"
          tagline="Perfect for solo operators getting their first 500 regulars."
          features={[
            "Up to 500 customers",
            "WhatsApp loyalty automation",
            "QR poster + custom branding",
            "Broadcast campaigns (1,000/mo)",
            "Loyalty history & churn alerts",
            "Email support",
          ]}
          current={tenant.plan === "starter" && isActive}
          onUpgrade={() => openCheckout("starter")}
        />
        <PricingCard
          name="Growth"
          emoji="🚀"
          price="R499"
          cadence="/month"
          tagline="For busy shops ready to win back customers at scale."
          features={[
            "Unlimited customers",
            "Everything in Starter, plus:",
            "Advanced automations & win-back flows",
            "Geo-targeted reward drops",
            "Broadcast campaigns (unlimited)",
            "Priority WhatsApp support",
          ]}
          featured
          current={tenant.plan === "growth" && isActive}
          onUpgrade={() => openCheckout("growth")}
        />
      </div>

      {/* Trial footer note */}
      <Card className="p-4 bg-gray-50 border-dashed">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <span className="text-base">🎁</span>
          <div>
            <strong className="text-gray-700">14-day free trial.</strong> No credit card
            needed. Cancel anytime by emailing{" "}
            <a
              href="mailto:hello@flavourly.os"
              className="text-brand hover:underline inline-flex items-center gap-0.5"
            >
              hello@flavourly.os <ExternalLink className="w-3 h-3" />
            </a>
            . Prices exclude VAT. Powered by PayFast.
          </div>
        </div>
      </Card>

      {/* Checkout dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-brand" /> PayFast Sandbox Checkout
            </DialogTitle>
            <DialogDescription>
              This is a simulated PayFast sandbox payment. No real card is charged.
            </DialogDescription>
          </DialogHeader>

          {checkoutData && (
            <div className="space-y-4">
              <div className="bg-brand-light border border-brand/20 rounded-lg p-3">
                <div className="text-xs text-muted-foreground uppercase tracking-wide">
                  You&apos;re upgrading to
                </div>
                <div className="font-bold text-brand flex items-center gap-2 mt-0.5">
                  <Sparkles className="w-4 h-4" />
                  {checkoutData.plan === "growth" ? "Growth Plan" : "Starter Plan"}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {checkoutData.itemName}
                </div>
              </div>

              <div className="flex items-center justify-between text-lg font-bold">
                <span>Amount due</span>
                <span className="text-brand">R{checkoutData.amount}</span>
              </div>
              <div className="text-[11px] text-muted-foreground -mt-3">
                Billed monthly · Cancel anytime
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="pf-card">Card number</Label>
                <Input
                  id="pf-card"
                  value="4242 4242 4242 4242"
                  readOnly
                  className="font-mono bg-gray-50"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="pf-exp">Expiry</Label>
                    <Input
                      id="pf-exp"
                      value="12/34"
                      readOnly
                      className="font-mono bg-gray-50"
                    />
                  </div>
                  <div>
                    <Label htmlFor="pf-cvv">CVV</Label>
                    <Input
                      id="pf-cvv"
                      value="123"
                      readOnly
                      className="font-mono bg-gray-50"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> PayFast sandbox test card — pre-filled. Just click pay.
                </p>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setCheckoutOpen(false)}
                  disabled={paying}
                >
                  Cancel
                </Button>
                <Button
                  onClick={completePayment}
                  disabled={paying}
                  className="bg-brand hover:bg-brand-dark text-white"
                >
                  {paying ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Processing…
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 mr-1.5" /> Pay R{checkoutData.amount} (Simulated)
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PricingCard({
  name,
  emoji,
  price,
  cadence,
  tagline,
  features,
  current,
  featured,
  onUpgrade,
}: {
  name: string;
  emoji: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  current: boolean;
  featured?: boolean;
  onUpgrade: () => void;
}) {
  return (
    <Card
      className={[
        "p-5 sm:p-6 flex flex-col relative",
        featured ? "border-brand border-2 shadow-md" : "border-gray-200",
      ].join(" ")}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-[11px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wide">
          ⭐ Best Value
        </div>
      )}
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <h3 className="text-lg font-bold">{name}</h3>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-4xl font-black text-gray-900">{price}</span>
        <span className="text-sm text-muted-foreground">{cadence}</span>
      </div>
      <p className="text-sm text-muted-foreground mt-2 min-h-[2.5rem]">{tagline}</p>
      <Separator className="my-3" />
      <ul className="space-y-2 text-sm flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-success-foreground shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4">
        {current ? (
          <Button variant="outline" className="w-full" disabled>
            ✓ Current Plan
          </Button>
        ) : (
          <Button
            onClick={onUpgrade}
            className={[
              "w-full",
              featured
                ? "bg-brand hover:bg-brand-dark text-white"
                : "bg-white border border-brand text-brand hover:bg-brand-light",
            ].join(" ")}
          >
            Upgrade to {name}
          </Button>
        )}
      </div>
    </Card>
  );
}
