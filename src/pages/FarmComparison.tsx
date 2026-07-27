import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  Beef,
  Wheat,
  DollarSign,
  Droplets,
  Leaf,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Award,
  AlertTriangle,
  Lightbulb,
  Download,
  RefreshCw,
  X,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

// ============================================================
// Types
// ============================================================
interface Farm {
  id: string;
  name: string;
  location: string;
  area: number;
  areaUnit: string;
  established: string;
  image: string;
  primaryCrops: string[];
  livestock: string[];
}

interface FarmMetrics {
  farmId: string;
  // Financial
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
  revenuePerHectare: number;
  // Production
  totalYield: number;
  yieldPerHectare: number;
  cropDiversity: number;
  livestockCount: number;
  // Efficiency
  waterEfficiency: number;
  fertilizerEfficiency: number;
  laborProductivity: number;
  // Sustainability
  soilHealth: number;
  carbonFootprint: number;
  biodiversityScore: number;
  // Monthly revenue data for charts
  monthlyRevenue: number[];
  monthlyExpenses: number[];
  // Crop yields
  cropYields: { crop: string; yield: number; target: number }[];
}

// ============================================================
// Mock Data
// ============================================================
const farms: Farm[] = [
  {
    id: "f1",
    name: "Sunrise Ranch",
    location: "Nakuru, Kenya",
    area: 45,
    areaUnit: "hectares",
    established: "2018",
    image: "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&q=80",
    primaryCrops: ["Maize", "Wheat", "Beans"],
    livestock: ["Cattle", "Sheep"],
  },
  {
    id: "f2",
    name: "Green Valley Farm",
    location: "Kiambu, Kenya",
    area: 28,
    areaUnit: "hectares",
    established: "2020",
    image: "https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=400&q=80",
    primaryCrops: ["Tomatoes", "Kale", "Cabbage"],
    livestock: ["Poultry"],
  },
  {
    id: "f3",
    name: "Riverside Fields",
    location: "Meru, Kenya",
    area: 35,
    areaUnit: "hectares",
    established: "2019",
    image: "https://images.unsplash.com/photo-1530836369250-ef72a3f5cda8?w=400&q=80",
    primaryCrops: ["Coffee", "Tea", "Avocado"],
    livestock: ["Goats"],
  },
  {
    id: "f4",
    name: "Highland Homestead",
    location: "Uasin Gishu, Kenya",
    area: 62,
    areaUnit: "hectares",
    established: "2015",
    image: "https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=400&q=80",
    primaryCrops: ["Wheat", "Barley", "Canola"],
    livestock: ["Cattle"],
  },
  {
    id: "f5",
    name: "Valley View Estate",
    location: "Nyeri, Kenya",
    area: 18,
    areaUnit: "hectares",
    established: "2021",
    image: "https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=400&q=80",
    primaryCrops: ["Strawberry", "Blueberry", "Herbs"],
    livestock: [],
  },
];

