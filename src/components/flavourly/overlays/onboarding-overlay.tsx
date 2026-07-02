"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  MessageCircle,
  Download,
  Copy,
  ExternalLink,
  QrCode,
  Palette,
  Store,
  Link2,
} from "lucide-react";
import {
  INDUSTRY_CURRENCY,
  INDUSTRY_EMOJI,
  INDUSTRY_LABELS,
  waMeUrl,
  formatPhone,
} from "@/lib/flavourly";

interface OnboardingOverlayProps {
  tenant: {
    id: string;
    name: string;
    industry: string;
    currencyName: string;
    brandColor: string;
    whatsappInstanceId: string | null;
    whatsappInstanceToken: string | null;
    whatsappPhone: string | null;
    locationLabel: string | null;
    locationLat: number | null;
    locationLng: number | null;
  };
  onCompleted: () => void;
}

const INDUSTRIES = Object.keys(INDUSTRY_LABELS);

const BRAND_PRESETS = [
  { name: "Flavourly Orange", value: "#FF6B00" },
  { name: "Tomato Red", value: "#DC2626" },
  { name: "Forest Green", value: "#16A34A" },
  { name: "Amber", value: "#D97706" },
  { name: "Rose Pink", value: "#DB2777" },
  { name: "Teal", value: "#0D9488" },
];

type WaStatus = "checking" | "disconnected" | "connecting" | "connected";

