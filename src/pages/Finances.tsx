import { useMemo, useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { motion } from "framer-motion";
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
  Clock,
  AlertTriangle,
  ArrowRight,
  Minus,
  Inbox,
  Loader2,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

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

// ============================================================
// Market Price Card
// ============================================================

function MarketPriceCard({ price }: { price: import("@/hooks/use-market-prices").CommodityPrice }) {
  const { format: fmt, convert } = useCurrency();
  const Icon = categoryIcons[price.category] || Wheat;
  const isUp = price.trend === "up";

  return (
    <Card className="border-border/50 card-hover">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{price.name}</p>
              <p className="text-[10px] text-muted-foreground">{price.unit}</p>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={`text-[10px] ${
              isUp
                ? "bg-green-500/10 text-green-600"
                : price.trend === "down"
                ? "bg-red-500/10 text-red-600"
                : "bg-gray-500/10 text-gray-600"
            }`}
          >
            {isUp ? (
              <TrendingUp className="w-3 h-3 mr-0.5" />
            ) : price.trend === "down" ? (
              <TrendingDown className="w-3 h-3 mr-0.5" />
            ) : (
              <Minus className="w-3 h-3 mr-0.5" />
            )}
            {Math.abs(price.changePercent)}%
          </Badge>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xl font-bold">{fmt(convert(price.currentPrice, price.currency))}</p>
            <p className={`text-xs mt-0.5 ${isUp ? "text-green-600" : price.trend === "down" ? "text-red-600" : "text-muted-foreground"}`}>
              {isUp ? "+" : ""}{price.change.toLocaleString()} from last week
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Top Gainers/Losers
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
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          {type === "gainers" ? (
            <TrendingUp className="w-4 h-4 text-green-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{item.name}</span>
              <span className="text-[10px] text-muted-foreground">{item.unit}</span>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{fmt(convert(item.currentPrice, item.currency))}</p>
              <p className={`text-[10px] ${type === "gainers" ? "text-green-600" : "text-red-600"}`}>
                {type === "gainers" ? "+" : ""}{item.changePercent}%
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                  form.type === type
                    ? type === "income"
                      ? "border-green-500/50 bg-green-500/10 text-green-600"
                      : "border-red-500/50 bg-red-500/10 text-red-600"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                {type === "income" ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {type === "income" ? "Income" : "Expense"}
              </button>
            ))}
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tx-category">Category *</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger id="tx-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {TRANSACTION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      {pm.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gradient-primary">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
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

  const exportRows = useMemo(
    () =>
      filtered.map((t) => ({
        date: new Date(t.date).toISOString().split("T")[0],
        type: t.type,
        category: t.category,
        description: t.description,
        amount: t.amount,
        farm: farmMap.get(t.farmId) ?? "Unknown",
        paymentMethod: t.paymentMethod ?? "",
      })),
    [filtered, farmMap]
  );

  const handleExportPDF = () => {
    if (exportRows.length === 0) {
      toast.info("No transactions to export yet.");
      return;
    }
    exportTransactionHistory(exportRows, "pdf");
    toast.success("PDF exported");
  };

  const handleExportExcel = () => {
    if (exportRows.length === 0) {
      toast.info("No transactions to export yet.");
      return;
    }
    exportTransactionHistory(exportRows, "excel");
    toast.success("Excel exported");
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

  const profitMargin =
    summary && summary.totalIncome > 0 ? ((summary.netProfit / summary.totalIncome) * 100).toFixed(1) : "0.0";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Finances</h1>
              <p className="text-muted-foreground mt-1">Track income, expenses, and market prices</p>
            </div>
            <div className="flex gap-2">
              <ExportDropdown onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} />
              <Button className="gradient-primary" onClick={() => setShowAddModal(true)}>
                <Plus className="w-4 h-4 mr-2" />Add Transaction
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
          {/* Financial Summary */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/50">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-500"><TrendingUp className="w-6 h-6 text-white" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Income</p>
                  <p className="text-2xl font-bold text-green-600">{fmt(summary ? convert(summary.totalIncome, "KES") : 0)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500"><TrendingDown className="w-6 h-6 text-white" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold text-red-600">{fmt(summary ? convert(summary.totalExpenses, "KES") : 0)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500"><Wallet className="w-6 h-6 text-white" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Net Profit</p>
                  <p className={`text-2xl font-bold ${summary && summary.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {fmt(summary ? convert(summary.netProfit, "KES") : 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500"><Calculator className="w-6 h-6 text-white" /></div>
                <div>
                  <p className="text-sm text-muted-foreground">Profit Margin</p>
                  <p className="text-2xl font-bold">{profitMargin}%</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Monthly chart */}
          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Monthly Income vs Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                {monthly.length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={monthly} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
                        <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                        <Tooltip
                          formatter={(value: number | string, name: string) => [
                            fmt(convert(Number(value), "KES")),
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
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No financial data yet — add your first transaction to see monthly trends.
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Market Prices Section */}
          <motion.div variants={itemVariants}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold">Market Prices</h2>
                <p className="text-sm text-muted-foreground">
                  Reference market data for planning — indicative regional price benchmarks
                </p>
              </div>
              {marketData && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Updated {marketData.lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </div>

            {marketLoading && !marketData ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 bg-muted/50 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : marketData ? (
              <>
                {topGainer && topGainer.changePercent > 0 && (
                  <Card className="border-amber-500/30 bg-amber-500/5 mb-4">
                    <CardContent className="p-4 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          Market alert: {topGainer.name} prices up {Math.abs(topGainer.changePercent)}%
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reference trend — consider timing sales of stored {topGainer.id} around current benchmarks.
                        </p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-4">
                  {marketData.commodities.slice(0, 8).map((price) => (
                    <MarketPriceCard key={price.id} price={price} />
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          <motion.div variants={itemVariants} className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search transactions..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["all", "income", "expense"] as const).map((type) => (
                <Button key={type} variant={filterType === type ? "default" : "outline"} size="sm" onClick={() => setFilterType(type)} className="capitalize">
                  {type}
                </Button>
              ))}
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Input type="date" aria-label="From date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="text-muted-foreground text-sm">to</span>
              <Input type="date" aria-label="To date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                  Clear
                </Button>
              )}
            </div>
          </motion.div>

          {/* Transactions Table */}
          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-16 bg-muted/40 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                      <Inbox className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="font-medium">No transactions yet</p>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                      Record your first income or expense to start tracking your farm's finances.
                    </p>
                    <Button className="mt-4 gradient-primary" size="sm" onClick={() => setShowAddModal(true)}>
                      <Plus className="w-4 h-4 mr-2" />Add Transaction
                    </Button>
                  </div>
                ) : filtered.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    No transactions match your filters.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((txn) => (
                      <div key={txn._id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors group">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${txn.type === "income" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                          {txn.type === "income" ? <ArrowUpRight className="w-5 h-5 text-green-600" /> : <ArrowDownRight className="w-5 h-5 text-red-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{txn.description}</p>
                          <p className="text-xs text-muted-foreground">
                            {txn.category.replace(/_/g, " ")} • {farmMap.get(txn.farmId) ?? "Unknown farm"} • {new Date(txn.date).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`text-sm font-bold tabular-nums ${txn.type === "income" ? "text-green-600" : "text-red-600"}`}>
                          {txn.type === "income" ? "+" : "-"}{fmt(convert(txn.amount, txn.currency ?? "KES"))}
                        </span>
                        <button
                          aria-label={`Delete transaction ${txn.description}`}
                          onClick={() => handleDelete(txn._id)}
                          disabled={isDeleting === txn._id}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          {isDeleting === txn._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
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
