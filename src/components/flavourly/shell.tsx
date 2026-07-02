"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useFlavourly } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Megaphone,
  Lightbulb,
  Settings as SettingsIcon,
  Shield,
  ArrowLeft,
  Sparkles,
  QrCode,
  MapPin,
  FlaskConical,
  LogOut,
  ChevronDown,
} from "lucide-react";

interface ShellProps {
  tenant: {
    name: string;
    currencyName: string;
    industry: string;
    subscriptionStatus: string;
    plan: string;
    trialDaysLeft: number | null;
    whatsappPhone: string | null;
  } | null;
  onRefreshTenant: () => void;
  children: React.ReactNode;
}

const TENANT_NAV = [
  { id: "dashboard", label: "Dashboard", emoji: "🏠", icon: LayoutDashboard },
  { id: "customers", label: "Customers", emoji: "👥", icon: Users },
  { id: "promos", label: "Promos", emoji: "📣", icon: Megaphone },
  { id: "insights", label: "Insights", emoji: "📊", icon: Lightbulb },
  { id: "settings", label: "Settings", emoji: "⚙️", icon: SettingsIcon },
] as const;

const ADMIN_NAV = [
  { id: "prospects", label: "Prospects", emoji: "🎯", icon: Users },
  { id: "broadcasts", label: "Broadcasts", emoji: "📡", icon: Megaphone },
  { id: "webhooks", label: "Webhooks", emoji: "🔗", icon: Shield },
] as const;