const farmMetrics: FarmMetrics[] = [
  {
    farmId: "f1",
    revenue: 4500000,
    expenses: 2800000,
    profit: 1700000,
    profitMargin: 37.8,
    revenuePerHectare: 100000,
    totalYield: 180,
    yieldPerHectare: 4.0,
    cropDiversity: 3,
    livestockCount: 30,
    waterEfficiency: 78,
    fertilizerEfficiency: 82,
    laborProductivity: 85,
    soilHealth: 88,
    carbonFootprint: 65,
    biodiversityScore: 72,
    monthlyRevenue: [320, 280, 380, 420, 480, 520, 450, 380, 420, 480, 520, 450],
    monthlyExpenses: [200, 180, 250, 280, 300, 320, 280, 250, 280, 300, 320, 280],
    cropYields: [
      { crop: "Maize", yield: 4.5, target: 4.0 },
      { crop: "Wheat", yield: 3.2, target: 3.5 },
      { crop: "Beans", yield: 1.8, target: 1.5 },
    ],
  },
  {
    farmId: "f2",
    revenue: 3200000,
    expenses: 1900000,
    profit: 1300000,
    profitMargin: 40.6,
    revenuePerHectare: 114286,
    totalYield: 140,
    yieldPerHectare: 5.0,
    cropDiversity: 3,
    livestockCount: 350,
    waterEfficiency: 85,
    fertilizerEfficiency: 88,
    laborProductivity: 82,
    soilHealth: 85,
    carbonFootprint: 72,
    biodiversityScore: 78,
    monthlyRevenue: [220, 240, 280, 320, 350, 380, 320, 280, 320, 350, 380, 320],
    monthlyExpenses: [120, 130, 150, 170, 180, 190, 170, 150, 170, 180, 190, 170],
    cropYields: [
      { crop: "Tomatoes", yield: 28, target: 25 },
      { crop: "Kale", yield: 15, target: 12 },
      { crop: "Cabbage", yield: 22, target: 20 },
    ],
  },
  {
    farmId: "f3",
    revenue: 2800000,
    expenses: 1600000,
    profit: 1200000,
    profitMargin: 42.9,
    revenuePerHectare: 80000,
    totalYield: 95,
    yieldPerHectare: 2.7,
    cropDiversity: 3,
    livestockCount: 15,
    waterEfficiency: 72,
    fertilizerEfficiency: 75,
    laborProductivity: 78,
    soilHealth: 92,
    carbonFootprint: 80,
    biodiversityScore: 88,
    monthlyRevenue: [180, 200, 220, 240, 260, 280, 260, 240, 260, 280, 300, 280],
    monthlyExpenses: [100, 110, 120, 130, 140, 150, 140, 130, 140, 150, 160, 150],
    cropYields: [
      { crop: "Coffee", yield: 1.2, target: 1.5 },
      { crop: "Tea", yield: 3.5, target: 3.0 },
      { crop: "Avocado", yield: 8, target: 10 },
    ],
  },
  {
    farmId: "f4",
    revenue: 5200000,
    expenses: 3100000,
    profit: 2100000,
    profitMargin: 40.4,
    revenuePerHectare: 83871,
    totalYield: 220,
    yieldPerHectare: 3.5,
    cropDiversity: 3,
    livestockCount: 45,
    waterEfficiency: 82,
    fertilizerEfficiency: 85,
    laborProductivity: 88,
    soilHealth: 86,
    carbonFootprint: 68,
    biodiversityScore: 70,
    monthlyRevenue: [380, 400, 450, 500, 550, 580, 520, 480, 500, 550, 600, 550],
    monthlyExpenses: [220, 240, 270, 300, 330, 350, 320, 290, 300, 330, 360, 330],
    cropYields: [
      { crop: "Wheat", yield: 3.8, target: 3.5 },
      { crop: "Barley", yield: 3.2, target: 3.0 },
      { crop: "Canola", yield: 2.1, target: 2.0 },
    ],
  },
  {
    farmId: "f5",
    revenue: 1800000,
    expenses: 1100000,
    profit: 700000,
    profitMargin: 38.9,
    revenuePerHectare: 100000,
    totalYield: 45,
    yieldPerHectare: 2.5,
    cropDiversity: 3,
    livestockCount: 0,
    waterEfficiency: 90,
    fertilizerEfficiency: 92,
    laborProductivity: 75,
    soilHealth: 90,
    carbonFootprint: 85,
    biodiversityScore: 82,
    monthlyRevenue: [120, 140, 160, 180, 200, 220, 200, 180, 160, 140, 120, 100],
    monthlyExpenses: [70, 80, 90, 100, 110, 120, 110, 100, 90, 80, 70, 60],
    cropYields: [
      { crop: "Strawberry", yield: 12, target: 15 },
      { crop: "Blueberry", yield: 5, target: 6 },
      { crop: "Herbs", yield: 2.5, target: 2.0 },
    ],
  },
];

