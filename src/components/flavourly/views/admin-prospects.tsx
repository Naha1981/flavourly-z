"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Card,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  StatCard,
  SectionHeading,
  EmptyState,
} from "@/components/flavourly/primitives";
import {
  INDUSTRY_LABELS,
  INDUSTRY_EMOJI,
  INDUSTRY_CURRENCY,
  formatPhone,
  timeAgo,
} from "@/lib/flavourly";
import { useFlavourly } from "@/lib/store";
import {
  Upload,
  MoreVertical,
  ExternalLink,
  Send,
  Copy,
  Eye,
  RefreshCw,
  X,
  ChevronRight,
  ChevronLeft,
  FileUp,
  Sparkles,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Prospect {
  id: string;
  businessName: string;
  ownerName: string | null;
  phoneNumber: string;
  location: string | null;
  industry: string;
  industryLabel: string;
  status: "new" | "invited" | "claimed" | "active";
  claimToken: string | null;
  claimUrl: string | null;
  tenantStatus: string | null;
  inviteSentAt: string | null;
  createdAt: string;
}

type StatusFilter = "all" | "new" | "invited" | "claimed" | "active";
type IndustryKey = "restaurant" | "cafe" | "carwash" | "salon" | "barber" | "retail";

const STATUS_CHIPS: { key: StatusFilter; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "📋" },
  { key: "new", label: "New", emoji: "🆕" },
  { key: "invited", label: "Invited", emoji: "📨" },
  { key: "claimed", label: "Claimed", emoji: "✅" },
  { key: "active", label: "Active", emoji: "🟢" },
];

const INDUSTRY_KEYS = Object.keys(INDUSTRY_LABELS) as IndustryKey[];

