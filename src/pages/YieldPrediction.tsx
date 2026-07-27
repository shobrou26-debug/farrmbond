import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Leaf,
  Calendar,
  Cloud,
  Droplets,
  Sun,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Info,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface YieldPrediction {
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
  weatherImpact: WeatherImpact;
  recommendations: string[];
  status: "excellent" | "good" | "average" | "poor";
}

interface YieldFactor {
  name: string;
  impact: number; // -100 to 100
  description: string;
}

interface WeatherImpact {
  temperature: number;
  rainfall: number;
  humidity: number;
  sunlight: number;
  overall: number;
}

// ============================================================
// Mock Data
// ============================================================

const mockPredictions: YieldPrediction[] = [
  {
    id: "1",
    cropName: "Maize",
    variety: "H614",
    farm: "Sunrise Ranch",
    plantingDate: "2026-04-01",
    expectedHarvest: "2026-08-15",
    predictedYield: 7800,
    targetYield: 8000,
    unit: "kg",
    confidence: 87,
    factors: [
      { name: "Soil Quality", impact: 75, description: "Rich volcanic soil with excellent drainage" },
      { name: "Rainfall", impact: 65, description: "Adequate rainfall during growing season" },
      { name: "Fertilizer", impact: 80, description: "Optimal NPK application at key stages" },
      { name: "Pest Pressure", impact: 45, description: "Moderate fall armyworm activity detected" },
      { name: "Seed Quality", impact: 90, description: "Certified hybrid seed with high germination rate" },
    ],
    weatherImpact: {
      temperature: 72,
      rainfall: 68,
      humidity: 65,
      sunlight: 78,
      overall: 71,
    },
    recommendations: [
      "Apply additional nitrogen fertilizer in 2 weeks",
      "Monitor for fall armyworm in whorl stage",
      "Ensure adequate drainage before expected heavy rains",
    ],
    status: "good",
  },
  {
    id: "2",
    cropName: "Tomatoes",
    variety: "Roma VF",
    farm: "Green Valley Farm",
    plantingDate: "2026-03-15",
    expectedHarvest: "2026-07-20",
    predictedYield: 2650,
    targetYield: 2500,
    unit: "kg",
    confidence: 92,
    factors: [
      { name: "Soil Quality", impact: 85, description: "Well-amended loamy soil" },
      { name: "Water Management", impact: 88, description: "Drip irrigation maintaining optimal moisture" },
      { name: "Disease Control", impact: 70, description: "Early blight detected but managed" },
      { name: "Pollination", impact: 82, description: "Good natural pollination conditions" },
      { name: "Fertilizer", impact: 85, description: "Balanced feeding program on track" },
    ],
    weatherImpact: {
      temperature: 80,
      rainfall: 62,
      humidity: 58,
      sunlight: 85,
      overall: 71,
    },
    recommendations: [
      "Continue current irrigation schedule",
      "Apply calcium supplement to prevent blossom end rot",
      "Harvest first truss within 5 days for peak quality",
    ],
    status: "excellent",
  },
  {
    id: "3",
    cropName: "Beans",
    variety: "Rose Coco",
    farm: "Riverside Fields",
    plantingDate: "2026-05-01",
    expectedHarvest: "2026-08-10",
    predictedYield: 1050,
    targetYield: 1200,
    unit: "kg",
    confidence: 78,
    factors: [
      { name: "Soil Quality", impact: 65, description: "Moderate soil fertility, needs phosphorus" },
      { name: "Rainfall", impact: 55, description: "Below average rainfall during vegetative stage" },
      { name: "Pest Pressure", impact: 40, description: "Bean fly damage in early stages" },
      { name: "Seed Quality", impact: 80, description: "Good quality seed with inoculant" },
      { name: "Weed Competition", impact: 60, description: "Moderate weed pressure controlled" },
    ],
    weatherImpact: {
      temperature: 68,
      rainfall: 52,
      humidity: 60,
      sunlight: 70,
      overall: 63,
    },
    recommendations: [
      "Apply foliar phosphorus to boost pod filling",
      "Increase irrigation frequency during dry spells",
      "Consider intercropping with maize for better land use",
    ],
    status: "average",
  },
];

// ============================================================
// Yield Status Config
// ============================================================

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  excellent: { label: "Excellent", color: "text-green-600", bgColor: "bg-green-500/10" },
  good: { label: "Good", color: "text-blue-600", bgColor: "bg-blue-500/10" },
  average: { label: "Average", color: "text-amber-600", bgColor: "bg-amber-500/10" },
  poor: { label: "Poor", color: "text-red-600", bgColor: "bg-red-500/10" },
};

// ============================================================
// Yield Prediction Card
// ============================================================

function YieldPredictionCard({
  prediction,
  isSelected,
  onSelect,
}: {
  prediction: YieldPrediction;
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

        {/* Yield Progress */}
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

        {/* Confidence & Weather */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-xs text-muted-foreground">Confidence</p>
            <p className="text-lg font-bold text-primary">{prediction.confidence}%</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30 text-center">
            <p className="text-xs text-muted-foreground">Weather Impact</p>
            <p className={`text-lg font-bold ${
              prediction.weatherImpact.overall >= 70 ? "text-green-600" : "text-amber-600"
            }`}>
              {prediction.weatherImpact.overall}%
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

function WeatherImpactPanel({ impact }: { impact: WeatherImpact }) {
  const metrics = [
    { label: "Temperature", value: impact.temperature, icon: Sun, color: "text-orange-500" },
    { label: "Rainfall", value: impact.rainfall, icon: Droplets, color: "text-blue-500" },
    { label: "Humidity", value: impact.humidity, icon: Droplets, color: "text-cyan-500" },
    { label: "Sunlight", value: impact.sunlight, icon: Sun, color: "text-yellow-500" },
  ];

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
                className={impact.overall >= 70 ? "text-green-500" : "text-amber-500"}
                strokeDasharray={`${(impact.overall / 100) * 251} 251`}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute text-2xl font-bold">{impact.overall}%</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Overall Weather Score</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {metrics.map((metric, i) => {
            const Icon = metric.icon;
            return (
              <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                <Icon className={`w-4 h-4 ${metric.color}`} />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground">{metric.label}</p>
                  <p className="text-sm font-medium">{metric.value}%</p>
                </div>
              </div>
            );
          })}
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
// Main Yield Prediction Page
// ============================================================

export default function YieldPrediction() {
  const [predictions] = useState(mockPredictions);
  const [selectedId, setSelectedId] = useState<string | null>(predictions[0]?.id || null);

  const selectedPrediction = useMemo(
    () => predictions.find((p) => p.id === selectedId) || predictions[0],
    [predictions, selectedId]
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
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
            <div className="flex gap-2">
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </Button>
              <Button className="gradient-primary">
                <Target className="w-4 h-4 mr-2" />
                New Prediction
              </Button>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/50">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-500">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Predicted</p>
                  <p className="text-2xl font-bold">11,500 kg</p>
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
                  <p className="text-2xl font-bold">11,700 kg</p>
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
                  <p className="text-2xl font-bold">86%</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/50">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500">
                  <Calendar className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Days to Harvest</p>
                  <p className="text-2xl font-bold">42</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Crop Predictions */}
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
                    isSelected={selectedId === prediction.id}
                    onSelect={() => setSelectedId(prediction.id)}
                  />
                ))}
              </div>
            </div>

            {/* Right: Analysis Panels */}
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
        </motion.div>
      </div>
    </AppLayout>
  );
}
