import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useQuery, useAction } from "convex/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/convex/_generated/api";
import { useCurrency } from "@/hooks/use-currency";
import { useMotion } from "@/hooks/use-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExportDropdown } from "@/components/ExportDropdown";
import { exportAnalyticsData } from "@/lib/exports";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Leaf,
  Beef,
  DollarSign,
  Sprout,
  Lightbulb,
  Crown,
} from "lucide-react";

// ============================================================
// Animation Variants
// ============================================================
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const reducedContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};
const reducedItemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

// ============================================================
// Loading Skeleton
// ============================================================
function AnalyticsSkeleton() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="mb-8">
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-5">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-7 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="border-border/50">
            <CardContent className="p-5">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="p-5">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

// ============================================================
// Auth Error State
// ============================================================
function AuthErrorState() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">Insights and performance metrics for your farms</p>
        </div>
        <Card className="border-border/50">
          <CardContent className="p-8 flex flex-col items-center text-center">
            <div className="p-3 rounded-2xl bg-amber-500/10 mb-4">
              <Crown className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Analytics is a Pro Feature</h3>
            <p className="text-sm text-muted-foreground max-w-md mb-4">
              Upgrade to FarmBond Pro to unlock detailed farm analytics, crop performance tracking, financial insights, and exportable reports.
            </p>
            <Button asChild className="gradient-primary">
              <a href="/settings">Upgrade to Pro</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// ============================================================
