// Flavourly OS — shared domain helpers

export const INDUSTRY_CURRENCY: Record<string, string> = {
  restaurant: "Points",
  cafe: "Stamps",
  carwash: "Washes",
  salon: "Visits",
  barber: "Cuts",
  retail: "Points",
};

export const INDUSTRY_LABELS: Record<string, string> = {
  restaurant: "Restaurant",
  cafe: "Café",
  carwash: "Car Wash",
  salon: "Salon",
  barber: "Barber",
  retail: "Retail",
};

export const INDUSTRY_EMOJI: Record<string, string> = {
  restaurant: "🍽️",
  cafe: "☕",
  carwash: "🚗",
  salon: "💅",
  barber: "💈",
  retail: "🛍️",
};

export function currencyFor(industry: string): string {
  return INDUSTRY_CURRENCY[industry] ?? "Points";
}

// Churn risk: green <30d, amber 30-60d, red >60d
export type ChurnRisk = "active" | "at_risk" | "dormant";

export function churnRisk(lastVisit: Date | string | null): ChurnRisk {
  if (!lastVisit) return "dormant";
  const d = new Date(lastVisit).getTime();
  const days = (Date.now() - d) / (1000 * 60 * 60 * 24);
  if (days < 30) return "active";
  if (days < 60) return "at_risk";
  return "dormant";
}

export function churnRiskBadge(risk: ChurnRisk) {
  switch (risk) {
    case "active": return { label: "Active", emoji: "🟢", className: "bg-success-light text-success-foreground" };
    case "at_risk": return { label: "At Risk", emoji: "🟡", className: "bg-warning-light text-warning-foreground" };
    case "dormant": return { label: "Dormant", emoji: "🔴", className: "bg-error-light text-error-foreground" };
  }
}

// Haversine distance in metres
export function haversineMeters(
  lat1: number, lng1: number, lat2: number, lng2: number
): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Human-friendly time ago
export function timeAgo(date: Date | string | null): string {
  if (!date) return "—";
  const d = new Date(date).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

// South African phone normalisation
export function normalizeZAPhone(raw: string): string {
  if (!raw) return "";
  const stripped = raw.replace(/[\s\-().+]/g, "");
  if (stripped.startsWith("27") && stripped.length === 11) return stripped;
  if (stripped.startsWith("0") && stripped.length === 10) return "27" + stripped.slice(1);
  if (stripped.length === 9) return "27" + stripped;
  return stripped;
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  if (phone.startsWith("27") && phone.length === 11) {
    return `+27 ${phone.slice(2, 4)} ${phone.slice(4, 7)} ${phone.slice(7)}`;
  }
  return phone;
}

export function waMeUrl(phone: string | null | undefined, text: string): string {
  const clean = phone ?? "";
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Substitute {{customer_name}} {{business_name}} {{currency_name}} etc.
export function substituteVars(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/gi, (_, key) => {
    const k = key.toLowerCase();
    return vars[k] ?? vars[key] ?? `{{${key}}}`;
  });
}

// Rule-based coach advice for underperforming campaigns
export interface CoachAdvice {
  adviceKey: string;
  adviceText: string;
  suggestedTemplate: string;
  suggestedGoal: string;
  suggestedAudience: string;
}

export function buildCoachAdvice(c: {
  redemptionRatePct: number;
  audience: string;
  sentAt: Date | string | null;
  message: string;
}): CoachAdvice {
  const rate = c.redemptionRatePct;
  const audience = c.audience;
  const sentAt = c.sentAt ? new Date(c.sentAt) : null;
  const dayOfWeek = sentAt ? sentAt.getDay() : -1; // 0=Sun, 6=Sat
  const hasFree = /\bfree\b|free\b/i.test(c.message);

  if (rate < 2) {
    return {
      adviceKey: "low_offer",
      adviceText:
        "Your offer might not have been exciting enough. Try 'Free item' or 'Buy 4 get 1 free' — concrete rewards always outperform percentage discounts.",
      suggestedTemplate: "🎁 FLASH SALE: Your next {{currency_name}} is on us — today only! Show this message to claim.",
      suggestedGoal: "quiet_hours",
      suggestedAudience: "inactive",
    };
  }
  if (audience === "all" && rate < 5) {
    return {
      adviceKey: "too_broad",
      adviceText:
        "You sent this to everyone, including regulars who already come back. Next time, target only Inactive Customers — they need a stronger reason to return.",
      suggestedTemplate: "👋 Hi {{customer_name}}, we miss you at {{business_name}}! Come back this week for a FREE {{currency_name}} on us.",
      suggestedGoal: "winback",
      suggestedAudience: "inactive",
    };
  }
  if ((dayOfWeek === 0 || dayOfWeek === 6) && !hasFree) {
    return {
      adviceKey: "weekend_send",
      adviceText:
        "Weekends are already your busiest days. Save your discounts for mid-week (Tuesdays or Wednesdays) when you have empty capacity to fill.",
      suggestedTemplate: "🪑 Flash Tuesday! Beat the rush — your next {{currency_name}} is FREE at {{business_name}}. Today only!",
      suggestedGoal: "quiet_hours",
      suggestedAudience: "all",
    };
  }
  return {
    adviceKey: "generic",
    adviceText:
      "Consider adding a clear expiry (e.g. 'today only' or 'this week') to create urgency. Open-ended offers get lower redemption.",
    suggestedTemplate: "⚡ This week only at {{business_name}}: earn DOUBLE {{currency_name}} on every visit. Don't miss out!",
    suggestedGoal: "general",
    suggestedAudience: "all",
  };
}
