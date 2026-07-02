"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  INDUSTRY_CURRENCY,
  INDUSTRY_EMOJI,
  INDUSTRY_LABELS,
} from "@/lib/flavourly";
import {
  Sparkles,
  ArrowRight,
  LogIn,
  QrCode,
  MessageCircle,
  Megaphone,
  Check,
} from "lucide-react";

interface LandingViewProps {
  onSignup: () => void;
  onLogin: () => void;
}

const INDUSTRIES = Object.keys(INDUSTRY_LABELS);

const PROBLEM_CARDS = [
  {
    emoji: "🪑",
    title: "Empty seats earn R0",
    body: "Every empty chair on a slow Tuesday is money walking out the door. Most owners just hope for the best.",
  },
  {
    emoji: "📝",
    title: "Paper punch cards die",
    body: "They get lost, washed, forgotten. Customers never get to stamp #10 — and you never see them again.",
  },
  {
    emoji: "📱",
    title: "Apps don't get installed",
    body: "Nobody downloads a loyalty app for every coffee shop. But every South African already has WhatsApp open.",
  },
];

const HOW_STEPS = [
  {
    n: "1️⃣",
    title: "Print your QR",
    body: "We generate a brand-coloured poster. Stick it on your counter, table tent, or till slip.",
    icon: QrCode,
  },
  {
    n: "2️⃣",
    title: "They text JOIN",
    body: "Customers scan, WhatsApp opens with JOIN pre-typed, they hit send. Done. They're in your loyalty list.",
    icon: MessageCircle,
  },
  {
    n: "3️⃣",
    title: "You send promos",
    body: "One Tuesday morning you text 200 regulars: 'Free coffee today only'. Chairs fill. Tills ring.",
    icon: Megaphone,
  },
];

const PRICING = [
  {
    plan: "Starter",
    price: "R299",
    period: "/mo",
    emoji: "🌱",
    features: [
      "Up to 500 customers",
      "WhatsApp loyalty QR",
      "5 promo campaigns / month",
      "Basic insights",
    ],
    cta: "Start Free Trial",
    highlight: false,
  },
  {
    plan: "Growth",
    price: "R499",
    period: "/mo",
    emoji: "🚀",
    features: [
      "Unlimited customers",
      "WhatsApp + automations",
      "Unlimited campaigns",
      "Advanced insights + coach",
      "Geo-claim your area",
    ],
    cta: "Start Free Trial",
    highlight: true,
  },
];

