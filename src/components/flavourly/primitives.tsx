"use client";

import { cn } from "@/lib/utils";
import type { ChurnRisk } from "@/lib/flavourly";
import { churnRiskBadge } from "@/lib/flavourly";

// ─── Stat Card ───────────────────────────────────────────────────────────────
export function StatCard({
  emoji,
  value,
  label,
  subtext,
  variant = "default",
  tooltip,
}: {
  emoji: string;
  value: React.ReactNode;
  label: string;
  subtext?: string;
  variant?: "default" | "success" | "warning" | "brand";
  tooltip?: string;
}) {
  const variantClass = {
    default: "bg-white border-gray-100",
    success: "bg-success-light border-success/20",
    warning: "bg-warning-light border-warning/20",
    brand: "bg-brand-light border-brand/20",
  }[variant];
  const numberColor = {
    default: "text-gray-900",
    success: "text-success-foreground",
    warning: "text-warning-foreground",
    brand: "text-brand",
  }[variant];
  return (
    <div
      className={cn(
        "rounded-xl p-5 sm:p-6 shadow-sm border transition-all hover:shadow-md",
        variantClass
      )}
      title={tooltip}
    >
      <div className="text-2xl">{emoji}</div>
      <div className={cn("text-4xl sm:text-5xl font-black mt-1 leading-none", numberColor)}>
        {value}
      </div>
      <div className="text-xs sm:text-sm font-semibold text-gray-500 uppercase tracking-widest mt-2">
        {label}
      </div>
      {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
    </div>
  );
}

// ─── Status Badge ────────────────────────────────────────────────────────────
export function StatusBadge({
  risk,
  label,
  emoji,
  variant,
}: {
  risk?: ChurnRisk;
  label?: string;
  emoji?: string;
  variant?: "active" | "at_risk" | "dormant" | "new" | "info";
}) {
  if (risk) {
    const b = churnRiskBadge(risk);
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap",
          b.className
        )}
      >
        <span>{b.emoji}</span> {b.label}
      </span>
    );
  }
  const map: Record<string, { cls: string; e: string }> = {
    active: { cls: "bg-success-light text-success-foreground", e: "🟢" },
    at_risk: { cls: "bg-warning-light text-warning-foreground", e: "🟡" },
    dormant: { cls: "bg-error-light text-error-foreground", e: "🔴" },
    new: { cls: "bg-info-light text-info-foreground", e: "🔵" },
    info: { cls: "bg-brand-light text-brand", e: emoji ?? "•" },
  };
  const v = map[variant ?? "info"] ?? map.info;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap",
        v.cls
      )}
    >
      <span>{v.e}</span> {label}
    </span>
  );
}

// ─── Coach Advice Box ────────────────────────────────────────────────────────
export function CoachAdviceBox({
  advice,
  onTryBetter,
}: {
  advice: string;
  onTryBetter?: () => void;
}) {
  return (
    <div className="bg-gray-100 dark:bg-slate-700/40 rounded-lg p-4 mt-3">
      <div className="flex items-start gap-2">
        <span className="text-xl">🧠</span>
        <div className="flex-1">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Coach&apos;s Advice
          </div>
          <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed">{advice}</p>
          {onTryBetter && (
            <button
              onClick={onTryBetter}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-dark transition-colors"
            >
              ✨ Try a Better Version →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Reality Check ROI Box ───────────────────────────────────────────────────
export function RealityCheckRoi({
  audienceCount,
  offerText,
  estimatedRevenue,
  tagline,
}: {
  audienceCount: number;
  offerText: string;
  estimatedRevenue: number;
  tagline?: string;
}) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 my-4">
      <div className="flex items-center gap-2 font-bold text-amber-800 mb-2">
        <span className="text-lg">💡</span> Before You Send
      </div>
      <p className="text-sm text-amber-900/80 mb-3">
        You&apos;re sending this to <strong>{audienceCount}</strong> customers.
        {offerText ? ` Offer: ${offerText}.` : ""}
      </p>
      <p className="text-sm text-amber-900/80 mb-1">
        If {Math.max(1, Math.round(audienceCount * 0.25))} show up and each spends R120:
      </p>
      <div className="text-3xl font-black text-green-600">
        R{estimatedRevenue.toLocaleString()} <span className="text-sm font-medium text-gray-500">extra revenue</span>
      </div>
      <p className="text-sm italic text-gray-500 mt-2">
        {tagline ?? "An empty chair earns R0. A discounted service is still profit."}
      </p>
    </div>
  );
}

// ─── Section Heading ─────────────────────────────────────────────────────────
export function SectionHeading({
  emoji,
  title,
  subtitle,
  action,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
          {emoji && <span>{emoji}</span>}
          {title}
        </h2>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({
  emoji,
  title,
  message,
  action,
}: {
  emoji: string;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-5xl mb-3">{emoji}</div>
      <h3 className="text-lg font-bold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">{message}</p>
      {action}
    </div>
  );
}
