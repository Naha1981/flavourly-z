"use client";

import { useCallback, useEffect, useRef, useState, Fragment } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { SectionHeading, EmptyState } from "@/components/flavourly/primitives";
import { formatPhone, timeAgo } from "@/lib/flavourly";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  RotateCw,
  Code2,
  Radio,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface WebhookEvent {
  id: string;
  instanceName: string;
  eventType: string;
  phoneNumber: string | null;
  messageContent: string | null;
  status: string;
  rawPayload: string;
  createdAt: string;
  timeAgo: string;
}

const EVENT_TYPES = [
  { value: "all", label: "All Events" },
  { value: "messages.upsert", label: "messages.upsert" },
  { value: "connection.update", label: "connection.update" },
  { value: "message.sent", label: "message.sent" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All Statuses" },
  { value: "processed", label: "Processed" },
  { value: "error", label: "Error" },
  { value: "ignored", label: "Ignored" },
];

// ─── Status badge ────────────────────────────────────────────────────────────
function EventStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; emoji: string; label: string }> = {
    processed: { cls: "bg-success-light text-success-foreground", emoji: "✓", label: "Processed" },
    error: { cls: "bg-error-light text-error-foreground", emoji: "✕", label: "Error" },
    ignored: { cls: "bg-muted text-muted-foreground", emoji: "—", label: "Ignored" },
  };
  const v = map[status] ?? { cls: "bg-muted text-muted-foreground", emoji: "?", label: status };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${v.cls}`}
    >
      <span>{v.emoji}</span> {v.label}
    </span>
  );
}

function EventTypeBadge({ type }: { type: string }) {
  const isMessage = type === "messages.upsert";
  const isConn = type === "connection.update";
  const isSent = type === "message.sent";
  const cls = isMessage
    ? "bg-brand-light text-brand"
    : isConn
    ? "bg-warning-light text-warning-foreground"
    : isSent
    ? "bg-success-light text-success-foreground"
    : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold whitespace-nowrap ${cls}`}
    >
      {type}
    </span>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────
