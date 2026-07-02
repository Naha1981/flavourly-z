"use client";

import { Card } from "@/components/ui/card";
import { SectionHeading, EmptyState } from "@/components/flavourly/primitives";
import { useRealtimeActivity, type RealtimeActivity } from "@/hooks/use-realtime";
import { timeAgo } from "@/lib/flavourly";

// Map activity type → emoji (kept in sync with /api/activity route).
function emojiFor(type: string): string {
  switch (type) {
    case "joined":
      return "🎉";
    case "redeemed":
      return "🎁";
    case "earned":
      return "✨";
    case "visit":
      return "👣";
    case "campaign_sent":
      return "📣";
    case "added":
      return "👤";
    default:
      return "•";
  }
}

interface Props {
  tenantId?: string;
}

/**
 * Realtime activity feed — replaces the 15-second polling loop on the dashboard.
 *
 * Connects to the Flavourly realtime mini-service via the gateway
 * (/?XTransformPort=3033). On mount, the service emits the last 20 activities
 * as `activity:initial`; new rows are pushed every ~2s as `activity:new`.
 *
 * The visual treatment matches the dashboard's existing feed (emoji + name +
 * message + relative time) so the lead agent can drop this in as a 1:1 swap.
 */
export function RealtimeActivityFeed({ tenantId }: Props) {
  const { items, connected, usingFallback } = useRealtimeActivity(tenantId);

  return (
    <div>
      <SectionHeading
        emoji="🔴"
        title="Live Activity"
        subtitle="What your customers are doing right now"
        action={<LiveBadge connected={connected} usingFallback={usingFallback} />}
      />
      <Card className="overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            emoji="🦗"
            title="Quiet for now"
            message="Share your QR code or send a promo to get customers joining and earning."
          />
        ) : (
          <ul className="divide-y divide-border max-h-[28rem] overflow-y-auto scroll-area-thin">
            {items.map((a: RealtimeActivity) => (
              <li
                key={a.id}
                className="flex items-center gap-3 px-4 py-3 feed-item-enter"
              >
                <span className="text-xl shrink-0" aria-hidden>
                  {emojiFor(a.type)}
                </span>
                <div className="flex-1 min-w-0 text-sm">
                  <span className="font-semibold">
                    {a.customerName ?? "Someone"}
                  </span>{" "}
                  <span className="text-muted-foreground">{a.message}</span>
                </div>
                <span
                  className="text-xs text-muted-foreground shrink-0"
                  title={new Date(a.createdAt).toLocaleString()}
                >
                  {timeAgo(a.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function LiveBadge({ connected, usingFallback }: { connected: boolean; usingFallback?: boolean }) {
  const isLive = connected || usingFallback;
  return (
    <span
      role="status"
      aria-live="polite"
      className={
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap " +
        (isLive
          ? "bg-success-light text-success-foreground"
          : "bg-error-light text-error-foreground")
      }
    >
      <span
        className={
          "w-2 h-2 rounded-full " +
          (isLive ? "bg-success animate-pulse" : "bg-error")
        }
        aria-hidden
      />
      {connected ? "Live" : usingFallback ? "Live · Polling" : "Disconnected"}
    </span>
  );
}
