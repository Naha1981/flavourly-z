"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Shell } from "@/components/flavourly/shell";
import { ErrorBoundary } from "@/components/flavourly/error-boundary";
import { LandingView } from "@/components/flavourly/landing-view";
import { OnboardingOverlay } from "@/components/flavourly/overlays/onboarding-overlay";
import { DashboardView } from "@/components/flavourly/views/dashboard-view";
import { CustomersView } from "@/components/flavourly/views/customers-view";
import { PromosView } from "@/components/flavourly/views/promos-view";
import { InsightsView } from "@/components/flavourly/views/insights-view";
import { SettingsView } from "@/components/flavourly/views/settings-view";
import { AdminProspects } from "@/components/flavourly/views/admin-prospects";
import { AdminBroadcasts } from "@/components/flavourly/views/admin-broadcasts";
import { AdminWebhooks } from "@/components/flavourly/views/admin-webhooks";
import { ClaimOverlay } from "@/components/flavourly/overlays/claim-overlay";
import { GeoClaimOverlay } from "@/components/flavourly/overlays/geo-claim-overlay";
import { AuthOverlay } from "@/components/flavourly/overlays/auth-overlay";
import { LegalOverlay } from "@/components/flavourly/overlays/legal-overlay";
import { useFlavourly } from "@/lib/store";

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
  onboardingCompleted: boolean;
  customerCount: number;
  campaignCount: number;
}

export default function Home() {
  const {
    mode,
    tenantView,
    adminView,
    publicOverlay,
    authOverlay,
    legalOverlay,
    appOverlay,
    openAuth,
    openApp,
    closeApp,
  } = useFlavourly();
  const { data: session, status } = useSession();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [tenantLoading, setTenantLoading] = useState(true);

  const refreshTenant = useCallback(async () => {
    const res = await fetch("/api/tenant");
    if (res.ok) {
      setTenant(await res.json());
    } else {
      setTenant(null);
    }
    setTenantLoading(false);
  }, []);

  // Fetch tenant when auth state changes
  useEffect(() => {
    let cancelled = false;
    if (status !== "loading") {
      (async () => {
        const res = await fetch("/api/tenant");
        if (cancelled) return;
        if (res.ok) {
          setTenant(await res.json());
        } else {
          setTenant(null);
        }
        setTenantLoading(false);
      })();
    }
    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.id]);

  const handleAuthed = useCallback(() => {
    // Trigger tenant refetch via state change
    refreshTenant();
  }, [refreshTenant]);

  const handleOnboardingCompleted = useCallback(() => {
    closeApp();
    refreshTenant();
  }, [closeApp, refreshTenant]);

  // ── Render logic (auth guard) ──────────────────────────────────────────────
  const isLoading = status === "loading" || tenantLoading;
  const isAuthed = !!session?.user;
  const isSuperAdmin = session?.user?.role === "super_admin";
  const needsOnboarding = isAuthed && !!tenant && !tenant.onboardingCompleted && !isSuperAdmin;

  // Show onboarding overlay if needed (authed, has tenant, not onboarded)
  useEffect(() => {
    if (needsOnboarding && !appOverlay) {
      openApp("onboarding");
    }
    if (!needsOnboarding && appOverlay === "onboarding") {
      closeApp();
    }
  }, [needsOnboarding, appOverlay, openApp, closeApp]);

  return (
    <ErrorBoundary>
      {/* ── Unauthenticated → Landing page ───────────────────────────────── */}
      {!isAuthed && !isLoading && (
        <LandingView
          onSignup={() => openAuth("signup")}
          onLogin={() => openAuth("login")}
        />
      )}

      {/* ── Loading state ─────────────────────────────────────────────────── */}
      {isLoading && !isAuthed && (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mx-auto mb-4 animate-pulse"
              style={{ background: "var(--brand)" }}
            >
              💡
            </div>
            <div className="text-sm text-muted-foreground">Loading Flavourly…</div>
          </div>
        </div>
      )}

      {/* ── Authenticated → Shell + views ────────────────────────────────── */}
      {isAuthed && !needsOnboarding && (
        <Shell tenant={tenant} onRefreshTenant={refreshTenant}>
          {tenantLoading ? (
            <div className="p-6 text-muted-foreground">Loading your dashboard…</div>
          ) : mode === "admin" ? (
            <>
              {adminView === "prospects" && <AdminProspects />}
              {adminView === "broadcasts" && <AdminBroadcasts />}
              {adminView === "webhooks" && <AdminWebhooks />}
            </>
          ) : (
            <>
              {tenantView === "dashboard" && <DashboardView tenant={tenant} />}
              {tenantView === "customers" && <CustomersView tenant={tenant} />}
              {tenantView === "promos" && <PromosView tenant={tenant} />}
              {tenantView === "insights" && <InsightsView tenant={tenant} />}
              {tenantView === "settings" && (
                <SettingsView tenant={tenant} onUpdated={refreshTenant} />
              )}
            </>
          )}
        </Shell>
      )}

      {/* ── Overlays ──────────────────────────────────────────────────────── */}
      {appOverlay === "onboarding" && tenant && (
        <OnboardingOverlay tenant={tenant} onCompleted={handleOnboardingCompleted} />
      )}
      {publicOverlay === "claim" && <ClaimOverlay />}
      {publicOverlay === "geo-claim" && <GeoClaimOverlay tenantName={tenant?.name} />}
      {authOverlay && <AuthOverlay onAuthed={handleAuthed} />}
      {legalOverlay && <LegalOverlay />}
    </ErrorBoundary>
  );
}