export function AdminWebhooks() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [instanceFilter, setInstanceFilter] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previewEvent, setPreviewEvent] = useState<WebhookEvent | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const lastLenRef = useRef(0);

  const load = useCallback(
    async (silent = false) => {
      try {
        const params = new URLSearchParams({ limit: "100" });
        if (instanceFilter.trim()) params.set("instance", instanceFilter.trim());
        if (eventTypeFilter !== "all") params.set("eventType", eventTypeFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);
        const res = await fetch(`/api/webhooks?${params.toString()}`);
        const data = await res.json();
        const evs: WebhookEvent[] = data.events ?? [];
        // Tiny pulse if new events arrived
        if (!silent && evs.length > lastLenRef.current) {
          // skip first load
        }
        lastLenRef.current = evs.length;
        setEvents(evs);
        setLastUpdated(new Date());
      } catch {
        if (!silent) toast.error("Failed to load webhook events");
      } finally {
        setLoading(false);
      }
    },
    [instanceFilter, eventTypeFilter, statusFilter]
  );

  // Initial + filter-driven load
  useEffect(() => {
    setLoading(true);
    lastLenRef.current = 0;
    load();
  }, [load]);

  // Auto-refresh every 5s (silent)
  useEffect(() => {
    const interval = setInterval(() => load(true), 5000);
    return () => clearInterval(interval);
  }, [load]);

  const retry = async (ev: WebhookEvent) => {
    setRetryingId(ev.id);
    try {
      const payload = JSON.parse(ev.rawPayload);
      const res = await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Retry failed");
      }
      toast.success("🔄 Retried", {
        description: `Re-queued event: ${ev.eventType}`,
      });
      await load(true);
    } catch (e) {
      // rawPayload may not be a valid Evolution payload — fall back to toast
      toast.error("Couldn't retry", {
        description: (e as Error).message,
      });
    } finally {
      setRetryingId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <SectionHeading
        emoji="🔗"
        title="Webhook Events Log"
        subtitle="Every inbound Evolution API event, in real time."
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-success-foreground bg-success-light/60 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              🟢 Live
            </span>
            <Button variant="outline" size="sm" onClick={() => load()}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Refresh
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Instance
            </Label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={instanceFilter}
                onChange={(e) => setInstanceFilter(e.target.value)}
                placeholder="Search instance name…"
                className="pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Event Type
            </Label>
            <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Status
            </Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
          <Radio className="w-3 h-3" />
          Auto-refreshes every 5s · Last updated {timeAgo(lastUpdated)}
        </div>
      </Card>

      {/* Events table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            emoji="🔗"
            title="No webhook events yet"
            message="Inbound WhatsApp events will appear here in real time."
          />
        ) : (
          <div className="max-h-[32rem] overflow-y-auto scroll-area-thin">
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Instance</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((ev) => {
                    const expanded = expandedId === ev.id;
                    const canRetry = ev.status === "error";
                    return (
                      <Fragment key={ev.id}>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/40"
                          onClick={() => setExpandedId(expanded ? null : ev.id)}
                        >
                          <TableCell className="text-muted-foreground">
                            {expanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={new Date(ev.createdAt).toLocaleString()}>
                            {ev.timeAgo}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{ev.instanceName}</TableCell>
                          <TableCell>
                            <EventTypeBadge type={ev.eventType} />
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {ev.phoneNumber ? formatPhone(ev.phoneNumber) : "—"}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            {ev.messageContent ? (
                              <code className="text-[11px] text-muted-foreground truncate block">
                                {ev.messageContent}
                              </code>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <EventStatusBadge status={ev.status} />
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="View raw payload"
                                onClick={() => setPreviewEvent(ev)}
                              >
                                <Code2 className="w-3.5 h-3.5" />
                              </Button>
                              {canRetry && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title="Retry"
                                  disabled={retryingId === ev.id}
                                  onClick={() => retry(ev)}
                                >
                                  <RotateCw
                                    className={`w-3.5 h-3.5 ${
                                      retryingId === ev.id ? "animate-spin" : ""
                                    }`}
                                  />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {expanded && (
                          <TableRow className="bg-muted/20">
                            <TableCell colSpan={8} className="p-3">
                              <pre className="text-[11px] font-mono whitespace-pre-wrap break-all bg-background border border-border rounded-md p-3 max-h-48 overflow-y-auto scroll-area-thin">
                                {prettyJson(ev.rawPayload)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-border">
              {events.map((ev) => {
                const expanded = expandedId === ev.id;
                const canRetry = ev.status === "error";
                return (
                  <li key={ev.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-semibold truncate">
                          {ev.instanceName}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {ev.timeAgo} · {new Date(ev.createdAt).toLocaleString()}
                        </div>
                      </div>
                      <EventStatusBadge status={ev.status} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <EventTypeBadge type={ev.eventType} />
                      {ev.phoneNumber && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {formatPhone(ev.phoneNumber)}
                        </span>
                      )}
                    </div>
                    {ev.messageContent && (
                      <code className="block text-[11px] text-muted-foreground bg-muted/40 rounded px-2 py-1.5 line-clamp-3">
                        {ev.messageContent}
                      </code>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setExpandedId(expanded ? null : ev.id)}
                      >
                        {expanded ? (
                          <>
                            <ChevronUp className="w-3 h-3 mr-1" /> Hide payload
                          </>
                        ) : (
                          <>
                            <Code2 className="w-3 h-3 mr-1" /> Raw payload
                          </>
                        )}
                      </Button>
                      {canRetry && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={retryingId === ev.id}
                          onClick={() => retry(ev)}
                        >
                          <RotateCw
                            className={`w-3 h-3 mr-1 ${retryingId === ev.id ? "animate-spin" : ""}`}
                          />
                          Retry
                        </Button>
                      )}
                    </div>
                    {expanded && (
                      <pre className="text-[11px] font-mono whitespace-pre-wrap break-all bg-background border border-border rounded-md p-3 max-h-48 overflow-y-auto scroll-area-thin">
                        {prettyJson(ev.rawPayload)}
                      </pre>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </Card>

      {/* Raw payload dialog */}
      <Dialog open={!!previewEvent} onOpenChange={(v) => !v && setPreviewEvent(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto scroll-area-thin">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="w-4 h-4 text-brand" /> Raw Webhook Payload
            </DialogTitle>
            <DialogDescription>
              {previewEvent ? (
                <span className="flex items-center gap-2 flex-wrap">
                  <EventTypeBadge type={previewEvent.eventType} />
                  <span className="font-mono text-xs">{previewEvent.instanceName}</span>
                  <span className="text-xs">{previewEvent.timeAgo}</span>
                </span>
              ) : (
                ""
              )}
            </DialogDescription>
          </DialogHeader>
          {previewEvent && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/40 rounded-md p-2">
                  <div className="text-muted-foreground uppercase tracking-wide text-[10px]">
                    Phone
                  </div>
                  <div className="font-mono">
                    {previewEvent.phoneNumber ? formatPhone(previewEvent.phoneNumber) : "—"}
                  </div>
                </div>
                <div className="bg-muted/40 rounded-md p-2">
                  <div className="text-muted-foreground uppercase tracking-wide text-[10px]">
                    Status
                  </div>
                  <div>
                    <EventStatusBadge status={previewEvent.status} />
                  </div>
                </div>
              </div>
              {previewEvent.messageContent && (
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Message
                  </div>
                  <code className="block text-xs bg-muted/40 rounded-md p-2.5 whitespace-pre-wrap break-all">
                    {previewEvent.messageContent}
                  </code>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Raw Payload
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      navigator.clipboard?.writeText(previewEvent.rawPayload);
                      toast.success("Payload copied");
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <pre className="text-[11px] font-mono whitespace-pre-wrap break-all bg-background border border-border rounded-md p-3 max-h-64 overflow-y-auto scroll-area-thin">
                  {prettyJson(previewEvent.rawPayload)}
                </pre>
              </div>
              {previewEvent.status === "error" && (
                <Button
                  onClick={() => {
                    void retry(previewEvent);
                    setPreviewEvent(null);
                  }}
                  disabled={retryingId === previewEvent.id}
                  className="bg-brand text-white hover:bg-brand-dark w-full"
                >
                  <RotateCw
                    className={`w-4 h-4 mr-1.5 ${retryingId === previewEvent.id ? "animate-spin" : ""}`}
                  />
                  Retry Event
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function prettyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