// ─── Status badge (custom — avoids info-blue) ───────────────────────────────
function ProspectStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; emoji: string; label: string }> = {
    new: { cls: "bg-muted text-muted-foreground", emoji: "🆕", label: "New" },
    invited: { cls: "bg-brand-light text-brand", emoji: "📨", label: "Invited" },
    claimed: { cls: "bg-warning-light text-warning-foreground", emoji: "✅", label: "Claimed" },
    active: { cls: "bg-success-light text-success-foreground", emoji: "🟢", label: "Active" },
  };
  const v = map[status] ?? map.new;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${v.cls}`}
    >
      <span>{v.emoji}</span> {v.label}
    </span>
  );
}

// ─── Main view ───────────────────────────────────────────────────────────────
export function AdminProspects() {
  const { openPublic } = useFlavourly();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (industryFilter !== "all") params.set("industry", industryFilter);
    try {
      const res = await fetch(`/api/prospects?${params.toString()}`);
      const data = await res.json();
      setProspects(data.prospects ?? []);
    } catch {
      toast.error("Failed to load prospects");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, industryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Clear selection when filters change
  useEffect(() => {
    setSelected(new Set());
  }, [statusFilter, industryFilter]);

  const [counts, setCounts] = useState<{ total: number; invited: number; claimedActive: number }>({
    total: 0,
    invited: 0,
    claimedActive: 0,
  });

  // Load unfiltered counts once and after sends/uploads
  const loadCounts = useCallback(async () => {
    try {
      const [all, invited, claimed, active] = await Promise.all([
        fetch("/api/prospects").then((r) => r.json()),
        fetch("/api/prospects?status=invited").then((r) => r.json()),
        fetch("/api/prospects?status=claimed").then((r) => r.json()),
        fetch("/api/prospects?status=active").then((r) => r.json()),
      ]);
      setCounts({
        total: all.prospects?.length ?? 0,
        invited: invited.prospects?.length ?? 0,
        claimedActive: (claimed.prospects?.length ?? 0) + (active.prospects?.length ?? 0),
      });
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      if (prev.size === prospects.length) return new Set();
      return new Set(prospects.map((p) => p.id));
    });
  };

  const sendInvites = async (ids: string[]) => {
    if (!ids.length) return;
    setInviting(true);
    try {
      const res = await fetch("/api/prospects/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prospectIds: ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`📨 Invites sent to ${data.sent} prospects`, {
        description: data.failed ? `${data.failed} failed` : undefined,
      });
      setSelected(new Set());
      await Promise.all([load(), loadCounts()]);
    } catch (e) {
      toast.error("Invite failed", { description: (e as Error).message });
    } finally {
      setInviting(false);
    }
  };

  const copyClaimUrl = (p: Prospect) => {
    if (!p.claimUrl) {
      toast.error("No claim URL available");
      return;
    }
    const url = `${window.location.origin}${p.claimUrl}`;
    navigator.clipboard?.writeText(url);
    toast.success("Claim URL copied", { description: p.businessName });
  };

  // ─── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-28">
      <SectionHeading
        emoji="🎯"
        title="Prospect CRM"
        subtitle="Ghost-built dashboards ready to claim. Send invites to fill the pipeline."
        action={
          <Button onClick={() => setUploadOpen(true)} className="bg-brand text-white hover:bg-brand-dark">
            <Upload className="w-4 h-4 mr-1.5" /> Upload Leads
          </Button>
        }
      />

      {/* Stat row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <StatCard emoji="📋" value={counts.total} label="Total Prospects" subtext="Across all industries" variant="brand" />
        <StatCard emoji="📨" value={counts.invited} label="Invited" subtext="Awaiting claim" variant="brand" />
        <StatCard emoji="✅" value={counts.claimedActive} label="Claimed / Active" subtext="Converted to tenants" variant="brand" />
      </div>

      {/* Filter row */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-1.5 flex-1">
            {STATUS_CHIPS.map((chip) => {
              const active = statusFilter === chip.key;
              return (
                <button
                  key={chip.key}
                  onClick={() => setStatusFilter(chip.key)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    active
                      ? "bg-brand text-white"
                      : "bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                  }`}
                >
                  <span>{chip.emoji}</span> {chip.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Label className="text-xs text-muted-foreground hidden sm:block">Industry</Label>
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger size="sm" className="w-[160px]">
                <SelectValue placeholder="All industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All industries</SelectItem>
                {INDUSTRY_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {INDUSTRY_EMOJI[k]} {INDUSTRY_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={load} title="Refresh">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Prospects table / cards */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-lg" />
            ))}
          </div>
        ) : prospects.length === 0 ? (
          <EmptyState
            emoji="🎯"
            title="No prospects yet"
            message="Upload a CSV of local businesses to start building ghost dashboards for them."
            action={
              <Button onClick={() => setUploadOpen(true)} className="bg-brand text-white hover:bg-brand-dark">
                <Upload className="w-4 h-4 mr-1.5" /> Upload Leads
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={prospects.length > 0 && selected.size === prospects.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Business</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Industry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospects.map((p) => (
                    <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.has(p.id)}
                          onCheckedChange={() => toggleSelect(p.id)}
                          aria-label={`Select ${p.businessName}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <span>{INDUSTRY_EMOJI[p.industry] ?? "🏪"}</span>
                          {p.businessName}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.ownerName ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{formatPhone(p.phoneNumber)}</TableCell>
                      <TableCell className="text-muted-foreground">{p.location ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {INDUSTRY_LABELS[p.industry] ?? p.industry}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ProspectStatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(p.createdAt)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuLabel className="text-xs text-muted-foreground">
                              {p.businessName}
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={!p.claimToken}
                              onClick={() => p.claimToken && openPublic("claim", { token: p.claimToken })}
                            >
                              <Eye className="w-3.5 h-3.5 mr-2" /> View Claim Page
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={p.status === "claimed" || p.status === "active"}
                              onClick={() => sendInvites([p.id])}
                            >
                              <Send className="w-3.5 h-3.5 mr-2" /> Send Invite
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!p.claimUrl} onClick={() => copyClaimUrl(p)}>
                              <Copy className="w-3.5 h-3.5 mr-2" /> Copy Claim URL
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile cards */}
            <ul className="md:hidden divide-y divide-border max-h-[32rem] overflow-y-auto scroll-area-thin">
              {prospects.map((p) => (
                <li key={p.id} className="p-4 flex gap-3">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggleSelect(p.id)}
                    aria-label={`Select ${p.businessName}`}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold flex items-center gap-1.5 truncate">
                          <span>{INDUSTRY_EMOJI[p.industry] ?? "🏪"}</span>
                          <span className="truncate">{p.businessName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.ownerName ? `${p.ownerName} · ` : ""}
                          {formatPhone(p.phoneNumber)}
                        </div>
                        {p.location && (
                          <div className="text-xs text-muted-foreground mt-0.5">📍 {p.location}</div>
                        )}
                      </div>
                      <ProspectStatusBadge status={p.status} />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-muted-foreground">{timeAgo(p.createdAt)}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 px-2">
                            <MoreVertical className="w-3.5 h-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem
                            disabled={!p.claimToken}
                            onClick={() => p.claimToken && openPublic("claim", { token: p.claimToken })}
                          >
                            <Eye className="w-3.5 h-3.5 mr-2" /> View Claim Page
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={p.status === "claimed" || p.status === "active"}
                            onClick={() => sendInvites([p.id])}
                          >
                            <Send className="w-3.5 h-3.5 mr-2" /> Send Invite
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={!p.claimUrl} onClick={() => copyClaimUrl(p)}>
                            <Copy className="w-3.5 h-3.5 mr-2" /> Copy Claim URL
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* Ghost tenant note */}
      <Card className="p-4 bg-muted/40 border-dashed">
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <span className="text-lg shrink-0">👻</span>
          <p>
            Each prospect gets a <strong className="text-foreground">ghost tenant</strong> with a unique{" "}
            <code className="px-1 py-0.5 rounded bg-muted text-xs">claim_token</code>. The invite message
            links to <code className="px-1 py-0.5 rounded bg-muted text-xs">/claim/&#123;token&#125;</code>{" "}
            — when the owner opens it, they instantly take ownership of a ready-to-go 14-day trial dashboard.
          </p>
        </div>
      </Card>

      {/* Sticky selection action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-md">
          <div className="bg-card border border-border shadow-lg rounded-xl p-3 flex items-center gap-3">
            <span className="text-sm font-semibold flex-1">
              <span className="text-brand">{selected.size}</span> selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              className="h-8"
            >
              <X className="w-3.5 h-3.5 mr-1" /> Clear
            </Button>
            <Button
              onClick={() => sendInvites(Array.from(selected))}
              disabled={inviting}
              className="bg-brand text-white hover:bg-brand-dark h-8"
              size="sm"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {inviting ? "Sending…" : `📨 Send WhatsApp Invite to ${selected.size}`}
            </Button>
          </div>
        </div>
      )}

      {/* Upload Leads modal */}
      <UploadLeadsDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onCreated={() => {
          load();
          loadCounts();
        }}
      />
    </div>
  );
}

// ─── Upload Leads Dialog (4 steps) ───────────────────────────────────────────
type Step = 0 | 1 | 2 | 3;
const TARGET_FIELDS = [
  { key: "business_name", label: "Business Name" },
  { key: "owner_name", label: "Owner Name" },
  { key: "phone_number", label: "Phone Number" },
  { key: "location", label: "Location" },
] as const;

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        cur.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (field || cur.length) {
          cur.push(field);
          rows.push(cur);
          cur = [];
          field = "";
        }
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else {
        field += c;
      }
    }
  }
  if (field || cur.length) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function guessColumn(headers: string[], target: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_\-().]/g, "");
  const targetVariants: Record<string, string[]> = {
    business_name: ["businessname", "business", "shop", "company", "name", "store"],
    owner_name: ["ownername", "owner", "manager", "contactname", "contact", "proprietor"],
    phone_number: ["phonenumber", "phone", "mobile", "cell", "whatsapp", "number", "tel"],
    location: ["location", "address", "area", "suburb", "city", "town"],
  };
  const candidates = targetVariants[target] ?? [];
  const normed = headers.map(norm);
  // exact match first
  for (const cand of candidates) {
    const idx = normed.indexOf(cand);
    if (idx >= 0) return headers[idx];
  }
  // contains match
  for (const cand of candidates) {
    const idx = normed.findIndex((h) => h.includes(cand));
    if (idx >= 0) return headers[idx];
  }
  return "__none__";
}

function UploadLeadsDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [step, setStep] = useState<Step>(0);
  const [industry, setIndustry] = useState<string>("");
  const [pasteText, setPasteText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({
    business_name: "__none__",
    owner_name: "__none__",
    phone_number: "__none__",
    location: "__none__",
  });
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(0);
      setIndustry("");
      setPasteText("");
      setFileName(null);
      setParsedRows([]);
      setHeaders([]);
      setMapping({
        business_name: "__none__",
        owner_name: "__none__",
        phone_number: "__none__",
        location: "__none__",
      });
      setSubmitting(false);
      setProgress(0);
    }
  }, [open]);

  // Re-parse when paste text changes
  useEffect(() => {
    if (!pasteText.trim()) {
      setParsedRows([]);
      setHeaders([]);
      return;
    }
    const rows = parseCSV(pasteText);
    if (rows.length) {
      setHeaders(rows[0].map((h, i) => h.trim() || `Column ${i + 1}`));
      setParsedRows(rows.slice(1));
    } else {
      setHeaders([]);
      setParsedRows([]);
    }
  }, [pasteText]);

  // Auto-guess mapping whenever headers change
  useEffect(() => {
    if (headers.length === 0) return;
    setMapping({
      business_name: guessColumn(headers, "business_name"),
      owner_name: guessColumn(headers, "owner_name"),
      phone_number: guessColumn(headers, "phone_number"),
      location: guessColumn(headers, "location"),
    });
  }, [headers]);

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPasteText(String(reader.result ?? ""));
    };
    reader.readAsText(file);
  };

  const canProceed = {
    0: industry !== "",
    1: parsedRows.length > 0 && headers.length >= 2,
    2: mapping.business_name !== "__none__" && mapping.phone_number !== "__none__",
    3: true,
  } as const;

  const buildPayload = () => {
    const headerIdx: Record<string, number> = {};
    for (const target of TARGET_FIELDS) {
      const colName = mapping[target.key];
      headerIdx[target.key] = colName === "__none__" ? -1 : headers.indexOf(colName);
    }
    return parsedRows
      .map((row) => ({
        businessName: headerIdx.business_name >= 0 ? (row[headerIdx.business_name] ?? "").trim() : "",
        ownerName: headerIdx.owner_name >= 0 ? (row[headerIdx.owner_name] ?? "").trim() : "",
        phoneNumber: headerIdx.phone_number >= 0 ? (row[headerIdx.phone_number] ?? "").trim() : "",
        location: headerIdx.location >= 0 ? (row[headerIdx.location] ?? "").trim() : "",
      }))
      .filter((r) => r.businessName || r.phoneNumber);
  };

  const previewRows = useMemo(() => buildPayload().slice(0, 3), [parsedRows, mapping, headers]);

  const submit = async () => {
    const rows = buildPayload();
    if (!rows.length || !industry) return;
    setSubmitting(true);
    setProgress(15);
    // animate progress while waiting
    const progInterval = setInterval(() => {
      setProgress((p) => (p < 85 ? p + 5 : p));
    }, 120);
    try {
      const res = await fetch("/api/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry, rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setProgress(100);
      toast.success(`🎉 ${data.created} ghost profiles created!`, {
        description: data.skipped ? `${data.skipped} skipped (missing name/phone).` : undefined,
      });
      onCreated();
      onOpenChange(false);
    } catch (e) {
      toast.error("Upload failed", { description: (e as Error).message });
    } finally {
      clearInterval(progInterval);
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scroll-area-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand" /> Upload Leads
          </DialogTitle>
          <DialogDescription>
            Build ghost dashboards for local businesses in bulk. Step {step + 1} of 4.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1.5 py-1">
          {["Industry", "Upload", "Mapping", "Preview"].map((label, i) => (
            <div key={label} className="flex items-center gap-1.5 flex-1">
              <div
                className={`h-1.5 rounded-full flex-1 ${
                  i <= step ? "bg-brand" : "bg-muted"
                }`}
              />
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${
                  i === step ? "text-brand" : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <Separator />

        {/* Step 1 — Industry */}
        {step === 0 && (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-semibold">Select industry</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Every ghost tenant will be pre-configured with this industry's loyalty currency.
              </p>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose an industry…" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRY_KEYS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {INDUSTRY_EMOJI[k]} {INDUSTRY_LABELS[k]} —{" "}
                      <span className="text-muted-foreground">
                        {INDUSTRY_CURRENCY[k]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
              💡 Tip: upload one industry at a time. You can run the wizard again for other industries.
            </div>
          </div>
        )}

        {/* Step 2 — Upload */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-semibold">Paste CSV data</Label>
              <p className="text-xs text-muted-foreground mt-1 mb-2">
                Include a header row. Format:{" "}
                <code className="px-1 py-0.5 rounded bg-muted text-[11px]">
                  business_name,owner_name,phone_number,location
                </code>
              </p>
              <Textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={`business_name,owner_name,phone_number,location\nMike's Car Wash,Mike,0821234567,Rosebank\nMama Nomsa's Kitchen,Nomsa,0712345678,Soweto`}
                className="font-mono text-xs min-h-[160px]"
              />
            </div>

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">OR</span>
              <Separator className="flex-1" />
            </div>

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="w-4 h-4 mr-2" />
                {fileName ? `📄 ${fileName}` : "Choose a .csv file"}
              </Button>
            </div>

            <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
              📞 South African numbers auto-normalised (0XX → 27XX).
            </div>

            {parsedRows.length > 0 && (
              <div className="bg-success-light/30 border border-success/20 rounded-lg p-3 text-sm">
                <span className="font-semibold text-success-foreground">
                  ✓ Parsed {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"}
                </span>{" "}
                <span className="text-muted-foreground">with {headers.length} columns.</span>
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Mapping */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              We auto-detected the columns. Confirm each mapping below.
            </p>
            {TARGET_FIELDS.map((target) => (
              <div key={target.key} className="grid grid-cols-3 items-center gap-3">
                <Label className="text-sm font-semibold">{target.label}</Label>
                <div className="col-span-2">
                  <Select
                    value={mapping[target.key]}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [target.key]: v }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— None —</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
            <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground">
              Required: <strong className="text-foreground">Business Name</strong> and{" "}
              <strong className="text-foreground">Phone Number</strong>. Rows missing either will be skipped.
            </div>
          </div>
        )}

        {/* Step 4 — Preview & Confirm */}
        {step === 3 && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Ready to import</div>
                <div className="text-xs text-muted-foreground">
                  {INDUSTRY_EMOJI[industry as IndustryKey] ?? "🏪"}{" "}
                  {INDUSTRY_LABELS[industry] ?? industry} · {buildPayload().length} rows
                </div>
              </div>
              <Badge variant="outline" className="font-normal">
                <Sparkles className="w-3 h-3 mr-1" /> Ghost profiles
              </Badge>
            </div>

            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Preview (first 3 rows)
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Business</TableHead>
                    <TableHead className="text-xs">Owner</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-xs font-medium">{r.businessName || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.ownerName || "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{r.phoneNumber || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.location || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {previewRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-xs text-muted-foreground text-center py-4">
                        No rows to preview
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {submitting && (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Sparkles className="w-3 h-3 animate-pulse text-brand" />
                  Generating ghost profiles…
                </div>
                <Progress value={progress} className="h-1.5" />
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="flex-row items-center justify-between gap-2 sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (step === 0 ? onOpenChange(false) : setStep((step - 1) as Step))}
            disabled={submitting}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> {step === 0 ? "Cancel" : "Back"}
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((step + 1) as Step)}
              disabled={!canProceed[step]}
              className="bg-brand text-white hover:bg-brand-dark"
              size="sm"
            >
              Next <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={submit}
              disabled={submitting}
              className="bg-brand text-white hover:bg-brand-dark"
              size="sm"
            >
              {submitting ? "Creating…" : `🎉 Create ${buildPayload().length} Ghost Profiles`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
