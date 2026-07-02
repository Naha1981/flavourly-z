"use client";

import { useEffect, useState, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard, SectionHeading, EmptyState } from "@/components/flavourly/primitives";
import { waMeUrl, formatPhone, timeAgo } from "@/lib/flavourly";
import { Download, Copy, ExternalLink, RefreshCw, AlertTriangle, Users, Gift, Footprints } from "lucide-react";

interface Tenant {
  id: string;
  name: string;
  currencyName: string;
  industry: string;
  whatsappPhone: string | null;
  whatsappInstanceId: string | null;
  brandColor: string;
  trialDaysLeft: number | null;
  subscriptionStatus: string;
  locationLabel: string | null;
}

interface Stats {
  joinedToday: number;
  redeemedToday: number;
  visitsToday: number;
  totalCustomers: number;
  totalRedemptions: number;
}

interface ActivityItem {
  id: string;
  type: string;
  customerName: string | null;
  message: string;
  timeAgo: string;
  emoji: string;
  createdAt: string;
}

export function DashboardView({ tenant }: { tenant: Tenant | null }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef<() => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const [s, a] = await Promise.all([
        fetch("/api/stats").then((r) => r.json()),
        fetch("/api/activity?limit=12").then((r) => r.json()),
      ]);
      if (cancelled) return;
      setStats(s);
      setActivity(a.items ?? []);
      setLoading(false);
    };
    loadRef.current = load;
    load();
    const interval = setInterval(() => loadRef.current(), 15000); // pseudo-realtime
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const manualRefresh = () => loadRef.current();

  if (!tenant) return <Skeleton className="m-4 h-96" />;

  const joinPhone = tenant.whatsappPhone ?? "27835550001";
  const waLink = waMeUrl(joinPhone, "JOIN");
  const notConnected = !tenant.whatsappPhone;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      {/* WhatsApp connect banner */}
      {notConnected && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 text-sm text-amber-900">
            <strong>Your WhatsApp isn&apos;t connected yet.</strong> Customers can&apos;t text JOIN
            until you link your number. Head to Settings to scan the QR.
          </div>
          <a href="#settings" className="text-sm font-semibold text-amber-700 hover:underline whitespace-nowrap">
            Connect now →
          </a>
        </div>
      )}

      {/* Trial countdown */}
      {tenant.subscriptionStatus === "trial" && (tenant.trialDaysLeft ?? 0) <= 10 && (
        <div className="bg-brand-light border border-brand/20 rounded-xl p-4 flex items-center gap-3">
          <span className="text-2xl">⏳</span>
          <div className="flex-1 text-sm">
            <strong className="text-brand">
              {tenant.trialDaysLeft} day{tenant.trialDaysLeft === 1 ? "" : "s"} left on your free trial.
            </strong>{" "}
            <span className="text-muted-foreground">Keep your campaigns running — upgrade when you&apos;re ready.</span>
          </div>
        </div>
      )}

      <SectionHeading
        emoji="🏠"
        title={`Good day, ${tenant.name} 👋`}
        subtitle="Here's how today is shaping up. Share your QR to keep customers rolling in."
        action={
          <Button variant="outline" size="sm" onClick={manualRefresh}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        }
      />

      {/* QR + stats grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* QR card */}
        <Card className="lg:col-span-1 p-5 sm:p-6 flex flex-col items-center text-center">
          <div className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            📲 Your Loyalty QR
          </div>
          <div className="bg-white p-4 rounded-xl border-2 border-brand/20 shadow-sm">
            <QRCodeSVG
              value={waLink}
              size={200}
              level="M"
              fgColor={tenant.brandColor}
              bgColor="#ffffff"
              includeMargin={false}
            />
          </div>
          <div className="mt-3 text-xs text-muted-foreground">
            Scan to open WhatsApp with <span className="font-mono font-semibold">JOIN</span> pre-typed
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {formatPhone(joinPhone)}
          </div>
          <div className="flex gap-2 mt-4 w-full">
            <Button className="flex-1" size="sm" onClick={() => downloadPoster(tenant, waLink)}>
              <Download className="w-3.5 h-3.5 mr-1.5" /> PDF
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              size="sm"
              onClick={() => {
                navigator.clipboard?.writeText(waLink);
                toast.success("WhatsApp link copied!", {
                  description: "Paste it in your Instagram bio or status.",
                });
              }}
            >
              <Copy className="w-3.5 h-3.5 mr-1.5" /> Copy link
            </Button>
          </div>
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 text-xs text-brand hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Test the link yourself
          </a>
        </Card>

        {/* Stats */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 content-start">
          {loading || !stats ? (
            <>
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl" />
            </>
          ) : (
            <>
              <StatCard
                emoji="🎉"
                value={stats.joinedToday}
                label="New Today"
                subtext={`${stats.totalCustomers} total customers`}
                variant="brand"
                tooltip="Customers who joined today"
              />
              <StatCard
                emoji="🎁"
                value={stats.redeemedToday}
                label="Rewards Redeemed"
                subtext={`${stats.totalRedemptions} all-time`}
                variant="success"
                tooltip="Rewards unlocked today"
              />
              <StatCard
                emoji="👣"
                value={stats.visitsToday}
                label="Visits Today"
                subtext="Loyalty earn events"
                tooltip="Customers who earned a stamp/visit today"
              />
            </>
          )}
        </div>
      </div>

      {/* Live activity feed */}
      <div>
        <SectionHeading
          emoji="🔴"
          title="Live Activity"
          subtitle="What your customers are doing right now"
        />
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : activity.length === 0 ? (
            <EmptyState
              emoji="🦗"
              title="Quiet for now"
              message="Share your QR code or send a promo to get customers joining and earning."
            />
          ) : (
            <ul className="divide-y divide-border max-h-[28rem] overflow-y-auto scroll-area-thin">
              {activity.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-3 px-4 py-3 feed-item-enter"
                >
                  <span className="text-xl shrink-0">{a.emoji}</span>
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-semibold">{a.customerName ?? "Someone"}</span>{" "}
                    <span className="text-muted-foreground">{a.message}</span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{a.timeAgo}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Quick audience snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <QuickStat icon={<Users className="w-4 h-4" />} label="Total Customers" value={stats?.totalCustomers ?? "—"} />
        <QuickStat icon={<Gift className="w-4 h-4" />} label="Total Rewards Given" value={stats?.totalRedemptions ?? "—"} />
        <QuickStat
          icon={<Footprints className="w-4 h-4" />}
          label="Your Currency"
          value={tenant.currencyName}
        />
      </div>
    </div>
  );
}

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
      <div className="w-9 h-9 rounded-lg bg-brand-light text-brand flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="font-bold truncate">{value}</div>
      </div>
    </div>
  );
}

