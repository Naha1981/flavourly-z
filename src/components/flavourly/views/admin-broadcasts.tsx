"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionHeading, EmptyState } from "@/components/flavourly/primitives";
import {
  INDUSTRY_LABELS,
  INDUSTRY_EMOJI,
  timeAgo,
  substituteVars,
} from "@/lib/flavourly";
import { Send, RefreshCw, Radio, MessageSquare } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface BroadcastLog {
  id: string;
  targetIndustry: string;
  messagePreview: string;
  recipientCount: number;
  deliveredCount: number;
  sentBy: string;
  createdAt: string;
}

type IndustryFilter =
  | "all"
  | "restaurant"
  | "cafe"
  | "carwash"
  | "salon"
  | "barber"
  | "retail";

const INDUSTRY_FILTERS: { key: IndustryFilter; label: string; emoji: string }[] = [
  { key: "all", label: "All Industries", emoji: "🌐" },
  { key: "restaurant", label: "Restaurant", emoji: "🍽️" },
  { key: "cafe", label: "Café", emoji: "☕" },
  { key: "carwash", label: "Car Wash", emoji: "🚗" },
  { key: "salon", label: "Salon", emoji: "💅" },
  { key: "barber", label: "Barber", emoji: "💈" },
  { key: "retail", label: "Retail", emoji: "🛍️" },
];

const SAMPLE_TENANT = {
  business_name: "Mike's Car Wash",
  owner_name: "Mike",
  currency_name: "Washes",
};

// ─── Main view ───────────────────────────────────────────────────────────────
export function AdminBroadcasts() {
  const [logs, setLogs] = useState<BroadcastLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [industryFilter, setIndustryFilter] = useState<IndustryFilter>("all");
  const [message, setMessage] = useState(
    "👋 Hi {{owner_name}}! Quiet day ahead at {{business_name}}? Today only — earn DOUBLE {{currency_name}} on every visit. Walk-ins welcome! 🚀"
  );
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/broadcasts");
      const data = await res.json();
      setLogs(data.logs ?? []);
    } catch {
      toast.error("Failed to load broadcast history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const previewMessage = useMemo(
    () => substituteVars(message, SAMPLE_TENANT),
    [message]
  );

  const industryLabel = useMemo(() => {
    const f = INDUSTRY_FILTERS.find((i) => i.key === industryFilter);
    return f ? `${f.emoji} ${f.label}` : "All";
  }, [industryFilter]);

  const send = async () => {
    if (!message.trim()) {
      toast.error("Message is empty");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industryFilter, messageTemplate: message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Send failed");
      if (data.sent === 0) {
        toast.info("📡 No recipients matched", {
          description: data.message ?? "No active/trial tenants match this filter.",
        });
      } else {
        toast.success("📡 Broadcast sent!", {
          description: `Delivered to ${data.sent} active tenant${data.sent === 1 ? "" : "s"}.`,
        });
      }
      await load();
    } catch (e) {
      toast.error("Broadcast failed", { description: (e as Error).message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-6xl mx-auto">
      <SectionHeading
        emoji="📡"
        title="Platform Broadcasts"
        subtitle="Send a message to all active tenants, filtered by industry."
        action={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
          </Button>
        }
      />

      {/* Composer */}
      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-brand" />
          <h3 className="font-semibold text-sm">Compose Broadcast</h3>
        </div>

        {/* Target audience */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Target Industry
            </Label>
            <Select value={industryFilter} onValueChange={(v) => setIndustryFilter(v as IndustryFilter)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRY_FILTERS.map((f) => (
                  <SelectItem key={f.key} value={f.key}>
                    {f.emoji} {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex flex-col justify-end">
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-2.5">
              📨 Sends to all <strong className="text-foreground">active/trial</strong> tenants
              with WhatsApp connected.
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Message
            </Label>
            <span className="text-[10px] text-muted-foreground font-mono">
              {message.length} chars
            </span>
          </div>
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-2 py-1.5 flex flex-wrap items-center gap-1.5">
            <span className="font-semibold">Variables:</span>
            {["{{business_name}}", "{{owner_name}}", "{{currency_name}}"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMessage((m) => `${m} ${v}`)}
                className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-brand-light text-brand hover:bg-brand/20 transition-colors"
              >
                {v}
              </button>
            ))}
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Type your broadcast message here…"
          />
        </div>

        {/* Live preview */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Live Preview
          </Label>
          <div className="bg-background border border-border rounded-lg p-4">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-light text-brand flex items-center justify-center shrink-0 text-sm">
                📡
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Flavourly OS → {SAMPLE_TENANT.business_name}
                </div>
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {previewMessage || (
                    <span className="text-muted-foreground italic">Your message preview…</span>
                  )}
                </p>
                <div className="text-[10px] text-muted-foreground mt-2">
                  Sample: {SAMPLE_TENANT.business_name} · {SAMPLE_TENANT.owner_name} ·{" "}
                  {SAMPLE_TENANT.currency_name}
                </div>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs text-muted-foreground">
            Targeting: <span className="font-semibold text-foreground">{industryLabel}</span>
          </div>
          <Button
            onClick={send}
            disabled={sending || !message.trim()}
            className="bg-brand text-white hover:bg-brand-dark"
          >
            {sending ? (
              <>
                <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-1.5" /> Send Broadcast
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* History */}
      <div>
        <SectionHeading
          emoji="📜"
          title="Broadcast History"
          subtitle="Recent platform-wide sends"
        />
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <EmptyState
              emoji="📜"
              title="No broadcasts sent yet"
              message="Your first platform broadcast will be logged here for posterity."
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sent</TableHead>
                      <TableHead>Target</TableHead>
                      <TableHead className="text-right">Audience</TableHead>
                      <TableHead className="text-right">Delivered</TableHead>
                      <TableHead>Message Preview</TableHead>
                      <TableHead>Sent By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {timeAgo(log.createdAt)}
                        </TableCell>
                        <TableCell>
                          <TargetBadge target={log.targetIndustry} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {log.recipientCount}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          <span className="text-success-foreground font-semibold">
                            {log.deliveredCount}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-md">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MessageSquare className="w-3 h-3 shrink-0" />
                            <span className="truncate">{log.messagePreview}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.sentBy}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ul className="md:hidden divide-y divide-border max-h-96 overflow-y-auto scroll-area-thin">
                {logs.map((log) => (
                  <li key={log.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <TargetBadge target={log.targetIndustry} />
                      <span className="text-xs text-muted-foreground shrink-0">
                        {timeAgo(log.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MessageSquare className="w-3 h-3 shrink-0" />
                      <span className="line-clamp-2">{log.messagePreview}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-muted-foreground">
                        Audience:{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {log.recipientCount}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Delivered:{" "}
                        <span className="font-mono font-semibold text-success-foreground">
                          {log.deliveredCount}
                        </span>
                      </span>
                      <span className="text-muted-foreground ml-auto">by {log.sentBy}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function TargetBadge({ target }: { target: string }) {
  if (target === "all") {
    return (
      <Badge variant="outline" className="font-normal gap-1">
        🌐 All Industries
      </Badge>
    );
  }
  const emoji = INDUSTRY_EMOJI[target] ?? "🏪";
  const label = INDUSTRY_LABELS[target] ?? target;
  return (
    <Badge variant="outline" className="font-normal gap-1">
      {emoji} {label}
    </Badge>
  );
}
