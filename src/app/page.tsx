"use client";

import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/flavourly/shell";
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
  customerCount: number;
  campaignCount: number;
}

export default function Home() {
  const { mode, tenantView, adminView, publicOverlay } = useFlavourly();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshTenant = useCallback(async () => {
    const res = await fetch("/api/tenant");
    if (res.ok) {
      setTenant(await res.json());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/tenant");
      if (cancelled) return;
      if (res.ok) setTenant(await res.json());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <Shell tenant={tenant} onRefreshTenant={refreshTenant}>
        {loading ? (
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

      {/* Public overlays (full-screen, no shell) */}
      {publicOverlay === "claim" && <ClaimOverlay />}
      {publicOverlay === "geo-claim" && <GeoClaimOverlay tenantName={tenant?.name} />}
    </>
  );
}
