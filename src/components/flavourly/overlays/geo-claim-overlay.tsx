"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useFlavourly } from "@/lib/store";
import { X, MapPin, CheckCircle2, Clock, Navigation } from "lucide-react";

interface RewardData {
  id: string;
  tenantName: string;
  tenantId: string;
  currencyName: string;
  customerName: string | null;
  pointsCost: number;
  status: string;
  expiresAt: string | null;
  location: { lat: number | null; lng: number | null; label: string | null };
  brandColor: string;
}

type Phase = "loading" | "requesting_location" | "checking" | "unlocked" | "too_far" | "denied" | "expired" | "already_claimed" | "error";

export function GeoClaimOverlay({ tenantName }: { tenantName?: string }) {
  const { closePublic, geoClaimEventId } = useFlavourly();
  const [data, setData] = useState<RewardData | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [distance, setDistance] = useState<number | null>(null);
  const [eventId, setEventId] = useState<string | null>(geoClaimEventId);

  useEffect(() => {
    (async () => {
      let id = geoClaimEventId;
      if (!id) {
        // Create a fresh demo reward event
        const r = await fetch("/api/geo-claim/demo", { method: "POST" });
        if (!r.ok) {
          setErrorMsg("Couldn't create a demo reward. Make sure you have customers.");
          setPhase("error");
          return;
        }
        const d = await r.json();
        id = d.eventId;
        setEventId(d.eventId);
      }
      const res = await fetch(`/api/geo-claim/${id}`);
      const j = await res.json();
      if (!res.ok) {
        if (j.alreadyClaimed) {
          setPhase("already_claimed");
          return;
        }
        setErrorMsg(j.message ?? "This reward is no longer valid.");
        setPhase("expired");
        return;
      }
      setData(j);
      setPhase("requesting_location");
    })();
  }, [geoClaimEventId]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      // No geolocation support — allow manual check-in
      manualCheckIn();
      return;
    }
    setPhase("checking");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await verifyLocation(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setPhase("denied");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const verifyLocation = async (lat: number, lng: number) => {
    if (!eventId) return;
    const r = await fetch(`/api/geo-claim/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat, lng }),
    });
    const j = await r.json();
    if (j.claimed) {
      setDistance(j.distance ?? null);
      setPhase("unlocked");
      toast.success("🎉 Reward unlocked!");
    } else {
      setDistance(j.distance ?? null);
      setPhase("too_far");
    }
  };

  const manualCheckIn = async () => {
    if (!eventId) return;
    setPhase("checking");
    // POST without lat/lng — backend allows manual claim when no tenant location,
    // OR we send the tenant's own location as a fallback for the demo.
    const r = await fetch(`/api/geo-claim/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: data?.location.lat ?? -26.2041,
        lng: data?.location.lng ?? 28.0473,
      }),
    });
    const j = await r.json();
    if (j.claimed) {
      setPhase("unlocked");
      toast.success("🎉 Reward unlocked! (manual check-in)");
    } else {
      setDistance(j.distance ?? null);
      setPhase("too_far");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <button
        onClick={closePublic}
        className="fixed top-4 right-4 z-[110] w-10 h-10 rounded-full bg-white/15 backdrop-blur text-white hover:bg-white/25 flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      <div className="max-w-md mx-auto px-5 py-10 sm:py-16 min-h-full flex items-center">
        <div className="w-full">
          {phase === "loading" && (
            <div className="text-center text-white">
              <Skeleton className="w-24 h-24 rounded-full mx-auto bg-white/20" />
              <Skeleton className="w-48 h-6 mt-4 mx-auto bg-white/20" />
            </div>
          )}

          {phase === "requesting_location" && data && (
            <RequestLocationCard data={data} onAllow={requestLocation} onManual={manualCheckIn} />
          )}

          {phase === "checking" && (
            <CenterCard emoji="📍" title="Checking your location…" message="Hold tight — we're making sure you're at the business." />
          )}

          {phase === "unlocked" && data && (
            <UnlockedCard data={data} distance={distance} onClose={closePublic} />
          )}

          {phase === "too_far" && data && (
            <TooFarCard data={data} distance={distance} onRetry={requestLocation} onManual={manualCheckIn} />
          )}

          {phase === "denied" && data && (
            <DeniedCard data={data} onRetry={requestLocation} onManual={manualCheckIn} />
          )}

          {phase === "expired" && (
            <CenterCard emoji="⏰" title="This reward has expired" message={errorMsg || "Reward links are valid for 15 minutes. Text REDEEM again to get a fresh one."} onClose={closePublic} />
          )}

          {phase === "already_claimed" && (
            <CenterCard emoji="✅" title="Already claimed" message="This reward has already been used. Show a different one to the cashier." onClose={closePublic} />
          )}

          {phase === "error" && (
            <CenterCard emoji="😕" title="Something went wrong" message={errorMsg} onClose={closePublic} />
          )}
        </div>
      </div>
    </div>
  );
}

