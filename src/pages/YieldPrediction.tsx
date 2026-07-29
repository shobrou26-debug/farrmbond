import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  Target,
  Leaf,
  Calendar,
  Cloud,
  Droplets,
  Sun,
  BarChart3,
  CheckCircle2,
  Download,
  Zap,
  Inbox,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface YieldFactor {
  name: string;
  impact: number;
  description: string;
}

interface YieldPredictionItem {
  id: string;
  cropName: string;
  variety: string;
  farm: string;
  plantingDate: string;
  expectedHarvest: string;
  predictedYield: number;
  targetYield: number;
  unit: string;
  confidence: number;
  factors: YieldFactor[];
  weatherImpact: number;
  recommendations: string[];
  status: "excellent" | "good" | "average" | "poor";
}

// ============================================================
// Yield Status Config
// ============================================================

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  excellent: { label: "Excellent", color: "text-green-600", bgColor: "bg-green-500/10" },
  good: { label: "Good", color: "text-blue-600", bgColor: "bg-blue-500/10" },
  average: { label: "Average", color: "text-amber-600", bgColor: "bg-amber-500/10" },
  poor: { label: "Poor", color: "text-red-600", bgColor: "bg-red-500/10" },
};

function getStatus(yield_: number, target: number): "excellent" | "good" | "average" | "poor" {
  const ratio = yield_ / target;
  if (ratio >= 1.1) return "excellent";
  if (ratio >= 0.9) return "good";
  if (ratio >= 0.7) return "average";
  return "poor";
}

// ============================================================
// Yield Prediction Card
// ============================================================