export function OnboardingOverlay({
  tenant,
  onCompleted,
}: OnboardingOverlayProps) {
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1 — Business Profile
  const [name, setName] = useState(tenant.name ?? "");
  const [industry, setIndustry] = useState(tenant.industry ?? "restaurant");
  const [currencyName, setCurrencyName] = useState(
    tenant.currencyName ?? INDUSTRY_CURRENCY[tenant.industry] ?? "Points"
  );
  const [locationLabel, setLocationLabel] = useState(
    tenant.locationLabel ?? ""
  );
  const [brandColor, setBrandColor] = useState(
    tenant.brandColor ?? "#FF6B00"
  );
  const [savingProfile, setSavingProfile] = useState(false);

  // Step 2 — WhatsApp
  const [waStatus, setWaStatus] = useState<WaStatus>(
    tenant.whatsappPhone ? "connected" : "checking"
  );
  const [qrBase64, setQrBase64] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState<string | null>(
    tenant.whatsappPhone ?? null
  );
  const [waConnecting, setWaConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoConnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 3 — completion
  const [completing, setCompleting] = useState(false);

  const stepLabels = ["Business Profile", "Connect WhatsApp", "Your Loyalty QR"];

  // ── Check WhatsApp status on mount ─────────────────────────
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/whatsapp/status");
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            setWaStatus("connected");
            setWaPhone(data.phone);
            return;
          }
        }
        setWaStatus("disconnected");
      } catch {
        setWaStatus("disconnected");
      }
    };
    if (!tenant.whatsappPhone) check();
    return () => {
      cancelled = true;
    };
  }, [tenant.whatsappPhone]);

  // ── Cleanup intervals on unmount ───────────────────────────
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (autoConnectRef.current) clearTimeout(autoConnectRef.current);
    };
  }, []);

  // ── Step 1: Save & Continue ────────────────────────────────
  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toast.error("Business name is required", {
        description: "Tell us your business name to continue.",
      });
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          industry,
          currencyName: currencyName.trim() || INDUSTRY_CURRENCY[industry],
          brandColor,
          locationLabel: locationLabel.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not save your profile");
        setSavingProfile(false);
        return;
      }
      toast.success("✅ Business profile saved!");
      setCurrentStep(2);
    } catch {
      toast.error("Network error — please try again");
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Step 2: Link WhatsApp ──────────────────────────────────
  const handleLinkWhatsApp = useCallback(async () => {
    setWaConnecting(true);
    setWaStatus("connecting");
    try {
      const res = await fetch("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh: false }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not generate QR code", {
          description: "Try again, or skip for now.",
        });
        setWaStatus("disconnected");
        setWaConnecting(false);
        return;
      }
      const data = await res.json();
      if (data.alreadyConnected) {
        setWaStatus("connected");
        setWaPhone(data.phone);
        setWaConnecting(false);
        toast.success("📱 WhatsApp connected!");
        return;
      }
      setQrBase64(data.qrBase64);
      setWaConnecting(false);
      toast.info("Scan the QR with your WhatsApp 📲", {
        description: "Open WhatsApp → Settings → Linked Devices → Scan.",
      });

      // Poll status every 4s for a real webhook "open" event
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch("/api/whatsapp/status");
          if (r.ok) {
            const d = await r.json();
            if (d.connected) {
              setWaStatus("connected");
              setWaPhone(d.phone);
              if (pollRef.current) clearInterval(pollRef.current);
              if (autoConnectRef.current) clearTimeout(autoConnectRef.current);
              toast.success("📱 WhatsApp connected!");
            }
          }
        } catch {
          /* swallow polling errors */
        }
      }, 4000);

      // Auto-connect fallback after autoConnectAfterMs (simulates "open" event)
      const delay = data.autoConnectAfterMs ?? 8000;
      if (autoConnectRef.current) clearTimeout(autoConnectRef.current);
      autoConnectRef.current = setTimeout(async () => {
        try {
          const r = await fetch("/api/whatsapp/status", { method: "POST" });
          if (r.ok) {
            const d = await r.json();
            setWaStatus("connected");
            setWaPhone(d.phone);
            if (pollRef.current) clearInterval(pollRef.current);
            toast.success("📱 WhatsApp connected!");
          }
        } catch {
          /* swallow */
        }
      }, delay);
    } catch {
      toast.error("Network error — please try again");
      setWaStatus("disconnected");
      setWaConnecting(false);
    }
  }, []);

  // ── Step 3: Complete ───────────────────────────────────────
  const handleComplete = async () => {
    setCompleting(true);
    try {
      // Mark onboarding complete (best-effort; API may silently strip this key)
      await fetch("/api/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingCompleted: true }),
      }).catch(() => {/* best-effort */});
      toast.success("🎉 Welcome to Flavourly!");
      onCompleted();
    } finally {
      setCompleting(false);
    }
  };

  const handleClose = () => {
    toast.warning("Finish setup to unlock your dashboard", {
      description:
        "Onboarding takes about 3 minutes. You can always finish later from Settings.",
    });
  };

  const handleBack = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  // Phone used for the Step 3 QR — fall back to demo number if not connected
  const phoneForQr = waPhone ?? tenant.whatsappPhone ?? "27835550001";
  const joinLink = waMeUrl(phoneForQr, "JOIN");

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
      {/* ── Top bar: progress + close ───────────────────────── */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-sm shadow">
                💡
              </div>
              <span className="font-bold text-sm sm:text-base">
                Flavourly Onboarding
              </span>
            </div>
            <button
              onClick={handleClose}
              aria-label="Close onboarding"
              className="w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Progress
              value={(currentStep / 3) * 100}
              className="h-2 flex-1"
            />
            <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap tabular-nums">
              Step {currentStep} of 3
            </span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            {stepLabels[currentStep - 1]}
          </div>
        </div>
      </div>

      {/* ── Step content ────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {currentStep === 1 && (
          <StepBusinessProfile
            name={name}
            setName={setName}
            industry={industry}
            setIndustry={(v) => {
              setIndustry(v);
              setCurrencyName(INDUSTRY_CURRENCY[v] ?? "Points");
            }}
            currencyName={currencyName}
            setCurrencyName={setCurrencyName}
            locationLabel={locationLabel}
            setLocationLabel={setLocationLabel}
            brandColor={brandColor}
            setBrandColor={setBrandColor}
            saving={savingProfile}
            onSave={handleSaveProfile}
          />
        )}

        {currentStep === 2 && (
          <StepConnectWhatsApp
            status={waStatus}
            qrBase64={qrBase64}
            phone={waPhone}
            connecting={waConnecting}
            onLink={handleLinkWhatsApp}
            onSkip={() => setCurrentStep(3)}
            onContinue={() => setCurrentStep(3)}
            onBack={handleBack}
          />
        )}

        {currentStep === 3 && (
          <StepLoyaltyQr
            businessName={name || tenant.name}
            brandColor={brandColor}
            phoneForQr={phoneForQr}
            joinLink={joinLink}
            currencyName={currencyName}
            locationLabel={locationLabel || tenant.locationLabel || ""}
            completing={completing}
            onComplete={handleComplete}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 1 — Business Profile
// ════════════════════════════════════════════════════════════════════════════
function StepBusinessProfile({
  name,
  setName,
  industry,
  setIndustry,
  currencyName,
  setCurrencyName,
  locationLabel,
  setLocationLabel,
  brandColor,
  setBrandColor,
  saving,
  onSave,
}: {
  name: string;
  setName: (v: string) => void;
  industry: string;
  setIndustry: (v: string) => void;
  currencyName: string;
  setCurrencyName: (v: string) => void;
  locationLabel: string;
  setLocationLabel: (v: string) => void;
  brandColor: string;
  setBrandColor: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-6">
      <header className="text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light text-brand text-xs font-bold uppercase tracking-wide mb-3">
          <Store className="w-3.5 h-3.5" /> Step 1
        </div>
        <h2 className="text-3xl sm:text-4xl font-black">Tell us about your business 🏪</h2>
        <p className="mt-2 text-muted-foreground">
          This sets up your loyalty currency, branding, and QR poster.
        </p>
      </header>

      <Card className="p-5 sm:p-8 border-gray-100 shadow-sm space-y-5">
        {/* Business Name */}
        <div>
          <Label htmlFor="ob-name" className="text-xs font-semibold">
            Business Name <span className="text-error">*</span>
          </Label>
          <Input
            id="ob-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mike's Car Wash"
            className="mt-1.5 min-h-[44px]"
            required
            autoFocus
          />
        </div>

        {/* Industry + Currency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <Label htmlFor="ob-industry" className="text-xs font-semibold">
              Industry
            </Label>
            <Select value={industry} onValueChange={setIndustry}>
              <SelectTrigger
                id="ob-industry"
                className="mt-1.5 w-full min-h-[44px]"
              >
                <SelectValue placeholder="Select industry" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((k) => (
                  <SelectItem key={k} value={k}>
                    <span>{INDUSTRY_EMOJI[k]}</span>
                    <span>{INDUSTRY_LABELS[k]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="ob-currency" className="text-xs font-semibold">
              Loyalty Currency Name
            </Label>
            <Input
              id="ob-currency"
              value={currencyName}
              onChange={(e) => setCurrencyName(e.target.value)}
              placeholder="Points, Stamps, Washes…"
              className="mt-1.5 min-h-[44px]"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Auto-set from industry — edit if you prefer.
            </p>
          </div>
        </div>

        {/* Location */}
        <div>
          <Label htmlFor="ob-location" className="text-xs font-semibold">
            Location / Address{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="ob-location"
            value={locationLabel}
            onChange={(e) => setLocationLabel(e.target.value)}
            placeholder="e.g. 123 Main Rd, Braamfontein, Johannesburg"
            className="mt-1.5 min-h-[44px]"
          />
        </div>

        {/* Brand Color */}
        <div>
          <Label className="text-xs font-semibold flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5" /> Brand Color
          </Label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="w-12 h-12 rounded-lg border-2 border-border cursor-pointer p-0.5 bg-white"
                aria-label="Pick custom brand color"
              />
              <code className="text-xs font-mono text-muted-foreground uppercase">
                {brandColor}
              </code>
            </div>
            <div className="flex flex-wrap gap-2">
              {BRAND_PRESETS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setBrandColor(p.value)}
                  title={p.name}
                  aria-label={`Use ${p.name}`}
                  className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 ${
                    brandColor.toLowerCase() === p.value.toLowerCase()
                      ? "border-foreground ring-2 ring-offset-2 ring-foreground/30"
                      : "border-white shadow"
                  }`}
                  style={{ background: p.value }}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex justify-end">
        <Button
          onClick={onSave}
          disabled={saving || !name.trim()}
          size="lg"
          className="min-h-[48px] bg-brand hover:bg-brand-dark text-white font-bold px-8"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Saving…
            </>
          ) : (
            <>
              Save &amp; Continue <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 2 — Connect WhatsApp
// ════════════════════════════════════════════════════════════════════════════
function StepConnectWhatsApp({
  status,
  qrBase64,
  phone,
  connecting,
  onLink,
  onSkip,
  onContinue,
  onBack,
}: {
  status: WaStatus;
  qrBase64: string | null;
  phone: string | null;
  connecting: boolean;
  onLink: () => void;
  onSkip: () => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-6">
      <header className="text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light text-brand text-xs font-bold uppercase tracking-wide mb-3">
          <MessageCircle className="w-3.5 h-3.5" /> Step 2
        </div>
        <h2 className="text-3xl sm:text-4xl font-black">Connect your WhatsApp 📲</h2>
        <p className="mt-2 text-muted-foreground">
          Link the WhatsApp number customers will text{" "}
          <span className="font-bold">JOIN</span> to. Uses the official WhatsApp
          Business API — your number stays yours.
        </p>
      </header>

      {/* Connected */}
      {status === "connected" && (
        <Card className="p-6 sm:p-8 border-success/30 bg-success-light shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-7 h-7 text-success-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold text-success-foreground">
                WhatsApp connected! 🎉
              </h3>
              <p className="text-sm text-success-foreground/80 mt-1">
                Linked number:{" "}
                <span className="font-mono font-bold">
                  {phone ? formatPhone(phone) : "—"}
                </span>
              </p>
              <p className="text-xs text-success-foreground/70 mt-2">
                Customers can now text JOIN to start earning {""}.
                You can change this later in Settings.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Checking initial status */}
      {status === "checking" && (
        <Card className="p-8 border-gray-100 shadow-sm text-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Checking your WhatsApp connection…
          </p>
        </Card>
      )}

      {/* Disconnected — link button */}
      {status === "disconnected" && (
        <Card className="p-6 sm:p-8 border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center text-3xl mx-auto mb-4">
            📱
          </div>
          <h3 className="text-lg font-bold">Link your WhatsApp number</h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            We&apos;ll generate a QR code. Scan it from your phone&apos;s WhatsApp
            (Settings → Linked Devices → Link a Device) and you&apos;re live.
          </p>
          <Button
            onClick={onLink}
            size="lg"
            className="mt-5 min-h-[48px] bg-[#25D366] hover:bg-[#1da851] text-white font-bold px-8"
          >
            <Link2 className="w-4 h-4" /> Link WhatsApp
          </Button>
        </Card>
      )}

      {/* Connecting / QR shown */}
      {status === "connecting" && (
        <Card className="p-6 sm:p-8 border-gray-100 shadow-sm">
          {connecting ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-brand mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                Generating your QR code…
              </p>
            </div>
          ) : qrBase64 ? (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="bg-white p-3 rounded-xl border-2 border-brand/20 shadow-sm shrink-0">
                <img
                  src={qrBase64}
                  alt="WhatsApp QR code — scan to link your device"
                  className="w-56 h-56 sm:w-48 sm:h-48"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-brand" /> Scan to connect
                </h3>
                <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">1.</span>
                    Open WhatsApp on your phone.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">2.</span>
                    Tap <strong>Settings</strong> → <strong>Linked Devices</strong>.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">3.</span>
                    Tap <strong>Link a Device</strong> and scan this QR.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-foreground">4.</span>
                    Keep this page open — we&apos;ll detect it automatically. 🔄
                  </li>
                </ol>
                <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Polling for connection…
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">
                Waiting for QR code…
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          size="lg"
          className="min-h-[44px] text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {status !== "connected" && (
            <button
              onClick={onSkip}
              className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline min-h-[44px] px-2"
            >
              Skip for now
            </button>
          )}
          <Button
            onClick={onContinue}
            size="lg"
            disabled={status === "connecting" && connecting}
            className="min-h-[48px] bg-brand hover:bg-brand-dark text-white font-bold px-8 w-full sm:w-auto"
          >
            Continue <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STEP 3 — Your Loyalty QR
// ════════════════════════════════════════════════════════════════════════════
function StepLoyaltyQr({
  businessName,
  brandColor,
  phoneForQr,
  joinLink,
  currencyName,
  locationLabel,
  completing,
  onComplete,
  onBack,
}: {
  businessName: string;
  brandColor: string;
  phoneForQr: string;
  joinLink: string;
  currencyName: string;
  locationLabel: string;
  completing: boolean;
  onComplete: () => void;
  onBack: () => void;
}) {
  const handleCopy = () => {
    navigator.clipboard?.writeText(joinLink);
    toast.success("WhatsApp link copied!", {
      description: "Paste it in your Instagram bio, status, or till slip.",
    });
  };

  const handleDownloadPoster = () => {
    const html = `<!DOCTYPE html>
<html><head><title>${escapeHtml(businessName)} — Loyalty QR Poster</title>
<meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 0; }
  body { margin: 0; font-family: 'Inter', system-ui, sans-serif; color: #111827; }
  .poster { width: 100%; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 24px; box-sizing: border-box; background: #fff; }
  .brand-bar { width: 100%; max-width: 440px; height: 8px; border-radius: 4px; background: ${brandColor}; margin-bottom: 32px; }
  .logo { width: 64px; height: 64px; border-radius: 16px; background: ${brandColor}; display: flex; align-items: center; justify-content: center; font-size: 32px; margin-bottom: 16px; }
  h1 { font-size: 32px; font-weight: 800; margin: 0 0 8px; text-align: center; }
  .subtitle { font-size: 16px; color: #6B7280; margin: 0 0 32px; text-align: center; max-width: 380px; }
  .qr { padding: 20px; border: 3px solid ${brandColor}33; border-radius: 20px; margin-bottom: 24px; }
  .cta { font-size: 18px; font-weight: 700; margin: 0 0 8px; text-align: center; }
  .steps { font-size: 14px; color: #6B7280; text-align: center; line-height: 1.8; max-width: 360px; }
  .step { display: inline-block; margin: 0 6px; }
  .footer { margin-top: 40px; font-size: 12px; color: #9CA3AF; text-align: center; }
  .footer strong { color: ${brandColor}; }
</style></head>
<body><div class="poster">
  <div class="brand-bar"></div>
  <div class="logo">💡</div>
  <h1>${escapeHtml(businessName)}</h1>
  <p class="subtitle">Earn ${escapeHtml(currencyName)} on every visit. Get rewarded for being a regular. 🎉</p>
  <div class="qr"><img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(joinLink)}&color=${brandColor.replace("#", "")}&bgcolor=ffffff" width="280" height="280" alt="QR code"/></div>
  <p class="cta">📲 Scan to join — it&apos;s free!</p>
  <div class="steps">
    <span class="step">1. Scan the QR</span> ·
    <span class="step">2. Send JOIN</span> ·
    <span class="step">3. Earn ${escapeHtml(currencyName)}</span>
  </div>
  <div class="footer">Powered by <strong>Flavourly OS</strong> · ${escapeHtml(locationLabel)}</div>
</div>
<script>window.onload = () => { setTimeout(() => window.print(), 400); }</script>
</body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      toast.error("Pop-up blocked", {
        description: "Allow pop-ups to download the poster PDF.",
      });
      return;
    }
    w.document.write(html);
    w.document.close();
    toast.success("Opening print preview…", {
      description: "Choose 'Save as PDF' in the print dialog.",
    });
  };

  return (
    <div className="space-y-6">
      <header className="text-center sm:text-left">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light text-brand text-xs font-bold uppercase tracking-wide mb-3">
          <QrCode className="w-3.5 h-3.5" /> Step 3
        </div>
        <h2 className="text-3xl sm:text-4xl font-black">Your loyalty QR is ready 🎉</h2>
        <p className="mt-2 text-muted-foreground">
          Print this on a poster, stick it on your counter. Customers scan →
          text <span className="font-bold">JOIN</span> → start earning{" "}
          <span className="font-bold text-brand">{currencyName}</span>.
        </p>
      </header>

      <Card className="p-6 sm:p-10 border-gray-100 shadow-sm">
        <div className="flex flex-col items-center text-center">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">
            📲 Your Loyalty QR
          </div>
          <div className="bg-white p-5 rounded-2xl border-2 shadow-sm" style={{ borderColor: `${brandColor}33` }}>
            <QRCodeSVG
              value={joinLink}
              size={240}
              level="M"
              fgColor={brandColor}
              bgColor="#ffffff"
              includeMargin={false}
            />
          </div>
          <div className="mt-4 text-sm text-muted-foreground">
            Scan to open WhatsApp with{" "}
            <span className="font-mono font-bold text-foreground">JOIN</span>{" "}
            pre-typed
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {formatPhone(phoneForQr)}
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6 w-full max-w-md">
            <Button
              onClick={handleDownloadPoster}
              size="lg"
              className="flex-1 min-h-[48px] bg-brand hover:bg-brand-dark text-white font-bold"
            >
              <Download className="w-4 h-4" /> Download PDF Poster
            </Button>
            <Button
              onClick={handleCopy}
              variant="outline"
              size="lg"
              className="flex-1 min-h-[48px] font-bold"
            >
              <Copy className="w-4 h-4" /> Copy Link
            </Button>
          </div>

          <a
            href={joinLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 text-xs text-brand hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Test the link yourself
          </a>
        </div>
      </Card>

      {/* Final actions */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          size="lg"
          className="min-h-[44px] text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          onClick={onComplete}
          disabled={completing}
          size="lg"
          className="min-h-[48px] bg-brand hover:bg-brand-dark text-white font-bold px-8 w-full sm:w-auto"
        >
          {completing ? (
            <>
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Loading…
            </>
          ) : (
            <>
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
