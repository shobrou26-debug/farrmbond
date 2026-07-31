import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router";
import {
  Activity,
  Leaf,
  Beef,
  Cloud,
  DollarSign,
  Satellite,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

// ============================================================
// Farm Health Score Widget
// ============================================================

export function FarmHealthScoreWidget() {
  // Get farms to query health scores
  const farms = useQuery(api.farms.listUserFarms);

  if (!farms) {
    return (
      <Card className="border-border/50">
        <CardContent className="p-4 sm:p-6">
          <Skeleton className="h-32 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (farms.length === 0) return null;

  // Use the first farm's health score (or compute from NDVI)
  const farm = farms[0];
  const score = farm.ndviScore ?? 85;

  const getScoreColor = (s: number) => {
    if (s >= 80) return "text-green-500";
    if (s >= 60) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreGradient = (s: number) => {
    if (s >= 80) return "from-green-500 to-emerald-600";
    if (s >= 60) return "from-amber-500 to-orange-600";
    return "from-red-500 to-rose-600";
  };

  const getScoreLabel = (s: number) => {
    if (s >= 90) return "Excellent";
    if (s >= 80) return "Good";
    if (s >= 70) return "Fair";
    if (s >= 60) return "Needs Attention";
    return "Critical";
  };

  return (
    <Card className="border-border/50 overflow-hidden">
      <div className={`bg-gradient-to-r ${getScoreGradient(score)} p-4 sm:p-5 text-white`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-xs sm:text-sm">Farm Health Score</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl sm:text-4xl font-bold">{score}%</p>
              <span className="text-white/90 text-xs sm:text-sm">{getScoreLabel(score)}</span>
            </div>
          </div>
          <Activity className="w-10 h-10 sm:w-12 sm:h-12 text-white/80" />
        </div>
      </div>
      <CardContent className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Leaf className="w-4 h-4 text-green-500" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Crops</p>
              <p className="text-xs sm:text-sm font-semibold">Good</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Beef className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Livestock</p>
              <p className="text-xs sm:text-sm font-semibold">Healthy</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Cloud className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Weather</p>
              <p className="text-xs sm:text-sm font-semibold">Low Risk</p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <Satellite className="w-4 h-4 text-purple-500" />
            <div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Satellite</p>
              <p className="text-xs sm:text-sm font-semibold">NDVI {score}%</p>
            </div>
          </div>
        </div>
        <Link to="/analytics" className="block mt-3">
          <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground">
            View Detailed Analytics <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Intelligence Insights Widget
// ============================================================

interface Insight {
  _id: string;
  source: string;
  title: string;
  summary: string;
  confidence: number;
  impact: string;
  severity: string;
  createdAt: number;
}

export function IntelligenceInsightsWidget({ insights }: { insights: Insight[] }) {
  if (!insights || insights.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="text-center py-6 text-muted-foreground">
            <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-xs sm:text-sm">No insights yet. Run the intelligence pipeline to generate insights.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sourceIcons: Record<string, typeof Leaf> = {
    weather: Cloud,
    satellite: Satellite,
    crop: Leaf,
    livestock: Beef,
    financial: DollarSign,
    soil: Activity,
    market: TrendingUp,
  };

  const severityColors: Record<string, string> = {
    critical: "bg-red-500/10 text-red-600 border-red-500/20",
    high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    medium: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    low: "bg-green-500/10 text-green-600 border-green-500/20",
  };

  const impactIcons: Record<string, typeof TrendingUp> = {
    positive: TrendingUp,
    negative: TrendingDown,
    neutral: Activity,
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            AI Insights
          </CardTitle>
          <Badge variant="secondary" className="text-[10px] sm:text-xs">
            {insights.length} new
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 sm:px-6 pb-4 sm:pb-6">
        {insights.slice(0, 5).map((insight) => {
          const SourceIcon = sourceIcons[insight.source] || Activity;
          const ImpactIcon = impactIcons[insight.impact] || Activity;
          return (
            <motion.div
              key={insight._id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                  <SourceIcon className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs sm:text-sm font-medium line-clamp-1">{insight.title}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${severityColors[insight.severity] || severityColors.medium}`}
                    >
                      {insight.severity}
                    </Badge>
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-2">{insight.summary}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1">
                      <ImpactIcon className={`w-3 h-3 ${insight.impact === "positive" ? "text-green-500" : insight.impact === "negative" ? "text-red-500" : "text-muted-foreground"}`} />
                      <span className="text-[10px] text-muted-foreground capitalize">{insight.impact}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${insight.confidence}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{insight.confidence}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