export function LandingView({ onSignup, onLogin }: LandingViewProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ─── 1. HERO ─────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16 text-white text-center overflow-hidden bg-gradient-to-br from-brand to-amber-500">
        {/* Logo + wordmark */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-2xl shadow-lg">
            💡
          </div>
          <span className="text-xl font-black tracking-tight">Flavourly OS</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black leading-[1.05] max-w-4xl text-balance">
          Fill your empty chairs.
          <br />
          Turn walk-ins into regulars. 🪑✨
        </h1>

        {/* Subtext */}
        <p className="mt-6 text-base sm:text-lg md:text-xl text-white/90 max-w-2xl leading-relaxed">
          The WhatsApp loyalty OS for Southern African SMEs. No app to install.
          No paper punch cards. Just scan, text <span className="font-bold">JOIN</span>,
          and watch your regulars come back. 🇿🇦
        </p>

        {/* CTAs */}
        <div className="mt-9 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <Button
            onClick={onSignup}
            size="lg"
            className="w-full sm:w-auto min-h-[48px] bg-white text-brand hover:bg-white/90 shadow-xl text-base font-bold px-8"
          >
            Start Free Trial <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            onClick={onLogin}
            size="lg"
            variant="outline"
            className="w-full sm:w-auto min-h-[48px] bg-transparent border-2 border-white/70 text-white hover:bg-white/10 hover:text-white px-8"
          >
            <LogIn className="w-4 h-4" /> Log In
          </Button>
        </div>

        {/* Trial microcopy */}
        <p className="mt-5 text-sm text-white/80 font-medium">
          14-day free trial · No credit card
        </p>

        {/* Industry badges row */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2 max-w-2xl">
          {INDUSTRIES.map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur text-xs sm:text-sm font-semibold border border-white/20"
            >
              <span>{INDUSTRY_EMOJI[key]}</span>
              {INDUSTRY_LABELS[key]}
            </span>
          ))}
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/70 text-xs flex flex-col items-center gap-1 animate-bounce">
          <span>Scroll to see how</span>
          <span aria-hidden>↓</span>
        </div>
      </section>

      {/* ─── 2. THE PROBLEM ──────────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-error-light text-error-foreground text-xs font-bold uppercase tracking-wide mb-4">
              🪑 The Problem
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-balance">
              The Empty Chair Problem
            </h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Running an SME in South Africa is hard enough. These three things
              are silently costing you regulars every week.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PROBLEM_CARDS.map((c) => (
              <Card
                key={c.title}
                className="p-6 border-gray-100 shadow-sm hover:shadow-md transition-shadow text-center"
              >
                <div className="text-5xl mb-4">{c.emoji}</div>
                <h3 className="text-xl font-bold mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {c.body}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 3. HOW IT WORKS ─────────────────────────────────── */}
      <section className="py-20 px-4 bg-brand-light">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-brand text-xs font-bold uppercase tracking-wide mb-4 border border-brand/20">
              ⚡ How It Works
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-balance">
              Three steps to full chairs 🪑
            </h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Set up takes 10 minutes. After that, every customer who walks in
              can become a regular — without downloading anything.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {HOW_STEPS.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.title}
                  className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-brand/10 text-center"
                >
                  <div className="text-4xl mb-3">{s.n}</div>
                  <div className="w-12 h-12 rounded-xl bg-brand-light text-brand flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {s.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 4. INDUSTRY-SPECIFIC ────────────────────────────── */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-light text-brand text-xs font-bold uppercase tracking-wide mb-4">
              🎯 Built for your trade
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-balance">
              Speaks your language 🗣️
            </h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Flavourly adapts its loyalty currency to your industry. No
              one-size-fits-all "points" — your customers earn what makes sense.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {INDUSTRIES.map((key) => (
              <Card
                key={key}
                className="p-6 border-gray-100 shadow-sm hover:shadow-md hover:border-brand/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center text-3xl shrink-0">
                    {INDUSTRY_EMOJI[key]}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold">{INDUSTRY_LABELS[key]}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Customers earn{" "}
                      <span className="font-bold text-brand">
                        {INDUSTRY_CURRENCY[key]}
                      </span>{" "}
                      on every visit. Unlock rewards automatically.
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 5. PRICING ──────────────────────────────────────── */}
      <section className="py-20 px-4 bg-brand-light">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-brand text-xs font-bold uppercase tracking-wide mb-4 border border-brand/20">
              💸 Pricing
            </div>
            <h2 className="text-4xl sm:text-5xl font-black text-balance">
              Less than one customer a month 🤑
            </h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              If Flavourly brings back even one regular a month, it pays for
              itself. Start free for 14 days — no card needed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PRICING.map((p) => (
              <Card
                key={p.plan}
                className={`p-8 shadow-sm relative ${
                  p.highlight
                    ? "border-2 border-brand shadow-lg"
                    : "border-gray-100"
                }`}
              >
                {p.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-brand text-white text-xs font-bold uppercase tracking-wide shadow">
                    ⭐ Most popular
                  </div>
                )}
                <div className="text-3xl mb-2">{p.emoji}</div>
                <h3 className="text-xl font-bold">{p.plan}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-brand">
                    {p.price}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {p.period}
                  </span>
                </div>
                <ul className="mt-6 space-y-3">
                  {p.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <span className="w-5 h-5 rounded-full bg-success-light flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-success-foreground" />
                      </span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={onSignup}
                  className={`w-full mt-7 min-h-[48px] font-bold ${
                    p.highlight
                      ? "bg-brand hover:bg-brand-dark text-white"
                      : "bg-white text-brand border-2 border-brand hover:bg-brand-light"
                  }`}
                  size="lg"
                >
                  {p.cta} <ArrowRight className="w-4 h-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 6. FINAL CTA ────────────────────────────────────── */}
      <section className="py-20 px-4 bg-gradient-to-br from-brand to-amber-500 text-white text-center">
        <div className="max-w-3xl mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-3xl mx-auto mb-6 shadow-lg">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-4xl sm:text-5xl font-black text-balance">
            Ready to fill your empty chairs? 🪑🚀
          </h2>
          <p className="mt-5 text-base sm:text-lg text-white/90 max-w-xl mx-auto">
            Join the Southern African SMEs turning walk-ins into regulars with
            WhatsApp. Setup takes 10 minutes — your first promo could go out
            today.
          </p>
          <Button
            onClick={onSignup}
            size="lg"
            className="mt-8 min-h-[52px] bg-white text-brand hover:bg-white/90 shadow-xl text-base font-bold px-10"
          >
            Start Free Trial →
          </Button>
          <p className="mt-4 text-sm text-white/80 font-medium">
            14-day free trial · No credit card · Cancel anytime
          </p>
        </div>
      </section>

      {/* ─── 7. FOOTER ───────────────────────────────────────── */}
      <footer className="bg-gray-900 text-gray-300 py-8 px-4 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-brand flex items-center justify-center text-sm">
              💡
            </div>
            <span className="font-bold text-white">Flavourly OS</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-400">
            🇿🇦 Built in South Africa · POPIA compliant
          </p>
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Flavourly OS
          </p>
        </div>
      </footer>
    </div>
  );
}