function RequestLocationCard({
  data,
  onAllow,
  onManual,
}: {
  data: RewardData;
  onAllow: () => void;
  onManual: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-4 shadow-lg"
        style={{ background: data.brandColor }}
      >
        🎁
      </div>
      <h1 className="text-2xl font-black mb-1">Your reward is ready!</h1>
      <p className="text-muted-foreground mb-1">
        From <strong>{data.tenantName}</strong>
      </p>
      <p className="text-sm text-muted-foreground mb-6">
        {data.pointsCost} {data.currencyName} redeemed · {data.customerName ? `Hi ${data.customerName.split(" ")[0]}!` : ""}
      </p>

      <div className="bg-brand-light rounded-xl p-4 mb-6 flex items-start gap-3 text-left">
        <MapPin className="w-5 h-5 text-brand shrink-0 mt-0.5" />
        <div className="text-sm">
          <div className="font-semibold text-brand">You need to be at {data.tenantName}</div>
          <div className="text-muted-foreground">
            {data.location.label ?? "We'll check you're within 500m to unlock."}
          </div>
        </div>
      </div>

      <Button
        className="w-full bg-brand hover:bg-brand-dark text-white mb-3"
        size="lg"
        onClick={onAllow}
      >
        <Navigation className="w-4 h-4 mr-2" /> Unlock My Reward
      </Button>
      <button
        onClick={onManual}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        Location not working? Try manual check-in
      </button>
    </div>
  );
}

function UnlockedCard({
  data,
  distance,
  onClose,
}: {
  data: RewardData;
  distance: number | null;
  onClose: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
      <div className="w-20 h-20 rounded-full bg-success-light flex items-center justify-center mx-auto mb-4 animate-bounce">
        <CheckCircle2 className="w-12 h-12 text-success" />
      </div>
      <h1 className="text-3xl font-black mb-2">🎉 Reward Unlocked!</h1>
      <p className="text-muted-foreground mb-6">
        Show this screen to the cashier at <strong>{data.tenantName}</strong>.
      </p>

      <div className="border-4 border-dashed border-brand rounded-2xl p-6 mb-6 bg-brand-light">
        <div className="text-xs font-semibold text-brand uppercase tracking-wide mb-2">
          Single-use Reward Code
        </div>
        <div className="bg-white p-3 rounded-lg inline-block">
          <QRCodeSVG value={`REWARD:${data.id}`} size={180} fgColor={data.brandColor} level="H" />
        </div>
        <div className="font-mono text-xs text-muted-foreground mt-3 break-all">
          {data.id.slice(-12).toUpperCase()}
        </div>
      </div>

      {distance !== null && (
        <p className="text-xs text-muted-foreground mb-4">
          📍 Verified {distance}m from {data.tenantName}
        </p>
      )}

      <Button variant="outline" className="w-full" onClick={onClose}>
        Done
      </Button>
    </div>
  );
}

function TooFarCard({
  data,
  distance,
  onRetry,
  onManual,
}: {
  data: RewardData;
  distance: number | null;
  onRetry: () => void;
  onManual: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
      <div className="text-5xl mb-3">📍</div>
      <h1 className="text-2xl font-black mb-2">You&apos;re too far away</h1>
      <p className="text-muted-foreground mb-6">
        {distance !== null ? (
          <>You&apos;re <strong>{distance}m</strong> from {data.tenantName}. Come to the business to unlock this reward.</>
        ) : (
          <>You need to be at <strong>{data.tenantName}</strong> to unlock this reward.</>
        )}
      </p>
      <Button className="w-full bg-brand hover:bg-brand-dark text-white mb-3" onClick={onRetry}>
        Check Again
      </Button>
      <button
        onClick={onManual}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        I&apos;m here — try manual check-in
      </button>
    </div>
  );
}

function DeniedCard({
  data,
  onRetry,
  onManual,
}: {
  data: RewardData;
  onRetry: () => void;
  onManual: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
      <div className="text-5xl mb-3">🔒</div>
      <h1 className="text-2xl font-black mb-2">Location permission needed</h1>
      <p className="text-muted-foreground mb-6">
        To unlock your reward, we need to confirm you&apos;re at <strong>{data.tenantName}</strong>.
        Enable location access in your browser settings and try again.
      </p>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 text-left text-xs text-amber-800">
        <strong>How to enable:</strong> Tap the location icon in your browser&apos;s address bar →
        Allow → reload this page.
      </div>
      <Button className="w-full bg-brand hover:bg-brand-dark text-white mb-3" onClick={onRetry}>
        Try Again
      </Button>
      <button
        onClick={onManual}
        className="text-xs text-muted-foreground hover:text-foreground underline"
      >
        Or try manual check-in
      </button>
    </div>
  );
}

function CenterCard({
  emoji,
  title,
  message,
  onClose,
}: {
  emoji: string;
  title: string;
  message: string;
  onClose?: () => void;
}) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-2xl text-center">
      <div className="text-5xl mb-3">{emoji}</div>
      <h1 className="text-2xl font-black mb-2">{title}</h1>
      <p className="text-muted-foreground mb-6">{message}</p>
      {onClose && (
        <Button variant="outline" className="w-full" onClick={onClose}>
          Close
        </Button>
      )}
    </div>
  );
}