function YieldPredictionCard({
  prediction,
  isSelected,
  onSelect,
}: {
  prediction: YieldPredictionItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const config = statusConfig[prediction.status];
  const progress = (prediction.predictedYield / prediction.targetYield) * 100;
  const isOnTrack = prediction.predictedYield >= prediction.targetYield * 0.9;

  return (
    <Card
      className={`border-border/50 card-hover cursor-pointer transition-all ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-500/10">
              <Leaf className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">{prediction.cropName}</h3>
              <p className="text-xs text-muted-foreground">{prediction.variety} • {prediction.farm}</p>
            </div>
          </div>
          <Badge className={`${config.bgColor} ${config.color}`}>{config.label}</Badge>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">Predicted Yield</span>
            <span className="font-bold">{prediction.predictedYield.toLocaleString()} {prediction.unit}</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                isOnTrack ? "bg-green-500" : "bg-amber-500"
              }`}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
            <span>Target: {prediction.targetYield.toLocaleString()} {prediction.unit}</span>
            <span>{progress.toFixed(0)}% of target</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className="text-lg font-bold text-primary">{prediction.confidence}%</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-xs text-muted-foreground">Weather Impact</p>
            <p className={`text-lg font-bold ${
              prediction.weatherImpact >= 70 ? "text-green-600" : "text-amber-600"
            }`}>
              {prediction.weatherImpact}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Factor Analysis
// ============================================================

function FactorAnalysis({ factors }: { factors: YieldFactor[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Yield Factor Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {factors.map((factor, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">{factor.name}</span>
              <span className={`text-sm font-bold ${
                factor.impact >= 70 ? "text-green-600" : factor.impact >= 50 ? "text-amber-600" : "text-red-600"
              }`}>
                {factor.impact}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-1">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  factor.impact >= 70 ? "bg-green-500" : factor.impact >= 50 ? "bg-amber-500" : "bg-red-500"
                }`}
                style={{ width: `${factor.impact}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{factor.description}</p>
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Weather Impact Panel
// ============================================================

function WeatherImpactPanel({ impact }: { impact: number }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Cloud className="w-4 h-4 text-blue-500" />
          Weather Impact Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center mb-4">
          <div className="relative inline-flex items-center justify-center w-24 h-24">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-muted" />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                fill="none"
                className={impact >= 70 ? "text-green-500" : "text-amber-500"}
                strokeDasharray={`${(impact / 100) * 251} 251`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-2xl font-bold">{impact}%</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Overall Weather Score</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Sun className="w-4 h-4 text-orange-500" />
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground">Temperature</p>
              <p className="text-sm font-medium">Good</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Droplets className="w-4 h-4 text-blue-500" />
            <div className="flex-1">
              <p className="text-[10px] text-muted-foreground">Rainfall</p>
              <p className="text-sm font-medium">Adequate</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Recommendations Panel
// ============================================================

function RecommendationsPanel({ recommendations }: { recommendations: string[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          AI Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-primary/5">
            <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm">{rec}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Empty State
// ============================================================

function EmptyState() {
  return (
    <Card className="border-border/50">
      <CardContent className="p-12 text-center">
        <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted mx-auto mb-4">
          <Inbox className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Predictions Yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Add crops to your farms and AI will automatically generate yield predictions based on your data, soil conditions, and weather patterns.
        </p>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Yield Prediction Page
// ============================================================

export default function YieldPrediction() {
  // Real Convex data (paginated — extract .page from results)
  const predictionsResult = useQuery(api.yieldPredictions.listUserPredictions, {});
  const farmsResult = useQuery(api.farms.listUserFarms, {});
  const cropsResult = useQuery(api.crops.listUserCrops, {});
  const predictionsData = predictionsResult?.page ?? [];
  const farms = farmsResult?.page ?? [];
  const crops = cropsResult?.page ?? [];

  const isLoading = predictionsResult === undefined;

  // Map Convex predictions to local format with enriched crop/farm data
  const predictions: YieldPredictionItem[] = useMemo(() => {
    if (!predictionsData || !crops || !farms) return [];
    return predictionsData.map((p: any) => {
      const crop = crops.find((c: any) => c._id === p.cropId);
      const farm = farms.find((f: any) => f._id === p.farmId);
      const targetYield = crop?.expectedYield || p.predictedYield * 1.1;
      const status = getStatus(p.predictedYield, targetYield);
      return {
        id: p._id,
        cropName: crop?.name || "Unknown Crop",
        variety: crop?.variety || "",
        farm: farm?.name || "Unknown Farm",
        plantingDate: new Date(crop?.plantingDate || 0).toISOString().split("T")[0],
        expectedHarvest: crop?.expectedHarvestDate
          ? new Date(crop.expectedHarvestDate).toISOString().split("T")[0]
          : "",
        predictedYield: p.predictedYield,
        targetYield,
        unit: p.unit,
        confidence: p.confidence,
        factors: p.factors.map((f: any) => ({
          name: f.name,
          impact: Math.round((f.impact + 100) / 2), // Convert -100..100 to 0..100
          description: f.description,
        })),
        weatherImpact: p.weatherImpact || 70,
        recommendations: p.factors
          .filter((f: any) => f.impact < 50)
          .map((f: any) => `Improve ${f.name.toLowerCase()}: ${f.description}`),
        status,
      };
    });
  }, [predictionsData, crops, farms]);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedPrediction = useMemo(
    () => predictions.find((p) => p.id === selectedId) || predictions[0],
    [predictions, selectedId]
  );

  // Summary stats
  const totalPredicted = predictions.reduce((sum, p) => sum + p.predictedYield, 0);
  const totalTarget = predictions.reduce((sum, p) => sum + p.targetYield, 0);
  const avgConfidence = predictions.length > 0
    ? Math.round(predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length)
    : 0;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Yield Prediction</h1>
              <p className="text-muted-foreground mt-1">
                AI-powered crop yield forecasting based on historical data and weather patterns
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-6"
        >
          {/* Summary Stats */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-border/50">
                  <CardContent className="p-5">
                    <Skeleton className="h-12 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-border/50">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-500">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Predicted</p>
                    <p className="text-2xl font-bold">{totalPredicted.toLocaleString()} kg</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500">
                    <Target className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Target Yield</p>
                    <p className="text-2xl font-bold">{totalTarget.toLocaleString()} kg</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Confidence</p>
                    <p className="text-2xl font-bold">{avgConfidence}%</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500">
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Crops</p>
                    <p className="text-2xl font-bold">{predictions.length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Main Content */}
          {isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-64 w-full" />
                  ))}
                </div>
              </div>
              <div className="space-y-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            </div>
          ) : predictions.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Crop Predictions</h2>
                  <Badge variant="secondary">{predictions.length} Active</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {predictions.map((prediction) => (
                    <YieldPredictionCard
                      key={prediction.id}
                      prediction={prediction}
                      isSelected={selectedId === prediction.id || (!selectedId && prediction.id === predictions[0]?.id)}
                      onSelect={() => setSelectedId(prediction.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {selectedPrediction && (
                  <>
                    <WeatherImpactPanel impact={selectedPrediction.weatherImpact} />
                    <FactorAnalysis factors={selectedPrediction.factors} />
                    <RecommendationsPanel recommendations={selectedPrediction.recommendations} />
                  </>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}
