import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/convex/_generated/api";
import { useCurrency } from "@/hooks/use-currency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  Beef,
  Wheat,
  DollarSign,
  Leaf,
  Check,
  ChevronDown,
  ChevronUp,
  Award,
  Lightbulb,
  Download,
  RefreshCw,
  X,
  Plus,
  Sprout,
  Satellite,
} from "lucide-react";

// ============================================================
// Types (from getFarmComparisonData)
// ============================================================

interface FarmData {
  farm: {
    _id: string;
    name: string;
    location: string;
    size: number;
    sizeUnit: string;
    established: number;
    coverImage: string | null;
    status: string;
  };
  metrics: {
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
    revenuePerHectare: number;
    totalCrops: number;
    activeCrops: number;
    cropHealth: number | null;
    livestockCount: number;
    healthyLivestock: number;
    livestockHealth: number;
    soilHealth: number | null;
    ndvi: number | null;
    cropDiversity: number;
  };
}

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

// ============================================================
// Main Component
// ============================================================

export default function FarmComparison() {
  const { format } = useCurrency();
  const rawData = useQuery(api.farms.getFarmComparisonData);
  const [selectedFarms, setSelectedFarms] = useState<string[]>([]);
  const [compareMetric, setCompareMetric] = useState<"revenue" | "profit" | "production" | "efficiency">("revenue");
  const [showFarmSelector, setShowFarmSelector] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  const allFarms: FarmData[] = rawData ?? [];
  const selectedIds =
    selectedFarms.length > 0
      ? selectedFarms
      : allFarms.slice(0, Math.min(3, allFarms.length)).map((f) => f.farm._id);

  const selectedData = useMemo(
    () => allFarms.filter((f) => selectedIds.includes(f.farm._id)),
    [allFarms, selectedIds]
  );

  const comparativeStats = useMemo(() => {
    if (selectedData.length === 0) return null;
    const totalRevenue = selectedData.reduce((s, f) => s + f.metrics.revenue, 0);
    const totalExpenses = selectedData.reduce((s, f) => s + f.metrics.expenses, 0);
    const totalProfit = selectedData.reduce((s, f) => s + f.metrics.profit, 0);
    const avgMargin =
      selectedData.reduce((s, f) => s + f.metrics.profitMargin, 0) / selectedData.length;
    const avgRevPerHa =
      selectedData.reduce((s, f) => s + f.metrics.revenuePerHectare, 0) / selectedData.length;
    const cropHealthValues = selectedData
      .map((f) => f.metrics.cropHealth)
      .filter((v): v is number => v != null);
    const avgCropHealth =
      cropHealthValues.length > 0
        ? cropHealthValues.reduce((s, v) => s + v, 0) / cropHealthValues.length
        : null;
    const avgLivestockHealth =
      selectedData.reduce((s, f) => s + f.metrics.livestockHealth, 0) / selectedData.length;
    return { totalRevenue, totalExpenses, totalProfit, avgMargin, avgRevPerHa, avgCropHealth, avgLivestockHealth };
  }, [selectedData]);

  const insights = useMemo(() => {
    if (selectedData.length < 2) return [];
    const result: { id: string; type: "success" | "warning" | "info"; title: string; description: string; icon: React.ComponentType<{ className?: string }> }[] = [];

    const bestMargin = [...selectedData].sort((a, b) => b.metrics.profitMargin - a.metrics.profitMargin)[0];
    if (bestMargin.metrics.profit > 0) {
      result.push({
        id: "best-margin",
        type: "success",
        title: "Highest Profit Margin",
        description: `${bestMargin.farm.name} leads with ${bestMargin.metrics.profitMargin.toFixed(1)}% profit margin. Consider adopting their cost management strategies.`,
        icon: Award,
      });
    }

    const bestHealth = [...selectedData].sort(
      (a, b) => (b.metrics.cropHealth ?? -1) - (a.metrics.cropHealth ?? -1)
    )[0];
    if (bestHealth.metrics.cropHealth != null && bestHealth.metrics.cropHealth > 0) {
      result.push({
        id: "best-crop-health",
        type: "success",
        title: "Best Crop Health",
        description: `${bestHealth.farm.name} has the healthiest crops at ${bestHealth.metrics.cropHealth}%. Review what's working there and replicate it.`,
        icon: Leaf,
      });
    }

    const bestNdiv = [...selectedData].sort((a, b) => (b.metrics.ndvi ?? 0) - (a.metrics.ndvi ?? 0))[0];
    if (bestNdiv.metrics.ndvi !== null && bestNdiv.metrics.ndvi > 0) {
      result.push({
        id: "best-ndvi",
        type: "info",
        title: "Strongest Vegetation",
        description: `${bestNdiv.farm.name} shows the strongest vegetation signal (NDVI ${(bestNdiv.metrics.ndvi! / 100).toFixed(2)}). Dense vegetation correlates with better crop vigor.`,
        icon: Satellite,
      });
    }

    const revSorted = [...selectedData].sort((a, b) => b.metrics.revenuePerHectare - a.metrics.revenuePerHectare);
    if (revSorted.length >= 2 && revSorted[0].metrics.revenuePerHectare > revSorted[revSorted.length - 1].metrics.revenuePerHectare) {
      result.push({
        id: "revenue-gap",
        type: "warning",
        title: "Revenue Per Hectare Gap",
        description: `${revSorted[0].farm.name} earns ${format(revSorted[0].metrics.revenuePerHectare)}/ha vs ${format(revSorted[revSorted.length - 1].metrics.revenuePerHectare)}/ha at ${revSorted[revSorted.length - 1].farm.name}. Analyze the crop mix behind the difference.`,
        icon: TrendingUp,
      });
    }

    return result;
  }, [selectedData, format]);

  const toggleFarm = (farmId: string) => {
    setSelectedFarms((prev) => {
      if (prev.includes(farmId)) return prev.filter((id) => id !== farmId);
      if (prev.length < 4) return [...prev, farmId];
      return prev;
    });
  };

  const isFull = selectedIds.length >= 4;

  const MetricBar = ({
    label,
    values,
    max,
    unit = "",
  }: {
    label: string;
    values: { farmId: string; value: number | null }[];
    max: number;
    unit?: string;
  }) => {
    // Data honesty: null values are "no data" and never plotted as a 0 bar.
    const numericValues = values
      .map((v) => v.value)
      .filter((n): n is number => n !== null);
    const bestValue = numericValues.length > 0 ? Math.max(...numericValues) : null;
    return (
      <div className="mb-4">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <div className="space-y-2 mt-2">
          {values.map((v) => {
            const farm = allFarms.find((f) => f.farm._id === v.farmId);
            if (v.value === null) {
              return (
                <div key={v.farmId} className="flex items-center gap-3">
                  <span className="w-32 text-xs text-muted-foreground truncate">{farm?.farm.name}</span>
                  <div className="flex-1 h-6 bg-muted/50 rounded-full flex items-center px-3">
                    <span className="text-xs text-muted-foreground/70">No data</span>
                  </div>
                </div>
              );
            }
            const isBest = v.value === bestValue && v.value > 0;
            return (
              <div key={v.farmId} className="flex items-center gap-3">
                <span className="w-32 text-xs text-muted-foreground truncate">{farm?.farm.name}</span>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${max > 0 ? Math.min(100, (v.value / max) * 100) : 0}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${isBest ? "bg-gradient-to-r from-green-500 to-emerald-600" : "bg-gradient-to-r from-primary/60 to-primary/80"}`}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium">
                    {unit === "currency" ? format(v.value) : `${Math.round(v.value)}${unit}`}
                    {isBest && <Award className="w-3 h-3 inline ml-1 text-amber-500" />}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Farm Comparison</h1>
              <p className="text-muted-foreground mt-1">
                Compare performance metrics across your farms side-by-side
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Export</Button>
              <Button variant="outline"><RefreshCw className="w-4 h-4 mr-2" />Refresh</Button>
            </div>
          </div>
        </motion.div>

        {/* Farm Selector */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Select Farms to Compare (1-4)</h3>
                <Button variant="outline" size="sm" onClick={() => setShowFarmSelector(!showFarmSelector)}>
                  {showFarmSelector ? (
                    <><ChevronUp className="w-4 h-4 mr-1" />Hide</>
                  ) : (
                    <><ChevronDown className="w-4 h-4 mr-1" />Change Selection</>
                  )}
                </Button>
              </div>

              {allFarms.length === 0 ? (
                <div className="text-center py-8">
                  <Sprout className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Register farms on the Farms page to compare them here</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3">
                    {selectedData.map(({ farm }) => (
                      <div key={farm._id} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20">
                        {farm.coverImage ? (
                          <div className="w-8 h-8 rounded-lg overflow-hidden">
                            <img src={farm.coverImage} alt={farm.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                            <Sprout className="w-4 h-4 text-primary" />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium">{farm.name}</p>
                          <p className="text-xs text-muted-foreground">{farm.size} {farm.sizeUnit}</p>
                        </div>
                        <button onClick={() => toggleFarm(farm._id)} className="ml-2 p-1 rounded-full hover:bg-primary/20 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {!isFull && (
                      <button
                        onClick={() => setShowFarmSelector(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border hover:border-primary/50 transition-colors"
                      >
                        <Plus className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Add Farm</span>
                      </button>
                    )}
                  </div>

                  <AnimatePresence>
                    {showFarmSelector && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4 pt-4 border-t border-border overflow-hidden"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          {allFarms.map(({ farm }) => {
                            const isSelected = selectedIds.includes(farm._id);
                            return (
                              <button
                                key={farm._id}
                                onClick={() => toggleFarm(farm._id)}
                                disabled={!isSelected && isFull}
                                className={`p-3 rounded-xl border transition-all text-left ${
                                  isSelected ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                                } ${!isSelected && isFull ? "opacity-50 cursor-not-allowed" : ""}`}
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  {farm.coverImage ? (
                                    <div className="w-10 h-10 rounded-lg overflow-hidden">
                                      <img src={farm.coverImage} alt={farm.name} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                      <Sprout className="w-5 h-5 text-primary" />
                                    </div>
                                  )}
                                  {isSelected && (
                                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                      <Check className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                                <p className="text-sm font-medium">{farm.name}</p>
                                <p className="text-xs text-muted-foreground">{farm.location}</p>
                                <p className="text-xs text-muted-foreground">{farm.size} {farm.sizeUnit}</p>
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {selectedData.length === 0 ? (
          <div className="text-center py-16">
            <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">No farms to compare</h3>
            <p className="text-muted-foreground mt-1">Add farms on the Farms page to get started</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <motion.div variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">{format(comparativeStats?.totalRevenue || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedData.length} farms</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Profit</p>
                    <p className={`text-2xl font-bold ${(comparativeStats?.totalProfit || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>{format(comparativeStats?.totalProfit || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Avg margin: {(comparativeStats?.avgMargin || 0).toFixed(1)}%</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Avg Crop Health</p>
                    <p className="text-2xl font-bold">
                      {comparativeStats?.avgCropHealth != null
                        ? `${Math.round(comparativeStats.avgCropHealth)}%`
                        : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Across selected farms</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Avg Livestock Health</p>
                    <p className="text-2xl font-bold">{Math.round(comparativeStats?.avgLivestockHealth || 0)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Healthy animals / total</p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* Metric Comparison Tabs */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
              <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit flex-wrap">
                {[
                  { id: "revenue" as const, label: "Revenue", icon: DollarSign },
                  { id: "profit" as const, label: "Profitability", icon: TrendingUp },
                  { id: "production" as const, label: "Production", icon: Wheat },
                  { id: "efficiency" as const, label: "Health & Sustainability", icon: BarChart3 },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setCompareMetric(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      compareMetric === tab.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Comparison Content */}
            <motion.div key={compareMetric} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {compareMetric === "revenue" && (
                <>
                  <Card className="border-border/50">
                    <CardHeader><CardTitle className="text-lg">Revenue Comparison</CardTitle></CardHeader>
                    <CardContent>
                      <MetricBar
                        label="Total Revenue"
                        values={selectedData.map((f) => ({ farmId: f.farm._id, value: f.metrics.revenue }))}
                        max={Math.max(...selectedData.map((f) => f.metrics.revenue)) * 1.1 || 1}
                        unit="currency"
                      />
                      <MetricBar
                        label="Revenue per Hectare"
                        values={selectedData.map((f) => ({ farmId: f.farm._id, value: f.metrics.revenuePerHectare }))}
                        max={Math.max(...selectedData.map((f) => f.metrics.revenuePerHectare)) * 1.1 || 1}
                        unit="currency"
                      />
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardHeader><CardTitle className="text-lg">Income Sources</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {selectedData.map(({ farm, metrics }) => (
                        <div key={farm._id} className="p-3 rounded-xl bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{farm.name}</span>
                            <Badge className={metrics.revenue > 0 ? "bg-green-500/10 text-green-600" : "bg-muted"}>
                              {metrics.revenue > 0 ? "Earning" : "No income"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div><p className="text-muted-foreground">Income</p><p className="font-medium">{format(metrics.revenue)}</p></div>
                            <div><p className="text-muted-foreground">Expenses</p><p className="font-medium">{format(metrics.expenses)}</p></div>
                            <div><p className="text-muted-foreground">Profit</p><p className={`font-medium ${metrics.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{format(metrics.profit)}</p></div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}

              {compareMetric === "profit" && (
                <>
                  <Card className="border-border/50">
                    <CardHeader><CardTitle className="text-lg">Profitability Analysis</CardTitle></CardHeader>
                    <CardContent>
                      <MetricBar
                        label="Total Profit"
                        values={selectedData.map((f) => ({ farmId: f.farm._id, value: f.metrics.profit }))}
                        max={Math.max(...selectedData.map((f) => f.metrics.profit)) * 1.1 || 1}
                        unit="currency"
                      />
                      <MetricBar
                        label="Profit Margin (%)"
                        values={selectedData.map((f) => ({ farmId: f.farm._id, value: f.metrics.profitMargin }))}
                        max={50}
                        unit="%"
                      />
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardHeader><CardTitle className="text-lg">Efficiency Ratios</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      {selectedData.map(({ farm, metrics }) => (
                        <div key={farm._id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                          <span className="text-sm font-medium">{farm.name}</span>
                          <div className="text-right text-sm">
                            <p>{format(metrics.revenuePerHectare)} / ha</p>
                            <p className="text-xs text-muted-foreground">{metrics.profitMargin.toFixed(1)}% margin</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}

              {compareMetric === "production" && (
                <>
                  <Card className="border-border/50">
                    <CardHeader><CardTitle className="text-lg">Production Metrics</CardTitle></CardHeader>
                    <CardContent>
                      <MetricBar
                        label="Active Crops"
                        values={selectedData.map((f) => ({ farmId: f.farm._id, value: f.metrics.activeCrops }))}
                        max={Math.max(...selectedData.map((f) => f.metrics.activeCrops)) * 1.2 || 1}
                      />
                      <MetricBar
                        label="Crop Diversity (types)"
                        values={selectedData.map((f) => ({ farmId: f.farm._id, value: f.metrics.cropDiversity }))}
                        max={Math.max(...selectedData.map((f) => f.metrics.cropDiversity)) * 1.2 || 1}
                      />
                      <MetricBar
                        label="Livestock Count"
                        values={selectedData.map((f) => ({ farmId: f.farm._id, value: f.metrics.livestockCount }))}
                        max={Math.max(...selectedData.map((f) => f.metrics.livestockCount)) * 1.2 || 1}
                      />
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardHeader><CardTitle className="text-lg">Health Overview</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                      {selectedData.map(({ farm, metrics }) => (
                        <div key={farm._id}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{farm.name}</span>
                            <span className="text-xs text-muted-foreground">{metrics.activeCrops} crops · {metrics.livestockCount} animals</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Crop health</p>
                              {metrics.cropHealth != null ? (
                                <div className="h-2 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full" style={{ width: `${metrics.cropHealth}%` }} />
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">No data yet</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Livestock health</p>
                              <div className="h-2 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full" style={{ width: `${metrics.livestockHealth}%` }} />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}

              {compareMetric === "efficiency" && (
                <>
                  <Card className="border-border/50">
                    <CardHeader><CardTitle className="text-lg">Health & Sustainability Scores</CardTitle></CardHeader>
                    <CardContent>
                      <MetricBar
                        label="Crop Health (%)"
                        values={selectedData
                          .filter((f) => f.metrics.cropHealth != null)
                          .map((f) => ({ farmId: f.farm._id, value: f.metrics.cropHealth as number }))}
                        max={100}
                        unit="%"
                      />
                      <MetricBar
                        label="Livestock Health (%)"
                        values={selectedData.map((f) => ({ farmId: f.farm._id, value: f.metrics.livestockHealth }))}
                        max={100}
                        unit="%"
                      />
                      <MetricBar
                        label="Soil Health (from pH)"
                        values={selectedData.map((f) => ({ farmId: f.farm._id, value: f.metrics.soilHealth }))}
                        max={100}
                        unit="%"
                      />
                      <MetricBar
                        label="Vegetation Index (NDVI)"
                        values={selectedData.map((f) => ({ farmId: f.farm._id, value: f.metrics.ndvi }))}
                        max={100}
                      />
                      {selectedData.every((f) => f.metrics.soilHealth === null && f.metrics.ndvi === null) && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Soil and satellite scores appear once soil data or satellite imagery has been fetched for a farm.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardHeader><CardTitle className="text-lg">Farm Details</CardTitle></CardHeader>
                    <CardContent className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Farm</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Size</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Location</th>
                            <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedData.map(({ farm }) => (
                            <tr key={farm._id} className="border-b border-border/50 last:border-0">
                              <td className="py-3 px-4 font-medium">{farm.name}</td>
                              <td className="py-3 px-4">{farm.size} {farm.sizeUnit}</td>
                              <td className="py-3 px-4 text-muted-foreground">{farm.location}</td>
                              <td className="py-3 px-4">
                                <Badge variant={farm.status === "active" ? "default" : "secondary"}>{farm.status}</Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </>
              )}
            </motion.div>

            {/* Insights Section */}
            {insights.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mb-6">
                <Card className="border-border/50">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      Insights & Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {insights.map((insight) => {
                      const Icon = insight.icon;
                      const isExpanded = expandedInsight === insight.id;
                      return (
                        <div
                          key={insight.id}
                          className={`p-4 rounded-xl border transition-all cursor-pointer ${
                            insight.type === "success"
                              ? "border-green-500/20 bg-green-500/5"
                              : insight.type === "warning"
                              ? "border-amber-500/20 bg-amber-500/5"
                              : "border-blue-500/20 bg-blue-500/5"
                          }`}
                          onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${insight.type === "success" ? "bg-green-500/10 text-green-600" : insight.type === "warning" ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600"}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium">{insight.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                            </div>
                            {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
