"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Plus,
  Minus,
  Search,
  UserPlus,
  RefreshCw,
  Phone,
  Calendar,
  History,
  Sparkles,
  Footprints,
} from "lucide-react";
import {
  StatusBadge,
  SectionHeading,
  EmptyState,
} from "@/components/flavourly/primitives";
import {
  formatPhone,
  timeAgo,
  normalizeZAPhone,
  type ChurnRisk,
} from "@/lib/flavourly";

interface Tenant {
  id: string;
  name: string;
  industry: string;
  industryLabel: string;
  currencyName: string;
  brandColor: string;
  customerCount: number;
  welcomePoints: number;
  rewardThreshold: number;
}

interface CustomerListItem {
  id: string;
  phoneNumber: string;
  name: string | null;
  points: number;
  visits: number;
  lastVisit: string | null;
  joinedAt: string;
  optedIn: boolean;
  churnRisk: ChurnRisk;
}

interface LoyaltyTx {
  id: string;
  pointsChange: number;
  reason: string;
  note: string | null;
  createdAt: string;
}

interface CustomerDetail extends CustomerListItem {
  transactions: LoyaltyTx[];
}

type FilterKey = "all" | "active" | "at_risk" | "vip" | "new";
type SortKey = "recent" | "name" | "points" | "visits";

const FILTERS: { key: FilterKey; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "👥" },
  { key: "active", label: "Active", emoji: "🟢" },
  { key: "at_risk", label: "At-Risk", emoji: "🟡" },
  { key: "vip", label: "VIP", emoji: "⭐" },
  { key: "new", label: "New", emoji: "✨" },
];

const REASON_OPTIONS = [
  { value: "manual_staff", label: "👍 Staff Adjustment" },
  { value: "visit", label: "👣 Visit" },
  { value: "redemption", label: "🎁 Reward Redeemed" },
  { value: "promotion", label: "⚡ Promo Bonus" },
  { value: "correction", label: "🛠️ Correction" },
];

function reasonLabel(r: string): string {
  return REASON_OPTIONS.find((o) => o.value === r)?.label ?? r;
}