export function Shell({ tenant, onRefreshTenant, children }: ShellProps) {
  const {
    mode,
    tenantView,
    adminView,
    setTenantView,
    setAdminView,
    setMode,
    openPublic,
  } = useFlavourly();

  const clickTimesRef = useRef<number[]>([]);
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { data: session, status } = useSession();
  const { openAuth, openLegal } = useFlavourly();

  const handleLogoClick = () => {
    const now = Date.now();
    clickTimesRef.current = clickTimesRef.current.filter((t) => now - t < 400);
    clickTimesRef.current.push(now);
    if (clickTimesRef.current.length >= 2) {
      setMode(mode === "admin" ? "tenant" : "admin");
      clickTimesRef.current = [];
    }
  };

  // Apply dark theme class on admin mode
  useEffect(() => {
    if (mode === "admin") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [mode]);

  const nav = mode === "admin" ? ADMIN_NAV : TENANT_NAV;
  const activeId = mode === "admin" ? adminView : tenantView;

  const planLabel =
    tenant?.subscriptionStatus === "trial"
      ? `Trial · ${tenant.trialDaysLeft ?? 0}d left`
      : tenant?.subscriptionStatus === "active"
      ? `${tenant.plan === "growth" ? "Growth" : "Starter"} · Active`
      : tenant?.subscriptionStatus === "paused"
      ? "Paused"
      : "—";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ─── Navbar ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 h-14">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={handleLogoClick}
              className="flex items-center gap-2 group"
              aria-label="Flavourly home"
              title="Flavourly OS"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "var(--brand)" }}
              >
                <span className="text-white text-lg leading-none">💡</span>
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <div className="font-extrabold text-sm tracking-tight">Flavourly</div>
                <div className="text-[10px] text-muted-foreground -mt-0.5">
                  {mode === "admin" ? "Super Admin" : "Loyalty OS"}
                </div>
              </div>
            </button>

            {mode === "tenant" && tenant && (
              <div className="hidden md:flex items-center gap-2 pl-3 ml-1 border-l border-border min-w-0">
                <span className="text-sm font-semibold truncate max-w-[160px]">
                  {tenant.name}
                </span>
                <span
                  className={cn(
                    "text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap",
                    tenant.subscriptionStatus === "trial"
                      ? "bg-warning-light text-warning-foreground"
                      : "bg-success-light text-success-foreground"
                  )}
                >
                  {planLabel}
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {mode === "tenant" && (
              <button
                onClick={() => setShowDemoMenu((s) => !s)}
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <FlaskConical className="w-3.5 h-3.5" /> Demo
              </button>
            )}
            {mode === "admin" && (
              <button
                onClick={() => setMode("tenant")}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
              </button>
            )}

            {/* Auth controls */}
            {status === "loading" ? (
              <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
            ) : session?.user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu((s) => !s)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-accent transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: "var(--brand)" }}
                  >
                    {session.user.role === "super_admin" ? "👑" : (session.user.name?.[0] ?? tenant?.name?.[0] ?? "M")}
                  </div>
                  <ChevronDown className="w-3 h-3 text-muted-foreground hidden sm:block" />
                </button>
                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 top-10 z-50 w-56 bg-popover border border-border rounded-xl shadow-lg p-2 text-sm">
                      <div className="px-3 py-2 border-b border-border mb-1">
                        <div className="font-semibold truncate">{session.user.name ?? "User"}</div>
                        <div className="text-xs text-muted-foreground truncate">{session.user.email}</div>
                        {session.user.role === "super_admin" && (
                          <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-light text-brand">SUPER ADMIN</span>
                        )}
                      </div>
                      {session.user.role === "super_admin" && mode === "tenant" && (
                        <button
                          onClick={() => { setShowUserMenu(false); setMode("admin"); }}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent flex items-center gap-2"
                        >
                          <Shield className="w-4 h-4" /> Super Admin
                        </button>
                      )}
                      <button
                        onClick={() => { setShowUserMenu(false); signOut({ callbackUrl: "/" }); }}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent flex items-center gap-2 text-error"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => openAuth("login")}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-accent transition-colors hidden sm:block"
                >
                  Log in
                </button>
                <button
                  onClick={() => openAuth("signup")}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-brand text-white hover:bg-brand-dark transition-colors"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>

        {/* Demo controls dropdown */}
        {mode === "tenant" && showDemoMenu && (
          <div className="absolute right-4 top-14 z-50 w-72 bg-popover border border-border rounded-xl shadow-lg p-2 text-sm">
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Try customer-facing flows
            </div>
            <DemoMenuItem
              icon={<QrCode className="w-4 h-4" />}
              label="Magic Claim Page"
              hint="Prospect onboarding"
              onClick={() => {
                setShowDemoMenu(false);
                openPublic("claim");
              }}
            />
            <DemoMenuItem
              icon={<MapPin className="w-4 h-4" />}
              label="Geo-Claim Reward"
              hint="Location-unlocked reward"
              onClick={async () => {
                setShowDemoMenu(false);
                openPublic("geo-claim");
              }}
            />
            <DemoMenuItem
              icon={<Sparkles className="w-4 h-4" />}
              label="Send a test JOIN"
              hint="Simulate WhatsApp keyword"
              onClick={async () => {
                await fetch("/api/webhooks/simulate", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ keyword: "JOIN", phone: "27835557777" }),
                });
                onRefreshTenant();
                setShowDemoMenu(false);
              }}
            />
            <div className="border-t border-border my-1" />
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Super Admin
            </div>
            <DemoMenuItem
              icon={<Shield className="w-4 h-4" />}
              label="Open Super Admin"
              hint="Prospects · Broadcasts · Webhooks"
              onClick={() => {
                setShowDemoMenu(false);
                setMode("admin");
              }}
            />
          </div>
        )}
      </header>

      {/* ─── Body: sidebar + main ───────────────────────────── */}
      <div className="flex-1 flex">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex w-56 lg:w-60 shrink-0 border-r border-border bg-sidebar flex-col">
          <nav className="flex-1 p-3 space-y-1">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = activeId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() =>
                    mode === "admin"
                      ? setAdminView(item.id as never)
                      : setTenantView(item.id as never)
                  }
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-brand text-white shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {mode === "tenant" && (
            <div className="p-3 m-3 rounded-xl bg-gradient-to-br from-brand-light to-amber-50 border border-brand/20">
              <div className="text-xs font-bold text-brand mb-1">🪑 The Empty Chair</div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                An empty chair earns R0. A R20 discount that fills it on a Tuesday is
                still profit — your costs are already paid.
              </p>
            </div>
          )}
          {mode === "admin" && (
            <div className="p-3 m-3 rounded-xl bg-slate-800/60 border border-slate-700">
              <div className="text-xs font-bold text-brand mb-1">👑 Platform View</div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                You&apos;re behind the curtain. Actions here affect all tenants.
              </p>
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 pb-24 md:pb-8">{children}</main>
      </div>

      {/* ─── Mobile bottom tab bar ──────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background border-t border-border grid grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {(mode === "tenant" ? TENANT_NAV : ADMIN_NAV).map((item) => {
          const Icon = item.icon;
          const active = activeId === item.id;
          return (
            <button
              key={item.id}
              onClick={() =>
                mode === "admin"
                  ? setAdminView(item.id as never)
                  : setTenantView(item.id as never)
              }
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors min-h-[52px]",
                active ? "text-brand" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* ─── Sticky footer (desktop only — mobile uses the tab bar) ──── */}
      <footer className="hidden md:block mt-auto border-t border-border bg-background">
        <div className="px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-brand">Flavourly OS</span>
            <span className="hidden sm:inline">·</span>
            <span className="hidden sm:inline">Fill your empty chairs. Turn walk-ins into regulars.</span>
          </div>
          <div className="flex items-center gap-3">
            <span>🇿🇦 Built for Southern African SMEs</span>
            <span className="hidden sm:inline">·</span>
            <button onClick={() => openLegal("privacy")} className="hover:text-foreground transition-colors underline-offset-2 hover:underline">Privacy</button>
            <button onClick={() => openLegal("terms")} className="hover:text-foreground transition-colors underline-offset-2 hover:underline">Terms</button>
            <span className="hidden sm:inline">·</span>
            <span>Opt out any time with STOP</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DemoMenuItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent transition-colors text-left"
    >
      <span className="text-brand">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium leading-tight">{label}</span>
        <span className="block text-[11px] text-muted-foreground leading-tight">{hint}</span>
      </span>
    </button>
  );
}
