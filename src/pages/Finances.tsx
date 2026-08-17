import { useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExportDropdown } from "@/components/ExportDropdown";
import { exportTransactionHistory } from "@/lib/exports";
import { useMarketPrices } from "@/hooks/use-market-prices";
import { useFinances } from "@/hooks/use-finances";
import { useCurrency } from "@/hooks/use-currency";
import { useHaptic } from "@/hooks/use-mobile";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calculator,
  Trash2,
  Wheat,
  Beef,
  Leaf,
  Droplets,
  Info,
  AlertTriangle,
  ArrowRight,
  Minus,
  Inbox,
  Loader2,
  BarChart3,
  PiggyBank,
  CalendarDays,
  Coins,
  Receipt,
} from "lucide-react";

// ============================================================
// Animation (respects prefers-reduced-motion)
// ============================================================

function useEntranceVariants() {
  const shouldReduceMotion = useReducedMotion();
  const duration = shouldReduceMotion ? 0 : 0.35;
  const stagger = shouldReduceMotion ? 0 : 0.05;
  return {
    container: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: stagger } },
    },
    item: {
      hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 14 },
      visible: { opacity: 1, y: 0, transition: { duration } },
    },
  };
}

const categoryIcons: Record<string, typeof Wheat> = {
  cereal: Wheat,
  legume: Leaf,
  vegetable: Leaf,
  dairy: Droplets,
  livestock: Beef,
  poultry: Beef,
  tuber: Leaf,
};

const TRANSACTION_CATEGORIES = [
  "seeds",
  "fertilizer",
  "labor",
  "equipment",
  "harvest_sale",
  "livestock_sale",
  "dairy",
  "poultry",
  "fuel",
  "transport",
  "rent",
  "water",
  "other",
];

const PAYMENT_METHODS = ["cash", "mobile_money", "bank_transfer", "card", "cheque"];

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================
// Market Price Card
// ============================================================