export function CustomersView({ tenant }: { tenant: Tenant | null }) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [filterCounts, setFilterCounts] = useState<Record<FilterKey, number>>({
    all: 0,
    active: 0,
    at_risk: 0,
    vip: 0,
    new: 0,
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const loadCounts = useCallback(async () => {
    try {
      const results = await Promise.all(
        FILTERS.map((f) =>
          fetch(`/api/customers?filter=${f.key}&sort=recent`).then((r) =>
            r.json()
          )
        )
      );
      const next = { all: 0, active: 0, at_risk: 0, vip: 0, new: 0 } as Record<
        FilterKey,
        number
      >;
      FILTERS.forEach((f, i) => {
        next[f.key] = results[i]?.count ?? 0;
      });
      setFilterCounts(next);
    } catch {
      // ignore — non-fatal
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("filter", filter);
    params.set("sort", sort);
    if (debouncedQ) params.set("q", debouncedQ);
    try {
      const res = await fetch(`/api/customers?${params.toString()}`);
      const json = await res.json();
      setCustomers(json.customers ?? []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [filter, sort, debouncedQ]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const refreshAll = useCallback(() => {
    load();
    loadCounts();
  }, [load, loadCounts]);

  const currency = tenant?.currencyName ?? "Points";

  // ── Quick award (used by row + card popover) ─────────────────────────────
  const quickAward = useCallback(
    async (c: CustomerListItem, amount: number) => {
      const res = await fetch(`/api/customers/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointsChange: amount, reason: "manual_staff" }),
      });
      if (!res.ok) {
        toast.error("Couldn't update points", {
          description: "Please try again in a moment.",
        });
        return;
      }
      toast.success(
        amount > 0
          ? `🎉 Awarded ${amount} ${currency}!`
          : `✅ Removed ${Math.abs(amount)} ${currency}`,
        {
          description: `Updated balance for ${c.name ?? formatPhone(c.phoneNumber)}.`,
        }
      );
      refreshAll();
    },
    [currency, refreshAll]
  );

  // ── Add customer ─────────────────────────────────────────────────────────
  const handleAdd = async (phone: string, name: string) => {
    const normalized = normalizeZAPhone(phone);
    if (!normalized) {
      toast.error("Phone number required", {
        description: "Enter a valid SA mobile, e.g. 083 555 0001.",
      });
      return false;
    }
    const res = await fetch("/api/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: normalized, name: name.trim() || undefined }),
    });
    if (res.status === 409) {
      toast.error("That customer already exists", {
        description: "Search for their phone number to view their profile.",
      });
      return false;
    }
    if (!res.ok) {
      toast.error("Couldn't add customer", {
        description: "Please try again.",
      });
      return false;
    }
    toast.success("🎉 Customer added!", {
      description: "Welcome message sent on WhatsApp.",
    });
    setAddOpen(false);
    refreshAll();
    return true;
  };

  const total = tenant?.customerCount ?? filterCounts.all;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <SectionHeading
        emoji="👥"
        title="Your Customers"
        subtitle="Everyone who's joined your loyalty programme."
        action={
          <Button onClick={() => setAddOpen(true)} className="bg-brand hover:bg-brand-dark text-white">
            <UserPlus className="w-4 h-4 mr-1.5" /> Add Customer
          </Button>
        }
      />

      {/* Filter chips + search + sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={[
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold transition-colors min-h-[36px]",
                  active
                    ? "bg-brand text-white shadow-sm"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-brand/40 hover:text-brand",
                ].join(" ")}
                aria-pressed={active}
              >
                <span>{f.emoji}</span>
                <span>{f.label}</span>
                <span
                  className={[
                    "ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
                    active ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500",
                  ].join(" ")}
                >
                  {filterCounts[f.key]}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search name or phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-9 w-full sm:w-56"
              aria-label="Search customers"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Sort customers">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">🕐 Recent visit</SelectItem>
              <SelectItem value="name">🔤 Name A–Z</SelectItem>
              <SelectItem value="points">⭐ Highest balance</SelectItem>
              <SelectItem value="visits">👣 Most visits</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Customer list */}
      {loading ? (
        <Card className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </Card>
      ) : customers.length === 0 ? (
        <Card className="p-2">
          <EmptyState
            emoji="👋"
            title={total === 0 ? "No customers yet" : "No matches found"}
            message={
              total === 0
                ? "Share your QR code or add your first customer by phone number to get started."
                : "Try a different filter or clear your search to see more customers."
            }
            action={
              total === 0 ? (
                <Button
                  className="bg-brand hover:bg-brand-dark text-white"
                  onClick={() => setAddOpen(true)}
                >
                  <UserPlus className="w-4 h-4 mr-1.5" /> Add your first customer
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          {/* DESKTOP TABLE */}
          <Card className="hidden md:block overflow-hidden">
            <div className="max-h-[28rem] overflow-y-auto scroll-area-thin">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10">
                  <TableRow>
                    <TableHead className="pl-4">Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Visits</TableHead>
                    <TableHead>Last Visit</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="text-right pr-4">Quick Award</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer hover:bg-brand-light/40 h-14"
                      onClick={() => setSelectedId(c.id)}
                    >
                      <TableCell className="pl-4 font-semibold">
                        <div className="flex items-center gap-2">
                          <span className="w-8 h-8 rounded-full bg-brand-light text-brand flex items-center justify-center text-sm font-bold shrink-0">
                            {(c.name ?? c.phoneNumber).slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate">{c.name ?? "Unknown"}</div>
                            <div className="text-[11px] text-muted-foreground font-normal">
                              Joined {timeAgo(c.joinedAt)}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">
                        {formatPhone(c.phoneNumber)}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-brand">
                          {c.points}
                        </span>{" "}
                        <span className="text-xs text-muted-foreground">{currency}</span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm">
                          <Footprints className="w-3.5 h-3.5 text-muted-foreground" />
                          {c.visits}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.lastVisit ? timeAgo(c.lastVisit) : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge risk={c.churnRisk} />
                      </TableCell>
                      <TableCell
                        className="text-right pr-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <QuickAwardPopover
                          customer={c}
                          currency={currency}
                          onAward={quickAward}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* MOBILE CARD LIST */}
          <div className="md:hidden space-y-3">
            <div className="max-h-[32rem] overflow-y-auto scroll-area-thin space-y-3 pr-1">
              {customers.map((c) => (
                <Card
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(c.id);
                    }
                  }}
                  className="p-4 cursor-pointer hover:border-brand/40 active:scale-[0.99] transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-10 h-10 rounded-full bg-brand-light text-brand flex items-center justify-center font-bold shrink-0">
                        {(c.name ?? c.phoneNumber).slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold truncate">
                          {c.name ?? "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {formatPhone(c.phoneNumber)}
                        </div>
                      </div>
                    </div>
                    <StatusBadge risk={c.churnRisk} />
                  </div>
                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-black text-brand leading-none">
                        {c.points}
                      </div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">
                        {currency} · {c.visits} visits
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Last visit</div>
                      <div className="text-sm font-semibold">
                        {c.lastVisit ? timeAgo(c.lastVisit) : "Never"}
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <QuickAwardPopover
                        customer={c}
                        currency={currency}
                        onAward={quickAward}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Detail Sheet ──────────────────────────────────────────────────── */}
      <CustomerDetailSheet
        customerId={selectedId}
        onClose={() => setSelectedId(null)}
        currency={currency}
        tenantName={tenant?.name ?? "your business"}
        onMutated={refreshAll}
      />

      {/* ── Add Customer Dialog ───────────────────────────────────────────── */}
      <AddCustomerDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={handleAdd} />
    </div>
  );
}

// ── Quick Award Popover ─────────────────────────────────────────────────────
function QuickAwardPopover({
  customer,
  currency,
  onAward,
}: {
  customer: CustomerListItem;
  currency: string;
  onAward: (c: CustomerListItem, n: number) => void;
}) {
  const [busy, setBusy] = useState<number | null>(null);
  const handle = async (n: number) => {
    setBusy(n);
    try {
      await onAward(customer, n);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hover:bg-brand-light text-brand"
          aria-label="Quick award points"
          title="Quick award"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-52 p-3"
        align="end"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          ⚡ Quick award {currency.toLowerCase()}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 5, 10].map((n) => (
            <Button
              key={n}
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() => handle(n)}
              className="border-brand/30 text-brand hover:bg-brand-light"
            >
              {busy === n ? "…" : `+${n}`}
            </Button>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground mt-2">
          Tap to award instantly. Open the profile to deduct or add a note.
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Customer Detail Sheet ───────────────────────────────────────────────────
function CustomerDetailSheet({
  customerId,
  onClose,
  currency,
  tenantName,
  onMutated,
}: {
  customerId: string | null;
  onClose: () => void;
  currency: string;
  tenantName: string;
  onMutated: () => void;
}) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [customReason, setCustomReason] = useState("manual_staff");
  const [customNote, setCustomNote] = useState("");
  const [busy, setBusy] = useState(false);
  const lastLoadedId = useRef<string | null>(null);

  useEffect(() => {
    if (!customerId) {
      setDetail(null);
      lastLoadedId.current = null;
      return;
    }
    if (customerId === lastLoadedId.current) return;
    setLoading(true);
    setDetail(null);
    fetch(`/api/customers/${customerId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setDetail(j);
        lastLoadedId.current = customerId;
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  const applyDelta = async (delta: number) => {
    if (!customerId || delta === 0) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pointsChange: delta, reason: "manual_staff" }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setDetail((d) => (d ? { ...d, ...updated, transactions: d.transactions } : d));
      toast.success(
        delta > 0
          ? `🎉 Awarded ${delta} ${currency}!`
          : `✅ Removed ${Math.abs(delta)} ${currency}`,
        { description: `New balance: ${updated.points} ${currency}.` }
      );
      onMutated();
      // Refresh the detail to pull the latest transaction
      const fresh = await fetch(`/api/customers/${customerId}`).then((r) => r.json());
      setDetail(fresh);
    } catch {
      toast.error("Couldn't update points", {
        description: "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  const applyCustom = async () => {
    const n = parseInt(customAmount, 10);
    if (!Number.isFinite(n) || n === 0) {
      toast.error("Enter a non-zero amount", {
        description: "Use +5 to award or -3 to deduct.",
      });
      return;
    }
    if (!customerId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pointsChange: n,
          reason: customReason,
          note: customNote.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      toast.success(
        n > 0
          ? `🎉 Awarded ${n} ${currency}!`
          : `✅ Removed ${Math.abs(n)} ${currency}`,
        { description: `New balance: ${updated.points} ${currency}.` }
      );
      setCustomAmount("");
      setCustomNote("");
      onMutated();
      const fresh = await fetch(`/api/customers/${customerId}`).then((r) => r.json());
      setDetail(fresh);
    } catch {
      toast.error("Couldn't update points", {
        description: "Please try again.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={!!customerId}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-y-auto scroll-area-thin"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>👤 Customer Profile</span>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Customer details, loyalty history and point adjustments.
          </SheetDescription>
        </SheetHeader>

        {loading || !detail ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-20 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-48 rounded-xl" />
          </div>
        ) : (
          <div className="px-4 pb-6 space-y-4">
            {/* Header block */}
            <div className="bg-brand-light border border-brand/20 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand text-white flex items-center justify-center text-lg font-black shrink-0">
                  {(detail.name ?? detail.phoneNumber).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-lg leading-tight truncate">
                    {detail.name ?? "Unknown customer"}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {formatPhone(detail.phoneNumber)}
                  </div>
                </div>
                <StatusBadge risk={detail.churnRisk} />
              </div>
            </div>

            {/* Stat row */}
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Balance" value={`${detail.points}`} sub={currency} />
              <MiniStat label="Visits" value={`${detail.visits}`} sub="all-time" />
              <MiniStat
                label="Joined"
                value={timeAgo(detail.joinedAt).replace(" ago", "")}
                sub="ago"
              />
            </div>

            {/* Quick adjust */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand" />
                <h3 className="font-bold text-sm">Adjust Points</h3>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {[1, 5, 10].map((n) => (
                  <Button
                    key={`a${n}`}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => applyDelta(n)}
                    className="border-success/40 text-success hover:bg-success-light"
                  >
                    <Plus className="w-3 h-3 mr-1" /> {n}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 5, 10].map((n) => (
                  <Button
                    key={`d${n}`}
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => applyDelta(-n)}
                    className="border-error/40 text-error hover:bg-error-light"
                  >
                    <Minus className="w-3 h-3 mr-1" /> {n}
                  </Button>
                ))}
              </div>

              <Separator className="my-3" />

              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Custom adjustment
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="number"
                  inputMode="numeric"
                  placeholder="+5 or -3"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-28"
                />
                <Select value={customReason} onValueChange={setCustomReason}>
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REASON_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                placeholder="Optional note (e.g. birthday treat)"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                className="mt-2"
              />
              <Button
                className="w-full mt-2 bg-brand hover:bg-brand-dark text-white"
                disabled={busy}
                onClick={applyCustom}
              >
                {busy ? "Saving…" : "Apply Adjustment"}
              </Button>
            </Card>

            {/* Loyalty history */}
            <div>
              <div className="flex items-center gap-2 mb-2 px-1">
                <History className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-bold text-sm">Loyalty History</h3>
              </div>
              {detail.transactions.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-6 bg-white rounded-xl border border-dashed">
                  No activity yet. Award their first {currency.toLowerCase()} above! 👆
                </div>
              ) : (
                <Card className="overflow-hidden">
                  <ul className="divide-y divide-border max-h-72 overflow-y-auto scroll-area-thin">
                    {detail.transactions.map((t) => {
                      const positive = t.pointsChange > 0;
                      return (
                        <li key={t.id} className="flex items-start gap-3 px-3 py-2.5">
                          <span
                            className={[
                              "shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                              positive
                                ? "bg-success-light text-success-foreground"
                                : "bg-error-light text-error-foreground",
                            ].join(" ")}
                          >
                            {positive ? "+" : "−"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm">
                              <span className="font-bold">
                                {positive ? "+" : "−"}
                                {Math.abs(t.pointsChange)} {currency}
                              </span>{" "}
                              <span className="text-muted-foreground">· {reasonLabel(t.reason)}</span>
                            </div>
                            {t.note && (
                              <div className="text-xs text-muted-foreground mt-0.5 italic">
                                “{t.note}”
                              </div>
                            )}
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {timeAgo(t.createdAt)}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </div>

            {/* Footer hint */}
            <div className="text-[11px] text-muted-foreground text-center px-2">
              💡 Tip: customers receive a WhatsApp message each time you award {currency.toLowerCase()} at {tenantName}.
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function MiniStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="text-xl font-black text-gray-900 leading-tight mt-0.5">{value}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

// ── Add Customer Dialog ─────────────────────────────────────────────────────
function AddCustomerDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSubmit: (phone: string, name: string) => Promise<boolean>;
}) {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const ok = await onSubmit(phone, name);
      if (ok) {
        setPhone("");
        setName("");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>👋</span> Add a Customer
          </DialogTitle>
          <DialogDescription>
            Enter their mobile number. We&apos;ll send them a WhatsApp welcome with your loyalty
            currency attached. ✨
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cust-phone">
              Phone number <span className="text-error">*</span>
            </Label>
            <Input
              id="cust-phone"
              inputMode="tel"
              placeholder="083 555 0001"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              SA mobile format. We&apos;ll normalise it to +27 automatically.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cust-name">Name (optional)</Label>
            <Input
              id="cust-name"
              placeholder="Thabo M."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-brand hover:bg-brand-dark text-white"
              disabled={busy || !phone.trim()}
            >
              {busy ? "Adding…" : "Add & Send Welcome"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
