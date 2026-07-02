"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useFlavourly } from "@/lib/store";
import { X, CheckCircle2, Lock } from "lucide-react";

interface GhostTenant {
  id: string;
  name: string;
  industry: string;
  industryLabel: string;
  industryEmoji: string;
  currencyName: string;
  brandColor: string;
  logoUrl: string | null;
  locationLabel: string | null;
}

export function ClaimOverlay() {
  const { closePublic, claimToken } = useFlavourly();
  const [ghost, setGhost] = useState<GhostTenant | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // If no token provided, fetch the first available unclaimed prospect's token
  useEffect(() => {
    (async () => {
      let token = claimToken;
      if (!token) {
        // Grab a demo ghost tenant token
        const res = await fetch("/api/prospects?status=new");
        const data = await res.json();
        const first = data.prospects?.find((p: { claimToken: string | null }) => p.claimToken);
        token = first?.claimToken ?? null;
      }
      if (!token) {
        setError("No claimable dashboards available. Upload prospects in Super Admin first.");
        setLoading(false);
        return;
      }
      const r = await fetch(`/api/claim/${token}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.message ?? "This link has expired.");
        setLoading(false);
        return;
      }
      setGhost(await r.json());
      setLoading(false);
    })();
  }, [claimToken]);

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto">
      {/* Close button */}
      <button
        onClick={closePublic}
        className="fixed top-4 right-4 z-[110] w-10 h-10 rounded-full bg-white/20 backdrop-blur text-white hover:bg-white/30 flex items-center justify-center transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {loading ? (
        <div className="min-h-full flex items-center justify-center p-6">
          <Skeleton className="w-full max-w-md h-96 rounded-2xl bg-white/20" />
        </div>
      ) : error ? (
        <ExpiredState message={error} onClose={closePublic} />
      ) : ghost ? (
        <ClaimContent ghost={ghost} onClose={closePublic} />
      ) : null}
    </div>
  );
}

function ClaimContent({ ghost, onClose }: { ghost: GhostTenant; onClose: () => void }) {
  const [ownerName, setOwnerName] = useState(ghost.name ? "" : "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const claimUrl = typeof window !== "undefined" ? `${window.location.origin}/claim/demo` : "";

  const submit = async () => {
    if (!ownerName.trim() || !email.trim() || !password) {
      toast.error("All fields are required");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setSubmitting(true);
    // Use the ghost's claim token via the API. We stored token in ghost? No — re-fetch token.
    // Simpler: POST to the claim endpoint with the token from the URL we fetched.
    // We need the token — refetch from prospects.
    const pRes = await fetch("/api/prospects?status=new");
    const pData = await pRes.json();
    const matched = pData.prospects?.find((p: { name?: string; businessName: string; claimToken: string | null }) =>
      p.businessName === ghost.name
    );
    const token = matched?.claimToken;
    if (!token) {
      toast.error("Couldn't find the claim token. Please refresh.");
      setSubmitting(false);
      return;
    }
    const r = await fetch(`/api/claim/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ownerName, email, password }),
    });
    setSubmitting(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      toast.error(d.error ?? "Claim failed");
      return;
    }
    // Auto-login the newly created account
    await signIn("credentials", { email, password, redirect: false });
    setDone(true);
    toast.success("🎉 Dashboard claimed! Your 14-day trial has started.");
  };

  if (done) {
    return (
      <div
        className="min-h-full flex items-center justify-center p-6"
        style={{ background: `linear-gradient(135deg, ${ghost.brandColor}, #FF8C42)` }}
      >
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-success-light flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h2 className="text-2xl font-black mb-2">You&apos;re all set, {ownerName.split(" ")[0]}! 🎉</h2>
          <p className="text-muted-foreground mb-6">
            <strong>{ghost.name}</strong>&apos;s WhatsApp Loyalty System is now yours. Your 14-day free
            trial has started — no credit card needed.
          </p>
          <div className="bg-brand-light rounded-xl p-4 mb-6 text-left">
            <div className="text-xs font-semibold text-brand uppercase tracking-wide mb-1">Next steps</div>
            <ol className="text-sm space-y-1.5 text-foreground">
              <li>1. Open your dashboard 🏠</li>
              <li>2. Connect your WhatsApp in Settings ⚙️</li>
              <li>3. Print your QR poster and display it 📲</li>
              <li>4. Send your first promo 📣</li>
            </ol>
          </div>
          <Button
            className="w-full bg-brand hover:bg-brand-dark text-white"
            size="lg"
            onClick={onClose}
          >
            Open My Dashboard →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-full"
      style={{ background: `linear-gradient(160deg, ${ghost.brandColor}, #FF8C42 60%, #FFB37A)` }}
    >
      <div className="max-w-md mx-auto px-5 py-10 sm:py-16">
        {/* Hero */}
        <div className="text-center text-white mb-6">
          <div
            className="w-16 h-16 rounded-2xl bg-white/95 flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg"
          >
            {ghost.industryEmoji}
          </div>
          <h1 className="text-3xl sm:text-4xl font-black leading-tight">
            Welcome, {ghost.name}!
          </h1>
          <p className="text-lg text-white/90 mt-2">
            Your <strong className="text-white">{ghost.currencyName}</strong> Loyalty System is
            built and ready to use.
          </p>
        </div>

        {/* Phone mockup */}
        <div className="phone-frame bg-slate-900 p-2 mb-6 mx-auto max-w-[260px]">
          <div className="bg-[#E5DDD5] rounded-[2rem] overflow-hidden">
            {/* WhatsApp header */}
            <div className="bg-[#075E54] text-white px-3 py-2.5 flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
                style={{ background: ghost.brandColor }}
              >
                {ghost.industryEmoji}
              </div>
              <div>
                <div className="text-sm font-semibold leading-tight">{ghost.name}</div>
                <div className="text-[10px] text-white/70 leading-tight">online</div>
              </div>
            </div>
            {/* Chat */}
            <div className="p-3 space-y-2 min-h-[180px]">
              <div className="bg-white rounded-lg px-3 py-2 text-xs max-w-[85%] shadow-sm">
                <div className="text-[10px] font-semibold mb-0.5" style={{ color: ghost.brandColor }}>
                  You
                </div>
                JOIN
              </div>
              <div
                className="bg-[#DCF8C6] rounded-lg px-3 py-2 text-xs max-w-[85%] ml-auto shadow-sm"
                style={{ background: `${ghost.brandColor}22` }}
              >
                🎉 Welcome to {ghost.name}! You&apos;ve earned 2 {ghost.currencyName} for joining.
                Text BALANCE anytime to check your score. See you soon! 🙌
                <div className="text-[9px] text-gray-400 text-right mt-0.5">12:01 ✓✓</div>
              </div>
            </div>
          </div>
        </div>

        {/* QR preview */}
        <div className="bg-white/15 backdrop-blur rounded-2xl p-4 mb-6 flex items-center gap-4">
          <div className="bg-white p-2 rounded-lg">
            <QRCodeSVG value={claimUrl || "demo"} size={72} fgColor={ghost.brandColor} level="M" />
          </div>
          <div className="text-white text-xs flex-1">
            <div className="font-semibold mb-0.5">Your loyalty QR</div>
            <div className="text-white/80">Customers scan this to join in 5 seconds.</div>
          </div>
        </div>

        {/* Claim form */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-brand" />
            <h2 className="text-lg font-bold">Claim Your Free Dashboard</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Set a password to access your dashboard. We&apos;ll never share your details.
          </p>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ownerName" className="text-xs font-semibold">Full Name</Label>
              <Input
                id="ownerName"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="e.g. Sipho Maseko"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="email" className="text-xs font-semibold">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@business.co.za"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="password" className="text-xs font-semibold">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 chars"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="confirm" className="text-xs font-semibold">Confirm</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat"
                  className="mt-1"
                />
              </div>
            </div>
            <Button
              className="w-full bg-brand hover:bg-brand-dark text-white"
              size="lg"
              disabled={submitting}
              onClick={submit}
            >
              {submitting ? "Claiming…" : "Claim My Free Dashboard →"}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-4">
            14-day free trial. No credit card needed. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

function ExpiredState({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="min-h-full flex items-center justify-center p-6 bg-gradient-to-br from-slate-800 to-slate-900">
      <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="text-5xl mb-3">😔</div>
        <h2 className="text-xl font-bold mb-2">This link has expired</h2>
        <p className="text-sm text-muted-foreground mb-6">{message}</p>
        <Button variant="outline" onClick={onClose}>Close</Button>
      </div>
    </div>
  );
}