function MarketPriceCard({ price }: { price: import("@/hooks/use-market-prices").CommodityPrice }) {
  const { format: fmt, convert } = useCurrency();
  const Icon = categoryIcons[price.category] || Wheat;
  const isUp = price.trend === "up";

  return (
    <Card className="border-border/60 transition-all hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md hover:shadow-brand/5">
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{price.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{price.unit}</p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`shrink-0 border text-[10px] ${
              isUp
                ? "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300"
                : price.trend === "down"
                ? "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300"
                : "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-300"
            }`}
          >
            {isUp ? (
              <TrendingUp className="mr-0.5 h-3 w-3" />
            ) : price.trend === "down" ? (
              <TrendingDown className="mr-0.5 h-3 w-3" />
            ) : (
              <Minus className="mr-0.5 h-3 w-3" />
            )}
            {Math.abs(price.changePercent)}%
          </Badge>
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="text-xl font-bold tracking-tight">
            {fmt(convert(price.currentPrice, price.currency))}
          </p>
          <p
            className={`truncate text-xs ${
              isUp
                ? "text-green-600 dark:text-green-400"
                : price.trend === "down"
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
            }`}
          >
            {isUp ? "+" : ""}
            {price.change.toLocaleString()} {price.unit}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Top Gainers / Losers
// ============================================================

function TopMovers({
  title,
  items,
  type,
}: {
  title: string;
  items: import("@/hooks/use-market-prices").CommodityPrice[];
  type: "gainers" | "losers";
}) {
  const { format: fmt, convert } = useCurrency();
  const tone =
    type === "gainers"
      ? "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300"
      : "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300";

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {type === "gainers" ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
              <TrendingUp className="h-4 w-4" />
            </span>
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
              <TrendingDown className="h-4 w-4" />
            </span>
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No price movements yet</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 transition-colors hover:bg-muted/50"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{item.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{item.unit}</span>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold">{fmt(convert(item.currentPrice, item.currency))}</p>
                <p className={`text-[10px] font-medium ${type === "gainers" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                  {type === "gainers" ? "+" : ""}
                  {item.changePercent}%
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Financial Hero (real summary data from getFinancialSummary)
// ============================================================

function FinancialHero({
  totals,
  summary,
  loading,
  txnCount,
}: {
  totals: { income: number; expenses: number; net: number };
  summary: {
    thisMonthIncome?: number;
    thisMonthExpenses?: number;
    incomeChange?: number;
    expenseChange?: number;
  } | undefined;
  loading: boolean;
  txnCount: number;
}) {
  const { format: fmt } = useCurrency();
  const monthLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const netPositive = totals.net >= 0;
  const profitMargin =
    totals.income > 0 ? ((totals.net / totals.income) * 100).toFixed(1) : "0.0";

  const sumPositive = (summary?.thisMonthIncome ?? 0) + (summary?.thisMonthExpenses ?? 0);
  const incomePct =
    sumPositive > 0 ? ((summary?.thisMonthIncome ?? 0) / sumPositive) * 100 : 50;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-brand-deep text-white">
      <div className="pointer-events-none absolute -right-14 -top-14 h-52 w-52 rounded-full bg-brand/20" />
      <div className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full bg-brand/10" />
      <div className="relative z-10 p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="inline-flex w-fit items-center gap-2 rounded-full border border-brand/50 bg-black/25 px-3 py-1 text-[11px] font-medium text-brand backdrop-blur-sm">
              <CalendarDays className="h-3 w-3" aria-hidden />
              {monthLabel}
            </p>
            <p className="mt-3 text-xs font-medium uppercase tracking-wider text-white/60">
              Net profit · all time
            </p>
            {loading ? (
              <Skeleton className="mt-2 h-10 w-44 bg-white/20" />
            ) : (
              <p className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                {netPositive ? "" : "−"}
                {fmt(Math.abs(totals.net))}
              </p>
            )}
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-white/70">
              <Wallet className="h-3.5 w-3.5 text-brand" aria-hidden />
              {txnCount} transaction{txnCount === 1 ? "" : "s"} recorded
            </p>
          </div>

          {/* This month's income vs expenses */}
          <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm sm:w-80">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/60">
              This month
            </p>
            {loading || summary === undefined ? (
              <div className="mt-3 space-y-3">
                <Skeleton className="h-4 w-full bg-white/20" />
                <Skeleton className="h-4 w-full bg-white/20" />
              </div>
            ) : (
              <>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-white/80">
                    <Coins className="h-3.5 w-3.5 text-brand" aria-hidden />
                    Income
                  </span>
                  <span className="text-sm font-bold">
                    {fmt(summary.thisMonthIncome ?? 0)}
                    <span
                      className={`ml-1.5 text-[10px] font-medium ${
                        (summary.incomeChange ?? 0) >= 0 ? "text-green-300" : "text-red-300"
                      }`}
                    >
                      {(summary.incomeChange ?? 0) >= 0 ? "+" : ""}
                      {(summary.incomeChange ?? 0).toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs text-white/80">
                    <Receipt className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                    Expenses
                  </span>
                  <span className="text-sm font-bold">
                    {fmt(summary.thisMonthExpenses ?? 0)}
                    <span
                      className={`ml-1.5 text-[10px] font-medium ${
                        (summary.expenseChange ?? 0) >= 0 ? "text-red-300" : "text-green-300"
                      }`}
                    >
                      {(summary.expenseChange ?? 0) >= 0 ? "+" : ""}
                      {(summary.expenseChange ?? 0).toFixed(1)}%
                    </span>
                  </span>
                </div>
                <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-white/20">
                  <div
                    className="h-full rounded-l-full bg-brand transition-all duration-700"
                    style={{ width: `${incomePct}%` }}
                  />
                  <div
                    className="h-full flex-1 rounded-r-full bg-amber-400/80"
                    style={{ width: `${100 - incomePct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-[10px] text-white/50">
                  <span>Income {Math.round(incomePct)}%</span>
                  <span>Expenses {Math.round(100 - incomePct)}%</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
            <Calculator className="h-3.5 w-3.5 text-brand" aria-hidden />
            Profit margin {profitMargin}%
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium backdrop-blur-sm">
            <TrendingUp className="h-3.5 w-3.5 text-brand" aria-hidden />
            {netPositive ? "Profitable" : "Loss-making"}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Add Transaction Modal
// ============================================================

interface AddTransactionForm {
  type: "income" | "expense";
  farmId: string;
  category: string;
  description: string;
  amount: string;
  date: string;
  paymentMethod: string;
}

function AddTransactionModal({
  isOpen,
  onClose,
  farms,
  currency,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  farms: { _id: string; name: string }[];
  currency: string;
  onSubmit: (data: {
    farmId: Id<"farms">;
    type: "income" | "expense";
    category: string;
    description: string;
    amount: number;
    currency: string;
    date: number;
    paymentMethod?: string;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState<AddTransactionForm>({
    type: "expense",
    farmId: "",
    category: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    paymentMethod: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const amount = Number(form.amount);
    // Client-side validation — the backend validates again server-side.
    if (!form.farmId) return setFormError("Please select a farm.");
    if (!form.category) return setFormError("Please select a category.");
    if (!form.description.trim()) return setFormError("Please enter a description.");
    if (!amount || amount <= 0) return setFormError("Please enter a valid amount greater than 0.");
    if (!form.date) return setFormError("Please select a date.");

    setIsSubmitting(true);
    try {
      await onSubmit({
        farmId: form.farmId as Id<"farms">,
        type: form.type,
        category: form.category,
        description: form.description.trim(),
        amount,
        currency,
        date: new Date(form.date).getTime(),
        paymentMethod: form.paymentMethod || undefined,
      });
      setForm({
        type: "expense",
        farmId: "",
        category: "",
        description: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        paymentMethod: "",
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Transaction</DialogTitle>
          <DialogDescription>
            Record an income or expense for one of your farms.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(["expense", "income"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type }))}
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring/60 ${
                  form.type === type
                    ? type === "income"
                      ? "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300"
                      : "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                {type === "income" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {type === "income" ? "Income" : "Expense"}
              </button>
            ))}
          </div>

          {farms.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 text-center">
              <p className="text-sm font-medium">No farms registered yet</p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                Register your farm before recording income or expenses.
              </p>
              <Link
                to="/farms/new"
                className="mt-3 inline-flex h-10 items-center rounded-full border border-brand/40 bg-brand/10 px-4 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand/20 dark:text-brand"
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Register a farm
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="tx-farm">Farm *</Label>
              <Select value={form.farmId} onValueChange={(v) => setForm((f) => ({ ...f, farmId: v }))}>
                <SelectTrigger id="tx-farm">
                  <SelectValue placeholder="Select farm" />
                </SelectTrigger>
                <SelectContent>
                  {farms.map((farm) => (
                    <SelectItem key={farm._id} value={farm._id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tx-category">Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger id="tx-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {titleCase(cat)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-amount">Amount ({currency}) *</Label>
              <Input
                id="tx-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tx-desc">Description *</Label>
            <Input
              id="tx-desc"
              placeholder="e.g. Maize sale — 5 tons to cooperative"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tx-date">Date *</Label>
              <Input
                id="tx-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tx-pm">Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger id="tx-pm">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((pm) => (
                    <SelectItem key={pm} value={pm}>
                      {titleCase(pm)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" aria-hidden /> {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || farms.length === 0}
              className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              {isSubmitting ? "Saving..." : "Save Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Main Finances Page
// ============================================================

export default function Finances() {
  const variants = useEntranceVariants();
  const haptic = useHaptic();
  const { format: fmt, convert, currency } = useCurrency();
  const {
    transactions,
    summary,
    monthly,
    farms,
    isLoading,
    createTransaction,
    deleteTransaction,
  } = useFinances();
  const { data: marketData, isLoading: marketLoading } = useMarketPrices();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const farmMap = useMemo(() => {
    const map = new Map<string, string>();
    farms.forEach((f) => map.set(f._id, f.name));
    return map;
  }, [farms]);

  const filtered = useMemo(() => {
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return transactions.filter((t) => {
      const matchesSearch =
        !searchQuery ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === "all" || t.type === filterType;
      const matchesDate = (!fromTs || t.date >= fromTs) && (!toTs || t.date <= toTs);
      return matchesSearch && matchesType && matchesDate;
    });
  }, [transactions, searchQuery, filterType, dateFrom, dateTo]);

  // Exports are a Pro feature: data is fetched through the gated backend
  // action (server-authorization), never exported from local state alone.
  const getExportData = useAction(api.exports.getExportData);

  // Each row stores the currency it was entered in (the user's currency at
  // entry time, KES by default). Convert rows into the user's configured
  // currency first so the exported file matches what the app displays — the
  // same per-row pattern used for the on-screen totals.
  const toExportRows = (rows: Record<string, unknown>[]) =>
    rows.map((r) => ({
      ...r,
      amount: convert(Number(r.amount) || 0, String(r.currency ?? "KES")),
    }));

  const handleExportPDF = async () => {
    try {
      const bundle = await getExportData({ resource: "transactions" });
      if (bundle.rows.length === 0) {
        toast.info("No transactions to export yet.");
        return;
      }
      exportTransactionHistory(toExportRows(bundle.rows), "pdf", currency);
      toast.success("PDF exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Exports require FarmBond Pro");
    }
  };

  const handleExportExcel = async () => {
    try {
      const bundle = await getExportData({ resource: "transactions" });
      if (bundle.rows.length === 0) {
        toast.info("No transactions to export yet.");
        return;
      }
      exportTransactionHistory(toExportRows(bundle.rows), "excel", currency);
      toast.success("Excel exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Exports require FarmBond Pro");
    }
  };

  const handleAdd = async (data: {
    farmId: Id<"farms">;
    type: "income" | "expense";
    category: string;
    description: string;
    amount: number;
    currency: string;
    date: number;
    paymentMethod?: string;
  }) => {
    await createTransaction(data);
    toast.success("Transaction added");
  };

  const handleDelete = async (transactionId: Id<"transactions">) => {
    if (!window.confirm("Delete this transaction? This cannot be undone.")) return;
    setIsDeleting(transactionId);
    try {
      await deleteTransaction({ transactionId });
      toast.success("Transaction deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete transaction");
    } finally {
      setIsDeleting(null);
    }
  };

  const topGainer = useMemo(
    () => (marketData ? [...marketData.commodities].sort((a, b) => b.changePercent - a.changePercent)[0] : null),
    [marketData]
  );

  // Financial totals are computed from the loaded transaction rows: every row
  // stores the currency it was entered in (the user's currency at entry time,
  // KES by default), so each amount is converted from its own stored currency
  // into the user's configured currency before summing — the same per-row
  // pattern as the Dashboard financial snapshot. KES users get an identity
  // conversion, so their totals are unchanged.
  const totals = useMemo(() => {
    let income = 0;
    let expenses = 0;
    for (const txn of transactions) {
      const value = convert(txn.amount, txn.currency ?? "KES");
      if (txn.type === "income") income += value;
      else expenses += value;
    }
    return { income, expenses, net: income - expenses };
  }, [transactions, convert]);

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-5 flex flex-col gap-4 sm:mb-7 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Finances</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track income, expenses, and market prices
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ExportDropdown onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} />
            <Button
              onClick={() => {
                haptic.selection();
                setShowAddModal(true);
              }}
              className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90 touch-target"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Transaction
            </Button>
          </div>
        </motion.div>

        <motion.div
          variants={variants.container}
          initial="hidden"
          animate="visible"
          className="space-y-4 sm:space-y-6"
        >
          {/* Financial hero */}
          <motion.div variants={variants.item}>
            <FinancialHero
              totals={totals}
              summary={summary}
              loading={isLoading}
              txnCount={transactions.length}
            />
          </motion.div>

          {/* Monthly chart */}
          <motion.div variants={variants.item}>
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
                      <BarChart3 className="h-4 w-4" />
                    </span>
                    <div>
                      <CardTitle className="text-base">Monthly Income vs Expenses</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Last 7 months · all amounts in {currency}
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/analytics"
                    onClick={() => haptic.light()}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-foreground transition-colors hover:underline sm:mt-0 dark:text-brand"
                  >
                    View Analytics <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-64 w-full rounded-xl" />
                ) : monthly.length > 0 ? (
                  <div className="h-64" role="img" aria-label="Bar chart of monthly income versus expenses">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          stroke="var(--muted-foreground)"
                          tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                        />
                        <Tooltip
                          // The monthly buckets arrive from the backend already
                          // converted into the user's configured display currency
                          // (getMonthlyFinancialSummary converts each row server-side),
                          // so values are formatted directly — no client conversion.
                          formatter={(value: number | string, name: string) => [
                            fmt(Number(value)),
                            name === "income" ? "Income" : name === "expenses" ? "Expenses" : name,
                          ]}
                          contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }}
                        />
                        <Legend />
                        <Bar dataKey="income" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar dataKey="expenses" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand-foreground dark:text-brand">
                      <Inbox className="h-6 w-6" />
                    </div>
                    <p className="mt-3 text-sm font-medium">No financial trends yet</p>
                    <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                      Add your first transaction to see monthly income and expense trends.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Market Prices Section */}
          <motion.div variants={variants.item}>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold sm:text-lg">Market Prices</h2>
                <p className="text-sm text-muted-foreground">
                  Reference market data for planning — indicative regional price benchmarks
                </p>
              </div>
              {marketData && (
                <span
                  className="flex w-fit items-center gap-1 text-xs text-muted-foreground"
                  title={
                    marketData.dataSource === "reference"
                      ? "Benchmark ranges, not live exchange data"
                      : undefined
                  }
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                  Reference prices — not live market data
                </span>
              )}
            </div>

            {marketLoading && !marketData ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-32 rounded-2xl" />
                ))}
              </div>
            ) : marketData ? (
              <>
                {topGainer && topGainer.changePercent > 0 && (
                  <Card className="mb-4 border-amber-500/30 bg-amber-500/5">
                    <CardContent className="flex items-center gap-3 p-4">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">
                          Market alert: {topGainer.name} prices up {Math.abs(topGainer.changePercent)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reference trend — consider timing sales of stored {topGainer.name.toLowerCase()} around current benchmarks.
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </CardContent>
                  </Card>
                )}

                <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {marketData.commodities.slice(0, 8).map((price) => (
                    <MarketPriceCard key={price.id} price={price} />
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <TopMovers
                    title="Top Gainers"
                    items={[...marketData.commodities].sort((a, b) => b.changePercent - a.changePercent).slice(0, 4)}
                    type="gainers"
                  />
                  <TopMovers
                    title="Top Losers"
                    items={[...marketData.commodities].sort((a, b) => a.changePercent - b.changePercent).slice(0, 4)}
                    type="losers"
                  />
                </div>
              </>
            ) : null}
          </motion.div>

          {/* Filters */}
          <motion.div
            variants={variants.item}
            className="flex flex-col gap-3 lg:flex-row lg:items-center"
          >
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                aria-label="Search transactions"
                placeholder="Search transactions..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {(["all", "income", "expense"] as const).map((type) => (
                <Button
                  key={type}
                  variant={filterType === type ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    haptic.selection();
                    setFilterType(type);
                  }}
                  className={`rounded-full capitalize ${
                    filterType === type
                      ? "bg-brand text-brand-foreground hover:bg-brand/90"
                      : ""
                  }`}
                >
                  {type}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                aria-label="From date"
                className="w-36 sm:w-40"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                aria-label="To date"
                className="w-36 sm:w-40"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
              {(dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="rounded-full"
                >
                  Clear
                </Button>
              )}
            </div>
          </motion.div>

          {/* Transactions Table */}
          <motion.div variants={variants.item}>
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Recent Transactions</CardTitle>
                  {transactions.length > 0 && (
                    <Badge variant="secondary" className="border-border/60 text-[10px]">
                      {filtered.length} of {transactions.length}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-16 rounded-xl" />
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand-foreground dark:text-brand">
                      <PiggyBank className="h-7 w-7" />
                    </div>
                    <p className="mt-4 text-base font-semibold">No transactions yet</p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      Record your first income or expense to start tracking your farm's finances.
                    </p>
                    <Button
                      className="mt-5 rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
                      size="sm"
                      onClick={() => setShowAddModal(true)}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Add Transaction
                    </Button>
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No transactions match your filters.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {filtered.map((txn) => (
                      <div
                        key={txn._id}
                        className="group flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3 transition-colors hover:border-brand/40 hover:bg-muted/30 sm:gap-4 sm:p-3.5"
                      >
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            txn.type === "income"
                              ? "bg-green-500/10 text-green-600 dark:text-green-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                          }`}
                        >
                          {txn.type === "income" ? (
                            <ArrowUpRight className="h-5 w-5" />
                          ) : (
                            <ArrowDownRight className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{txn.description}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {titleCase(txn.category)} · {farmMap.get(txn.farmId) ?? "Unknown farm"}
                            {txn.paymentMethod ? ` · ${titleCase(txn.paymentMethod)}` : ""} ·{" "}
                            {new Date(txn.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 text-sm font-bold tabular-nums ${
                            txn.type === "income"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {txn.type === "income" ? "+" : "−"}
                          {fmt(convert(txn.amount, txn.currency ?? "KES"))}
                        </span>
                        <button
                          aria-label={`Delete transaction ${txn.description}`}
                          onClick={() => handleDelete(txn._id)}
                          disabled={isDeleting === txn._id}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/60 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          {isDeleting === txn._id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      <AddTransactionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        farms={farms}
        currency={currency}
        onSubmit={handleAdd}
      />
    </AppLayout>
  );
}