// ── Print-ready QR poster via a popup window ─────────────────────────────────
function downloadPoster(tenant: Tenant, waLink: string) {
  const html = `<!DOCTYPE html>
<html><head><title>${tenant.name} — Loyalty QR Poster</title>
<meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: 'Inter', system-ui, sans-serif; color: #111827; }
  .poster { width: 100%; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; box-sizing: border-box; background: #fff; }
  .brand-bar { width: 100%; max-width: 440px; height: 8px; border-radius: 4px; background: ${tenant.brandColor}; margin-bottom: 32px; }
  .logo { width: 64px; height: 64px; border-radius: 16px; background: ${tenant.brandColor}; display: flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px; }
  h1 { font-size: 32px; font-weight: 800; margin: 0 0 8px; text-align: center; }
  .subtitle { font-size: 16px; color: #6B7280; margin: 0 0 32px; text-align: center; max-width: 380px; }
  .qr { padding: 20px; border: 3px solid ${tenant.brandColor}33; border-radius: 20px; margin-bottom: 24px; }
  .cta { font-size: 18px; font-weight: 700; margin: 0 0 8px; text-align: center; }
  .steps { font-size: 14px; color: #6B7280; text-align: center; line-height: 1.8; max-width: 360px; }
  .step { display: inline-block; margin: 0 6px; }
  .footer { margin-top: 40px; font-size: 12px; color: #9CA3AF; text-align: center; }
  .footer strong { color: ${tenant.brandColor}; }
</style></head>
<body><div class="poster">
  <div class="brand-bar"></div>
  <div class="logo">💡</div>
  <h1>${tenant.name}</h1>
  <p class="subtitle">Earn ${tenant.currencyName} on every visit. Get rewarded for being a regular. 🎉</p>
  <div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(waLink)}&color=${tenant.brandColor.replace("#", "")}&bgcolor=ffffff" width="280" height="280" alt="QR code"/></div>
  <p class="cta">📲 Scan to join — it&apos;s free!</p>
  <div class="steps">
    <span class="step">1. Scan the QR</span> ·
    <span class="step">2. Send JOIN</span> ·
    <span class="step">3. Earn ${tenant.currencyName}</span>
  </div>
  <div class="footer">Powered by <strong>Flavourly OS</strong> · ${tenant.locationLabel ?? ""}</div>
</div>
<script>window.onload = () => { setTimeout(() => window.print(), 400); }</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) {
    toast.error("Pop-up blocked", { description: "Allow pop-ups to download the poster PDF." });
    return;
  }
  w.document.write(html);
  w.document.close();
  toast.success("Opening print preview…", {
    description: "Choose 'Save as PDF' in the print dialog.",
  });
}
