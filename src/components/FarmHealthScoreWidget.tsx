import { useEffect, useRef, useMemo } from "react";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb } from "lucide-react";

interface HealthScoreRingProps {
  score: number; // 0-100
  size?: number;
  strokeWidth?: number;
  label?: string;
  showLabel?: boolean;
  className?: string;
}

function getScoreColor(score: number): string {
  if (score >= 80) return "#22c55e"; // green
  if (score >= 60) return "#eab308"; // amber
  if (score >= 40) return "#f97316"; // orange
  return "#ef4444"; // red
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  return "Poor";
}

export function HealthScoreRing({
  score,
  size = 120,
  strokeWidth = 10,
  label,
  showLabel = true,
  className = "",
}: HealthScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);
  const displayLabel = label ?? getScoreLabel(score);

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Animated progress circle */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-xs text-muted-foreground font-medium">/100</span>
        </div>
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-muted-foreground">{displayLabel}</span>
      )}
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color?: string;
  className?: string;
}

export function KPICard({ title, value, change, icon, color = "text-primary", className = "" }: KPICardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`bg-card rounded-xl border border-border/50 p-5 hover:shadow-lg transition-all ${className}`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold tracking-tight">{value}</p>
          {change !== undefined && (
            <div className={`flex items-center gap-1 text-xs font-medium ${change >= 0 ? "text-green-600" : "text-red-500"}`}>
              <span>{change >= 0 ? "↑" : "↓"}</span>
              <span>{Math.abs(change)}%</span>
              <span className="text-muted-foreground">vs last month</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl bg-primary/10 ${color}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}


/**
 * FarmHealthScoreWidget - displays overall farm health with animated ring
 */
export function FarmHealthScoreWidget() {
  const farmsResult = useQuery(api.farms.listUserFarms, {});
  const latestInsights = useQuery(api.intelligence.getLatestInsights, { limit: 5 });
  const farms = farmsResult?.page ?? []

  const overallScore = useMemo(() => {
    if (!farms || farms.length === 0) return 75;
    const scores = (farms as any[]).filter((f: any) => f.healthScore !== undefined).map((f: any) => f.healthScore as number);
    if (scores.length === 0) return 75;
    return Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
  }, [farms]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">Farm Health</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <HealthScoreRing score={overallScore} size={100} strokeWidth={8} />
        <div className="space-y-1 flex-1">
          <p className="text-sm text-muted-foreground">{farms.length} farm(s) monitored</p>
          <p className="text-sm text-muted-foreground">{latestInsights?.length ?? 0} AI insights available</p>
          <Badge variant="outline" className="mt-2 text-xs">Updated in real-time</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * IntelligenceInsightsWidget - shows AI-generated insights with confidence scores
 */
interface Insight {
  category?: string;
  title?: string;
  description?: string;
  priority?: string;
  confidence?: number;
  dataSources?: string[];
  actions?: string[];
}

export function IntelligenceInsightsWidget({ insights = [] }: { insights?: Insight[] }) {
  if (insights.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">AI Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No insights yet. Add farms and crops to receive AI-powered recommendations.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">AI Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.slice(0, 4).map((insight, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Lightbulb className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
            <div className="space-y-1 flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">{insight.title ?? "Insight"}</p>
              <p className="text-xs text-muted-foreground line-clamp-2">{insight.description ?? ""}</p>
              {insight.confidence !== undefined && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.round((insight.confidence ?? 0) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{Math.round((insight.confidence ?? 0) * 100)}%</span>
                </div>
              )}
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">{insight.priority ?? "medium"}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