// Main Component
// ============================================================
export default function Analytics() {
  const { format, currency } = useCurrency();
  const prefersReducedMotion = useMotion();
  const [visibleMonths, setVisibleMonths] = useState<7 | 30>(7);

  const cv = prefersReducedMotion ? reducedContainerVariants : containerVariants;
  const iv = prefersReducedMotion ? reducedItemVariants : itemVariants;

  // Pro-gated query — returns undefined while loading, throws for free users
  const dashboard = useQuery(api.analytics.getAnalyticsDashboard);
  const getExportData = useAction(api.exports.getExportData);

  // Loading state
  if (dashboard === undefined) return <AnalyticsSkeleton />;

  // Error/auth state — query returns null when it errors (Convex behavior)
  // For Pro gate failures, the query returns undefined and throws at runtime
  if (dashboard === null) return <AuthErrorState />;

  const financial = dashboard.financial;
  const monthlyData = dashboard.monthly ?? [];
  const farmsResult = { page: dashboard.farms ?? [] };
  const allCrops = dashboard.crops ?? [];
  const livestock = dashboard.livestock ?? [];
  const farmCount = farmsResult.page.length;

  // Shared active crops filter (computed once, used by both stats and topCrops)
  const activeCrops = useMemo(
    () => allCrops.filter((c: any) => c.status !== "harvested" && c.status !== "failed"),
    [allCrops]
  );

  const stats = useMemo(() => {
    const totalIncome = financial?.totalIncome ?? 0;
    const totalExpenses = financial?.totalExpenses ?? 0;
    const netProfit = financial?.netProfit ?? 0;
    const incomeChange = financial?.incomeChange ?? 0;

    // Average of RECORDED health scores only; null when none are scored.
    const scoredCrops = activeCrops.filter((c: any) => typeof c.healthScore === "number");
    const avgHealth =
      scoredCrops.length > 0
        ? Math.round(
            scoredCrops.reduce((s: number, c: any) => s + (c.healthScore as number), 0) / scoredCrops.length
          )
        : null;

    const healthyLivestock = livestock.filter((l: any) => l.status === "healthy").length;
    const livestockHealth =
      livestock.length > 0 ? Math.round((healthyLivestock / livestock.length) * 100) : 0;

    const insights: { title: string; desc: string; badge: string; color: string }[] = [];
    if (activeCrops.length > 0) {
      const bestCrop = [...activeCrops].sort((a: any, b: any) => (b.healthScore ?? -1) - (a.healthScore ?? -1))[0];
      if (bestCrop.healthScore != null) {
        insights.push({
          title: `Best Performing Crop: ${bestCrop.name}`,
          desc: `${bestCrop.name} has the highest health score at ${bestCrop.healthScore}% across ${activeCrops.length} active crop${activeCrops.length === 1 ? "" : "s"}.`,
          badge: "Crop Health",
          color: "bg-green-500/10 text-green-600",
        });
      }
    }
    if (netProfit > 0) {
      insights.push({
        title: "Farm is Profitable",
        desc: `Net profit is ${format(netProfit)}. Keep tracking expenses closely to protect your margins.`,
        badge: "Finance",
        color: "bg-blue-500/10 text-blue-600",
      });
    } else if (totalExpenses > 0) {
      insights.push({
        title: "Expenses Exceed Income",
        desc: `Expenses of ${format(totalExpenses)} currently exceed income. Review your cost categories to find savings.`,
        badge: "Warning",
        color: "bg-red-500/10 text-red-600",
      });
    }
    if (financial && financial.expenseChange > 5) {
      insights.push({
        title: "Costs Rising",
        desc: `Month-over-month expenses are up ${financial.expenseChange.toFixed(1)}%. Consider bulk purchasing or input alternatives.`,
        badge: "Costs",
        color: "bg-amber-500/10 text-amber-600",
      });
    }
    if (livestock.length > 0) {
      insights.push({
        title: "Livestock Health",
        desc: `${healthyLivestock} of ${livestock.length} animals are healthy (${livestockHealth}%). Keep vaccinations up to date to avoid disease outbreaks.`,
        badge: "Livestock",
        color: "bg-purple-500/10 text-purple-600",
      });
    }
    if (insights.length === 0) {
      insights.push({
        title: "Add Some Data",
        desc: "Register farms, crops, livestock, and transactions to unlock personalized insights.",
        badge: "Getting Started",
        color: "bg-gray-500/10 text-gray-600",
      });
    }

    return { totalIncome, totalExpenses, netProfit, incomeChange, activeCrops: activeCrops.length, avgHealth, livestockHealth, insights };
  }, [financial, activeCrops, livestock, format]);

  // Top crops by health (uses shared activeCrops)
  const topCrops = useMemo(
    () =>
      [...activeCrops]
        .sort((a: any, b: any) => (b.healthScore ?? -1) - (a.healthScore ?? -1))
        .slice(0, 5),
    [activeCrops]
  );

  // Chart data — slices to visibleMonths
  const chartData = useMemo(() => {
    const all = monthlyData ?? [];
    return visibleMonths === 30 ? all.slice(-Math.min(all.length, 30)) : all.slice(-7);
  }, [monthlyData, visibleMonths]);

  const maxVal = Math.max(1, ...chartData.map((d) => Math.max(d.income, d.expenses)));

  const handleExportPDF = async () => {
    try {
      const bundle = await getExportData({ resource: "analytics" });
      exportAnalyticsData(bundle.rows, "Analytics Report", "pdf", currency);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Exports require FarmBond Pro");
    }
  };

  const handleExportExcel = async () => {
    try {
      const bundle = await getExportData({ resource: "analytics" });
      exportAnalyticsData(bundle.rows, "Analytics Report", "excel", currency);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Exports require FarmBond Pro");
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
              <p className="text-muted-foreground mt-1">Insights and performance metrics for your farms</p>
            </div>
            <div className="flex gap-2">
              <div className="flex gap-1 p-1 bg-muted rounded-xl" role="radiogroup" aria-label="Chart time range">
                <button
                  role="radio"
                  aria-checked={visibleMonths === 7}
                  onClick={() => setVisibleMonths(7)}
                  className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  7 Months
                </button>
                <button
                  role="radio"
                  aria-checked={visibleMonths === 30}
                  onClick={() => setVisibleMonths(30)}
                  className="px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  30 Months
                </button>
              </div>
              <ExportDropdown onExportPDF={handleExportPDF} onExportExcel={handleExportExcel} />
            </div>
          </div>
        </motion.div>

        <motion.div variants={cv} initial="hidden" animate="visible" className="space-y-6">
          {/* Summary Cards */}
          <motion.div variants={iv} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Total Revenue", value: format(stats.totalIncome), change: `${stats.incomeChange >= 0 ? "+" : ""}${stats.incomeChange.toFixed(1)}%`, icon: DollarSign, color: "bg-green-500" },
              { title: "Net Profit", value: format(stats.netProfit), change: `${stats.totalIncome > 0 ? ((stats.netProfit / stats.totalIncome) * 100).toFixed(1) : 0}% margin`, icon: TrendingUp, color: "bg-emerald-500" },
              { title: "Active Crops", value: `${stats.activeCrops} crops${stats.avgHealth != null ? ` · ${stats.avgHealth}% health` : ""}`, change: `${farmCount} farm${farmCount === 1 ? "" : "s"}`, icon: Leaf, color: "bg-amber-500" },
              { title: "Livestock Health", value: `${stats.livestockHealth}%`, change: `${livestock.length} animals`, icon: Beef, color: "bg-blue-500" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              const positive = !stat.change.startsWith("-");
              return (
                <Card key={i} className="border-border/50 card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 min-w-0">
                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                        <p className="text-xl font-bold truncate">{stat.value}</p>
                        <div className="flex items-center gap-1">
                          {positive ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                          <span className={`text-xs ${positive ? "text-green-500" : "text-red-500"}`}>{stat.change}</span>
                        </div>
                      </div>
                      <div className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${stat.color}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <motion.div variants={iv}>
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Revenue vs Expenses</CardTitle>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Income</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Expenses</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {chartData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                      <BarChart3 className="w-10 h-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No transactions recorded yet</p>
                      <p className="text-xs text-muted-foreground/70 mt-1">Add income and expenses in Finances to see trends</p>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2 h-48" role="img" aria-label={`Revenue vs Expenses chart for the last ${visibleMonths === 7 ? "7" : "30"} months`}>
                      {chartData.map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: "160px" }}>
                            <div
                              className="w-3 bg-green-500 rounded-t-sm transition-all duration-500"
                              style={{ height: `${(d.income / maxVal) * 100}%` }}
                              role="img"
                              aria-label={`Income for ${d.month}: ${format(d.income)}`}
                              title={`Income: ${format(d.income)}`}
                            />
                            <div
                              className="w-3 bg-red-400/70 rounded-t-sm transition-all duration-500"
                              style={{ height: `${(d.expenses / maxVal) * 100}%` }}
                              role="img"
                              aria-label={`Expenses for ${d.month}: ${format(d.expenses)}`}
                              title={`Expenses: ${format(d.expenses)}`}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">{d.month}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Crop Performance */}
            <motion.div variants={iv}>
              <Card className="border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-base">Crop Health Performance</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {topCrops.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-center">
                      <Sprout className="w-10 h-10 text-muted-foreground/30 mb-3" />
                      <p className="text-sm text-muted-foreground">No active crops yet</p>
                    </div>
                  ) : (
                    topCrops.map((crop: any) => (
                      <div key={crop._id} className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{crop.name}</span>
                          {crop.healthScore != null ? (
                            <span className="text-muted-foreground">{crop.healthScore}% health</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No score yet</span>
                          )}
                        </div>
                        {crop.healthScore != null && (
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                crop.healthScore >= 90
                                  ? "bg-gradient-to-r from-green-500 to-emerald-500"
                                  : crop.healthScore >= 70
                                  ? "bg-gradient-to-r from-amber-400 to-orange-500"
                                  : "bg-gradient-to-r from-red-400 to-red-600"
                              }`}
                              style={{ width: `${crop.healthScore}%` }}
                              role="img"
                              aria-label={`${crop.name} health score: ${crop.healthScore}%`}
                            />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Top Insights */}
          <motion.div variants={iv}>
            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" />Key Insights & Recommendations</CardTitle></CardHeader>
              <CardContent className={`grid gap-4 ${stats.insights.length <= 2 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>
                {stats.insights.map((insight, i) => (
                  <div key={i} className="p-4 rounded-xl bg-muted/30 space-y-2">
                    <Badge className={insight.color}>{insight.badge}</Badge>
                    <h4 className="text-sm font-semibold">{insight.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{insight.desc}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