// ============================================================
// Helpers
// ============================================================
const formatCurrency = (value: number) => {
  if (value >= 1000000) return `KES ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `KES ${(value / 1000).toFixed(0)}K`;
  return `KES ${value}`;
};

const formatNumber = (value: number) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toString();
};

const getComparisonWinner = (metric: string) => {
  const values = farmMetrics.map((m) => m[metric as keyof FarmMetrics] as number);
  const max = Math.max(...values);
  return farmMetrics.findIndex((m) => m[metric as keyof FarmMetrics] === max);
};

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
  const [selectedFarms, setSelectedFarms] = useState<string[]>(["f1", "f2", "f3"]);
  const [compareMetric, setCompareMetric] = useState<"revenue" | "profit" | "yield" | "efficiency">("revenue");
  const [showFarmSelector, setShowFarmSelector] = useState(false);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  // Get selected farm data
  const selectedFarmData = useMemo(() => {
    return selectedFarms
      .map((id) => {
        const farm = farms.find((f) => f.id === id);
        const metrics = farmMetrics.find((m) => m.farmId === id);
        return farm && metrics ? { ...farm, metrics } : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [selectedFarms]);

  // Calculate comparative stats
  const comparativeStats = useMemo(() => {
    if (selectedFarmData.length === 0) return null;

    const totalRevenue = selectedFarmData.reduce((sum, f) => sum + f.metrics.revenue, 0);
    const totalExpenses = selectedFarmData.reduce((sum, f) => sum + f.metrics.expenses, 0);
    const totalProfit = selectedFarmData.reduce((sum, f) => sum + f.metrics.profit, 0);
    const avgProfitMargin = selectedFarmData.reduce((sum, f) => sum + f.metrics.profitMargin, 0) / selectedFarmData.length;
    const avgRevenuePerHectare = selectedFarmData.reduce((sum, f) => sum + f.metrics.revenuePerHectare, 0) / selectedFarmData.length;
    const avgWaterEfficiency = selectedFarmData.reduce((sum, f) => sum + f.metrics.waterEfficiency, 0) / selectedFarmData.length;
    const avgSoilHealth = selectedFarmData.reduce((sum, f) => sum + f.metrics.soilHealth, 0) / selectedFarmData.length;

    return {
      totalRevenue,
      totalExpenses,
      totalProfit,
      avgProfitMargin,
      avgRevenuePerHectare,
      avgWaterEfficiency,
      avgSoilHealth,
    };
  }, [selectedFarmData]);

  // Generate insights
  const insights = useMemo(() => {
    if (selectedFarmData.length < 2) return [];

    const result = [];

    // Best performer
    const bestProfit = [...selectedFarmData].sort((a, b) => b.metrics.profitMargin - a.metrics.profitMargin)[0];
    result.push({
      id: "best-margin",
      type: "success",
      title: "Highest Profit Margin",
      description: `${bestProfit.name} leads with ${bestProfit.metrics.profitMargin.toFixed(1)}% profit margin. Consider adopting their cost management strategies.`,
      icon: Award,
    });

    // Improvement opportunity
    const lowestWater = [...selectedFarmData].sort((a, b) => a.metrics.waterEfficiency - b.metrics.waterEfficiency)[0];
    if (lowestWater.metrics.waterEfficiency < 80) {
      result.push({
        id: "water-improvement",
        type: "warning",
        title: "Water Efficiency Gap",
        description: `${lowestWater.name} has ${lowestWater.metrics.waterEfficiency}% water efficiency. Implementing drip irrigation could improve yield by 15-20%.`,
        icon: Droplets,
      });
    }

    // Best sustainability
    const bestSustainability = [...selectedFarmData].sort(
      (a, b) => b.metrics.soilHealth + b.metrics.biodiversityScore - (a.metrics.soilHealth + a.metrics.biodiversityScore)
    )[0];
    result.push({
      id: "best-sustainability",
      type: "info",
      title: "Sustainability Leader",
      description: `${bestSustainability.name} excels in environmental practices with ${bestSustainability.metrics.soilHealth}% soil health and ${bestSustainability.metrics.biodiversityScore}% biodiversity score.`,
      icon: Leaf,
    });

    // Revenue per hectare comparison
    const revenuePerHectare = [...selectedFarmData].sort((a, b) => b.metrics.revenuePerHectare - a.metrics.revenuePerHectare);
    if (revenuePerHectare[0].metrics.revenuePerHectare - revenuePerHectare[revenuePerHectare.length - 1].metrics.revenuePerHectare > 20000) {
      result.push({
        id: "revenue-gap",
        type: "warning",
        title: "Revenue Per Hectare Gap",
        description: `Significant difference of KES ${((revenuePerHectare[0].metrics.revenuePerHectare - revenuePerHectare[revenuePerHectare.length - 1].metrics.revenuePerHectare) / 1000).toFixed(0)}K/ha between farms. Analyze high-performer's crop mix and practices.`,
        icon: TrendingUp,
      });
    }

    return result;
  }, [selectedFarmData]);

  // Toggle farm selection
  const toggleFarm = (farmId: string) => {
    setSelectedFarms((prev) => {
      if (prev.includes(farmId)) {
        return prev.filter((id) => id !== farmId);
      }
      if (prev.length < 4) {
        return [...prev, farmId];
      }
      return prev;
    });
  };

  // Metric comparison bar
  const MetricBar = ({
    label,
    values,
    max,
    unit = "",
    higherIsBetter = true,
  }: {
    label: string;
    values: { farmId: string; value: number }[];
    max: number;
    unit?: string;
    higherIsBetter?: boolean;
  }) => {
    const bestValue = higherIsBetter ? Math.max(...values.map((v) => v.value)) : Math.min(...values.map((v) => v.value));
    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <div className="space-y-2">
          {values.map((v) => {
            const farm = farms.find((f) => f.id === v.farmId);
            const isBest = v.value === bestValue;
            return (
              <div key={v.farmId} className="flex items-center gap-3">
                <span className="w-32 text-xs text-muted-foreground truncate">{farm?.name}</span>
                <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(v.value / max) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${isBest ? "bg-gradient-to-r from-green-500 to-emerald-600" : "bg-gradient-to-r from-primary/60 to-primary/80"}`}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium">
                    {unit === "KES" ? formatCurrency(v.value) : `${v.value}${unit}`}
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

  // Monthly trend chart (simplified bar chart)
  const MonthlyTrend = ({ farmId, label }: { farmId: string; label: string }) => {
    const metrics = farmMetrics.find((m) => m.farmId === farmId);
    if (!metrics) return null;
    const max = Math.max(...metrics.monthlyRevenue);
    const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

    return (
      <div className="flex items-end gap-1 h-24">
        {metrics.monthlyRevenue.map((rev, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(rev / max) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="w-full rounded-t bg-primary/80 hover:bg-primary transition-colors"
              title={`${months[i]}: KES ${rev}K`}
            />
            <span className="text-[10px] text-muted-foreground">{months[i]}</span>
          </div>
        ))}
      </div>
    );
  };

  // Radar chart component (simplified)
  const EfficiencyRadar = ({ farms: f }: { farms: Farm[] }) => {
    const metrics = ["waterEfficiency", "fertilizerEfficiency", "laborProductivity", "soilHealth", "biodiversityScore"] as const;
    const labels = ["Water", "Fertilizer", "Labor", "Soil", "Biodiversity"];

    return (
      <div className="grid grid-cols-5 gap-2 text-center">
        {labels.map((label, i) => (
          <div key={label}>
            <p className="text-xs text-muted-foreground mb-2">{label}</p>
            {f.map((farm, idx) => {
              const metricsData = farmMetrics.find((m) => m.farmId === farm.id);
              const value = metricsData ? metricsData[metrics[i]] : 0;
              const colors = ["bg-primary", "bg-emerald-500", "bg-amber-500", "bg-blue-500", "bg-purple-500"];
              return (
                <div key={farm.id} className="mb-1">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${value}%` }}
                      transition={{ duration: 0.6, delay: idx * 0.1 }}
                      className={`h-full ${colors[idx % colors.length]}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{value}%</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1600px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Farm Comparison</h1>
              <p className="text-muted-foreground mt-1">
                Compare performance metrics across your farms side-by-side
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
              <Button variant="outline">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Farm Selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">Select Farms to Compare (2-4)</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFarmSelector(!showFarmSelector)}
                >
                  {showFarmSelector ? (
                    <>
                      <ChevronUp className="w-4 h-4 mr-1" />
                      Hide
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4 mr-1" />
                      Change Selection
                    </>
                  )}
                </Button>
              </div>

              {/* Selected Farms */}
              <div className="flex flex-wrap gap-3">
                {selectedFarmData.map((farm) => (
                  <div
                    key={farm.id}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20"
                  >
                    <div className="w-8 h-8 rounded-lg overflow-hidden">
                      <img
                        src={farm.image}
                        alt={farm.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{farm.name}</p>
                      <p className="text-xs text-muted-foreground">{farm.area} ha</p>
                    </div>
                    <button
                      onClick={() => toggleFarm(farm.id)}
                      className="ml-2 p-1 rounded-full hover:bg-primary/20 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {selectedFarms.length < 4 && (
                  <button
                    onClick={() => setShowFarmSelector(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-border hover:border-primary/50 transition-colors"
                  >
                    <Plus className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Add Farm</span>
                  </button>
                )}
              </div>

              {/* Farm Selector Dropdown */}
              <AnimatePresence>
                {showFarmSelector && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-border overflow-hidden"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                      {farms.map((farm) => {
                        const isSelected = selectedFarms.includes(farm.id);
                        return (
                          <button
                            key={farm.id}
                            onClick={() => toggleFarm(farm.id)}
                            disabled={!isSelected && selectedFarms.length >= 4}
                            className={`p-3 rounded-xl border transition-all text-left ${
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-primary/30"
                            } ${!isSelected && selectedFarms.length >= 4 ? "opacity-50 cursor-not-allowed" : ""}`}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-10 h-10 rounded-lg overflow-hidden">
                                <img
                                  src={farm.image}
                                  alt={farm.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="w-3 h-3 text-white" />
                                </div>
                              )}
                            </div>
                            <p className="text-sm font-medium">{farm.name}</p>
                            <p className="text-xs text-muted-foreground">{farm.location}</p>
                            <p className="text-xs text-muted-foreground">{farm.area} ha</p>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>

        {selectedFarmData.length < 2 ? (
          <div className="text-center py-16">
            <BarChart3 className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium">Select at least 2 farms</h3>
            <p className="text-muted-foreground mt-1">Choose farms from the selector above to start comparing</p>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
            >
              <motion.div variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Revenue</p>
                    <p className="text-2xl font-bold">{formatCurrency(comparativeStats?.totalRevenue || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">{selectedFarms.length} farms</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Total Profit</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(comparativeStats?.totalProfit || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Avg margin: {(comparativeStats?.avgProfitMargin || 0).toFixed(1)}%</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Avg Revenue/Ha</p>
                    <p className="text-2xl font-bold">{formatCurrency(comparativeStats?.avgRevenuePerHectare || 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Per hectare</p>
                  </CardContent>
                </Card>
              </motion.div>
              <motion.div variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-sm text-muted-foreground">Avg Water Efficiency</p>
                    <p className="text-2xl font-bold">{(comparativeStats?.avgWaterEfficiency || 0).toFixed(0)}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Across all farms</p>
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>

            {/* Metric Comparison Tabs */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-6"
            >
              <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
                {[
                  { id: "revenue" as const, label: "Revenue", icon: DollarSign },
                  { id: "profit" as const, label: "Profitability", icon: TrendingUp },
                  { id: "yield" as const, label: "Production", icon: Wheat },
                  { id: "efficiency" as const, label: "Efficiency", icon: BarChart3 },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setCompareMetric(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      compareMetric === tab.id
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Comparison Content */}
            <motion.div
              key={compareMetric}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
            >
              {/* Revenue Comparison */}
              {compareMetric === "revenue" && (
                <>
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Revenue Comparison</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MetricBar
                        label="Total Revenue (KES)"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.revenue,
                        }))}
                        max={Math.max(...selectedFarmData.map((f) => f.metrics.revenue)) * 1.1}
                      />
                      <MetricBar
                        label="Revenue per Hectare"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.revenuePerHectare,
                        }))}
                        max={Math.max(...selectedFarmData.map((f) => f.metrics.revenuePerHectare)) * 1.1}
                        unit="KES"
                      />
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Monthly Revenue Trend</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedFarmData.map((farm, idx) => (
                        <div key={farm.id} className="mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${idx === 0 ? "bg-primary" : idx === 1 ? "bg-emerald-500" : idx === 2 ? "bg-amber-500" : "bg-blue-500"}`} />
                            <span className="text-sm font-medium">{farm.name}</span>
                          </div>
                          <MonthlyTrend farmId={farm.id} label={farm.name} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Profit Comparison */}
              {compareMetric === "profit" && (
                <>
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Profitability Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MetricBar
                        label="Total Profit (KES)"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.profit,
                        }))}
                        max={Math.max(...selectedFarmData.map((f) => f.metrics.profit)) * 1.1}
                      />
                      <MetricBar
                        label="Profit Margin (%)"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.profitMargin,
                        }))}
                        max={50}
                        unit="%"
                      />
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Revenue vs Expenses</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedFarmData.map((farm) => (
                        <div key={farm.id} className="p-3 rounded-xl bg-muted/30">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">{farm.name}</span>
                            <Badge className={farm.metrics.profitMargin >= 40 ? "bg-green-500/10 text-green-600" : "bg-amber-500/10 text-amber-600"}>
                              {farm.metrics.profitMargin.toFixed(1)}%
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Revenue</p>
                              <p className="font-medium">{formatCurrency(farm.metrics.revenue)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Expenses</p>
                              <p className="font-medium">{formatCurrency(farm.metrics.expenses)}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Profit</p>
                              <p className="font-medium text-green-600">{formatCurrency(farm.metrics.profit)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Yield Comparison */}
              {compareMetric === "yield" && (
                <>
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Production Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MetricBar
                        label="Total Yield (tons)"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.totalYield,
                        }))}
                        max={Math.max(...selectedFarmData.map((f) => f.metrics.totalYield)) * 1.1}
                        unit="t"
                      />
                      <MetricBar
                        label="Yield per Hectare"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.yieldPerHectare,
                        }))}
                        max={Math.max(...selectedFarmData.map((f) => f.metrics.yieldPerHectare)) * 1.1}
                        unit="t/ha"
                      />
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Crop Performance</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedFarmData.map((farm) => (
                        <div key={farm.id}>
                          <h4 className="text-sm font-medium mb-2">{farm.name}</h4>
                          <div className="space-y-2">
                            {farm.metrics.cropYields.map((crop) => {
                              const achievement = (crop.yield / crop.target) * 100;
                              return (
                                <div key={crop.crop} className="flex items-center gap-3">
                                  <span className="w-20 text-xs text-muted-foreground">{crop.crop}</span>
                                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden relative">
                                    <div className="absolute inset-0 flex">
                                      <div className="w-full border-r-2 border-dashed border-muted-foreground/30" style={{ width: "100%" }} />
                                    </div>
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${Math.min(achievement, 100)}%` }}
                                      transition={{ duration: 0.8 }}
                                      className={`h-full rounded-full ${achievement >= 100 ? "bg-green-500" : achievement >= 80 ? "bg-amber-500" : "bg-red-500"}`}
                                    />
                                  </div>
                                  <span className="text-xs font-medium w-12 text-right">{achievement.toFixed(0)}%</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Efficiency Comparison */}
              {compareMetric === "efficiency" && (
                <>
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Efficiency Metrics</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MetricBar
                        label="Water Efficiency (%)"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.waterEfficiency,
                        }))}
                        max={100}
                        unit="%"
                      />
                      <MetricBar
                        label="Fertilizer Efficiency (%)"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.fertilizerEfficiency,
                        }))}
                        max={100}
                        unit="%"
                      />
                      <MetricBar
                        label="Labor Productivity (%)"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.laborProductivity,
                        }))}
                        max={100}
                        unit="%"
                      />
                    </CardContent>
                  </Card>
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-lg">Sustainability Scores</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <MetricBar
                        label="Soil Health (%)"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.soilHealth,
                        }))}
                        max={100}
                        unit="%"
                      />
                      <MetricBar
                        label="Carbon Footprint Score"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.carbonFootprint,
                        }))}
                        max={100}
                      />
                      <MetricBar
                        label="Biodiversity Score"
                        values={selectedFarmData.map((f) => ({
                          farmId: f.id,
                          value: f.metrics.biodiversityScore,
                        }))}
                        max={100}
                      />
                    </CardContent>
                  </Card>
                </>
              )}
            </motion.div>

            {/* Insights Section */}
            {insights.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-6"
              >
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
                            <div
                              className={`p-2 rounded-lg ${
                                insight.type === "success"
                                  ? "bg-green-500/10 text-green-600"
                                  : insight.type === "warning"
                                  ? "bg-amber-500/10 text-amber-600"
                                  : "bg-blue-500/10 text-blue-600"
                              }`}
                            >
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <h4 className="font-medium">{insight.title}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Farm Details Table */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Farm Details Comparison</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Metric</th>
                        {selectedFarmData.map((farm) => (
                          <th key={farm.id} className="text-center py-3 px-4 text-sm font-medium">
                            {farm.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Area", key: "area", format: (v: number, farm: typeof selectedFarmData[0]) => `${v} ${farm.areaUnit}` },
                        { label: "Established", key: "established", format: (v: string) => v },
                        { label: "Primary Crops", key: "primaryCrops", format: (v: string[]) => v.join(", ") },
                        { label: "Revenue", key: "revenue", format: (v: number) => formatCurrency(v) },
                        { label: "Profit", key: "profit", format: (v: number) => formatCurrency(v) },
                        { label: "Profit Margin", key: "profitMargin", format: (v: number) => `${v.toFixed(1)}%` },
                        { label: "Revenue/Ha", key: "revenuePerHectare", format: (v: number) => formatCurrency(v) },
                        { label: "Total Yield", key: "totalYield", format: (v: number) => `${v} tons` },
                        { label: "Livestock Count", key: "livestockCount", format: (v: number) => v.toString() },
                        { label: "Soil Health", key: "soilHealth", format: (v: number) => `${v}%` },
                        { label: "Water Efficiency", key: "waterEfficiency", format: (v: number) => `${v}%` },
                      ].map((row, idx) => (
                        <tr key={row.key} className={idx % 2 === 0 ? "bg-muted/30" : ""}>
                          <td className="py-3 px-4 text-sm font-medium">{row.label}</td>
                          {selectedFarmData.map((farm) => {
                            const value = farm[row.key as keyof typeof farm];
                            const metricsValue = farm.metrics[row.key as keyof typeof farm.metrics];
                            const displayValue = value !== undefined ? value : metricsValue;
                            return (
                              <td key={farm.id} className="text-center py-3 px-4 text-sm">
                                {row.format(displayValue as never, farm)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </motion.div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
