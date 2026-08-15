import { motion, useReducedMotion } from "framer-motion";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useWeather } from "@/hooks/use-weather";
import { useUnits } from "@/hooks/use-units";
import { useCurrency } from "@/hooks/use-currency";
import { useHaptic } from "@/hooks/use-mobile";
import {
  Leaf,
  Beef,
  Cloud,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Map,
  Bot,
  Sprout,
  Droplets,
  Sun,
  ArrowRight,
  Plus,
  Activity,
  Check,
  Zap,
  BarChart3,
  Clock,
  Thermometer,
  Wind,
  Megaphone,
  Store,
  CloudRain,
  CloudSnow,
  CloudFog,
  CloudLightning,
  PiggyBank,
  LandPlot,
} from "lucide-react";
import { Link } from "react-router";
import { FarmHealthScoreWidget, IntelligenceInsightsWidget } from "@/components/FarmHealthScoreWidget";
import { AdminBootstrapCard } from "@/components/AdminBootstrapCard";
import { useQuery } from "convex/react";

// ============================================================
// Realistic agricultural photography
// Shared approach with Landing/Auth (Unsplash, same query format).
// Keyword map so a crop's real name/type shows a real photo of
// that crop; onError falls back to a generic field image.
// ============================================================

const CROP_IMAGE_FALLBACK =
  "https://images.unsplash.com/photo-1464226184884-fa280b87c399?q=80&w=900&auto=format&fit=crop";

const cropImageMap: Record<string, string> = {
  tomato:
    "https://images.unsplash.com/photo-1592841200221-a6898f307baa?q=80&w=900&auto=format&fit=crop",
  maize:
    "https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=900&auto=format&fit=crop",
  corn:
    "https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=900&auto=format&fit=crop",
  wheat:
    "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=900&auto=format&fit=crop",
  rice:
    "https://images.unsplash.com/photo-1550317138-10000687a72b?q=80&w=900&auto=format&fit=crop",
  potato:
    "https://images.unsplash.com/photo-1518977676601-b53f82aba655?q=80&w=900&auto=format&fit=crop",
  sunflower:
    "https://images.unsplash.com/photo-1470509037663-253afd7f0f51?q=80&w=900&auto=format&fit=crop",
};

function getCropImage(name: string): string {
  const key = Object.keys(cropImageMap).find((k) => name.toLowerCase().includes(k));
  return key ? cropImageMap[key] : CROP_IMAGE_FALLBACK;
}

// ============================================================
// Helpers
// ============================================================

function weatherIcon(code: number, className = "h-5 w-5", tone: "dark" | "light" = "dark") {
  const onDark = {
    sun: "text-amber-300",
    cloud: "text-white/90",
    cloudSoft: "text-white/70",
    fog: "text-white/80",
    snow: "text-sky-200",
    storm: "text-amber-300",
    rain: "text-sky-200",
  };
  const onLight = {
    sun: "text-amber-500",
    cloud: "text-slate-400",
    cloudSoft: "text-slate-400",
    fog: "text-slate-400",
    snow: "text-sky-400",
    storm: "text-amber-500",
    rain: "text-sky-500",
  };
  const c = tone === "dark" ? onDark : onLight;
  if (code === 0) return <Sun className={`${className} ${c.sun}`} />;
  if (code === 1 || code === 2) return <Cloud className={`${className} ${c.cloud}`} />;
  if (code === 3) return <Cloud className={`${className} ${c.cloudSoft}`} />;
  if (code === 45 || code === 48) return <CloudFog className={`${className} ${c.fog}`} />;
  if (code >= 71 && code <= 77) return <CloudSnow className={`${className} ${c.snow}`} />;
  if (code === 95 || code === 96 || code === 99)
    return <CloudLightning className={`${className} ${c.storm}`} />;
  return <CloudRain className={`${className} ${c.rain}`} />;
}

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

// ============================================================
// Quick Action
// ============================================================

function QuickAction({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}) {
  const haptic = useHaptic();

  return (
    <Link to={href} onClick={() => haptic.selection()}>
      <motion.div
        whileHover={{ scale: 1.03, y: -2 }}
        whileTap={{ scale: 0.96 }}
        className="group flex flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card p-3.5 transition-all hover:border-brand/40 hover:shadow-md hover:shadow-brand/10 sm:gap-2.5"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground transition-all group-hover:scale-110 group-hover:bg-brand group-hover:text-brand-foreground dark:text-brand sm:h-12 sm:w-12">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <span className="text-center text-xs font-medium leading-tight text-foreground/80 sm:text-sm">
          {label}
        </span>
      </motion.div>
    </Link>
  );
}

// ============================================================
// Stat Card
// ============================================================

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="relative overflow-hidden border-border/60">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
            {sub && <p className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">{sub}</p>}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand sm:h-11 sm:w-11">
            <Icon className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Weather Widget (enriched with real forecast + soil data)
// ============================================================

function WeatherWidget() {
  const haptic = useHaptic();
  const { data: weather, isLoading, getWeatherDescription, isDefaultLocation } = useWeather();
  const { tempValue, tempUnit, wind, precip } = useUnits();

  const current = weather?.current;
  const tempRaw = current ? Math.round(current.temperature) : null;
  const humidity = current ? Math.round(current.humidity) : null;
  const windRaw = current ? Math.round(current.windSpeed) : null;
  const uv = current ? Math.round(current.uvIndex) : null;
  const precipRaw = current ? Math.round(current.precipitation * 10) / 10 : null;
  const description = current ? getWeatherDescription(current.weatherCode) : null;
  const locationName = weather?.location?.name;
  const daily = weather?.daily?.slice(0, 3) ?? [];
  const soil = weather?.soil;

  return (
    <Card className="overflow-hidden border-border/60">
      <div className="relative overflow-hidden bg-brand-deep p-4 text-white sm:p-5">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/20" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs text-white/70 sm:text-sm">Current Weather</p>
            {locationName && (
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-white/60 sm:text-xs">
                <Map className="h-3 w-3" />
                {locationName}
                {weather?.location?.country ? `, ${weather.location.country}` : ""}
              </p>
            )}
            {isDefaultLocation && (
              <p className="mt-0.5 text-[10px] text-white/60 sm:text-xs">
                Default region — set your location on the Weather page
              </p>
            )}
            {isLoading ? (
              <Skeleton className="mt-2 h-9 w-20 bg-white/20" />
            ) : (
              <p className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                {tempRaw !== null ? (
                  <>
                    {tempValue(tempRaw)}
                    <span className="ml-0.5 text-lg font-semibold text-brand sm:text-xl">
                      {tempUnit}
                    </span>
                  </>
                ) : (
                  "--"
                )}
              </p>
            )}
          </div>
          {!isLoading && current && (
            <div className="flex flex-col items-center">
              {weatherIcon(current.weatherCode, "h-11 w-11 sm:h-14 sm:w-14")}
              <span className="mt-1 max-w-[7rem] text-center text-[10px] leading-tight text-white/85 sm:text-xs">
                {description}
              </span>
            </div>
          )}
        </div>
      </div>

      <CardContent className="p-3 sm:p-4">
        {/* Current metrics */}
        <div className="grid grid-cols-4 gap-2 text-center sm:gap-3">
          <div className="space-y-1">
            <Droplets className="mx-auto h-4 w-4 text-blue-400" />
            <p className="text-[10px] text-muted-foreground sm:text-xs">Humidity</p>
            {isLoading ? (
              <Skeleton className="mx-auto h-4 w-10" />
            ) : (
              <p className="text-xs font-semibold sm:text-sm">{humidity !== null ? `${humidity}%` : "--"}</p>
            )}
          </div>
          <div className="space-y-1">
            <Wind className="mx-auto h-4 w-4 text-cyan-500" />
            <p className="text-[10px] text-muted-foreground sm:text-xs">Wind</p>
            {isLoading ? (
              <Skeleton className="mx-auto h-4 w-10" />
            ) : (
              <p className="text-xs font-semibold sm:text-sm">{windRaw !== null ? wind(windRaw) : "--"}</p>
            )}
          </div>
          <div className="space-y-1">
            <CloudRain className="mx-auto h-4 w-4 text-sky-500" />
            <p className="text-[10px] text-muted-foreground sm:text-xs">Rain</p>
            {isLoading ? (
              <Skeleton className="mx-auto h-4 w-10" />
            ) : (
              <p className="text-xs font-semibold sm:text-sm">{precipRaw !== null ? precip(precipRaw) : "--"}</p>
            )}
          </div>
          <div className="space-y-1">
            <Thermometer className="mx-auto h-4 w-4 text-orange-400" />
            <p className="text-[10px] text-muted-foreground sm:text-xs">UV</p>
            {isLoading ? (
              <Skeleton className="mx-auto h-4 w-10" />
            ) : (
              <p className="text-xs font-semibold sm:text-sm">{uv !== null ? uv : "--"}</p>
            )}
          </div>
        </div>

        {/* 3-day forecast */}
        {!isLoading && daily.length > 0 && (
          <div className="mt-4 rounded-xl border border-border/60 bg-muted/30 p-2.5">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Next days
            </p>
            <div className="grid grid-cols-3 gap-1">
              {daily.map((day) => {
                const label = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, {
                  weekday: "short",
                });
                return (
                  <div
                    key={day.date}
                    className="flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-center"
                  >
                    <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
                    {weatherIcon(day.weatherCode, "h-5 w-5", "light")}
                    <span className="text-xs font-semibold">
                      {Math.round(tempValue(day.tempMax))}°<span className="text-muted-foreground">/{Math.round(tempValue(day.tempMin))}°</span>
                    </span>
                    <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                      <Droplets className="h-2.5 w-2.5 text-sky-500" />
                      {Math.round(day.precipitationProbabilityMax)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Soil moisture (real, when available) */}
        {!isLoading && soil && typeof soil.moisture0to1cm === "number" && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sprout className="h-4 w-4 text-brand-foreground dark:text-brand" />
              Soil moisture
            </span>
            <span className="text-sm font-semibold">{Math.round(soil.moisture0to1cm)}%</span>
          </div>
        )}

        <Link to="/weather" onClick={() => haptic.light()}>
          <Button variant="ghost" className="mt-3 w-full text-brand-foreground dark:text-brand touch-target">
            View Full Forecast <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Announcements Widget (preserved)
// ============================================================

function AnnouncementsWidget() {
  const announcements = useQuery(api.announcements.listPublishedAnnouncements);

  if (!announcements || announcements.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm sm:text-base">Announcements</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 sm:px-6 sm:pb-6">
        {announcements.slice(0, 2).map((a: any) => (
          <div key={a._id} className="space-y-1 rounded-xl bg-muted/30 p-3">
            <p className="text-sm font-medium">{a.title}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
            <p className="text-[10px] text-muted-foreground">
              {new Date(a.createdAt || a._creationTime).toLocaleDateString()}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================
// AI Assistant Widget (preserved)
// ============================================================

function AIAssistantWidget() {
  const haptic = useHaptic();
  const suggestions = [
    "What crops should I plant this season?",
    "Analyze my farm's soil requirements",
    "Best pest control for tomatoes",
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand">
            <Bot className="h-5 w-5 text-brand-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm sm:text-base">AI Farming Assistant</CardTitle>
            <p className="text-[10px] text-muted-foreground sm:text-xs">Powered by advanced AI</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 sm:space-y-3 sm:px-6 sm:pb-6">
        {suggestions.map((suggestion, i) => (
          <Link key={i} to="/ai-assistant" onClick={() => haptic.selection()}>
            <div className="group flex items-center gap-3 rounded-xl bg-muted/50 p-2.5 transition-colors hover:bg-muted sm:p-3">
              <Zap className="h-4 w-4 shrink-0 text-brand-foreground dark:text-brand" />
              <span className="line-clamp-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground sm:text-sm">
                {suggestion}
              </span>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-brand-foreground dark:group-hover:text-brand" />
            </div>
          </Link>
        ))}
        <Link to="/ai-assistant" onClick={() => haptic.medium()}>
          <Button size="sm" className="mt-2 w-full bg-brand text-brand-foreground hover:bg-brand/90">
            <Bot className="mr-2 h-4 w-4" />
            Open AI Assistant
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Recent Activity (preserved, real crop data)
// ============================================================

function RecentActivity({
  crops,
}: {
  crops: Array<{ name: string; status: string; updatedAt: number }>;
}) {
  const recentCrops = crops
    .filter((c) => c.status !== "failed")
    .slice(0, 4)
    .map((crop, i) => {
      const iconMap: Record<string, typeof Leaf> = {
        seedling: Sprout,
        growing: Leaf,
        flowering: Leaf,
        fruiting: Leaf,
        harvest_ready: Check,
        harvested: Check,
      };
      const colorMap: Record<string, string> = {
        seedling: "text-green-600 bg-green-500/10",
        growing: "text-green-600 bg-green-500/10",
        flowering: "text-amber-600 bg-amber-500/10",
        fruiting: "text-amber-600 bg-amber-500/10",
        harvest_ready: "text-blue-600 bg-blue-500/10",
        harvested: "text-purple-600 bg-purple-500/10",
      };
      return {
        icon: iconMap[crop.status] || Leaf,
        title: `${crop.name} — ${crop.status.replace("_", " ")}`,
        time: `${Math.max(1, Math.floor((Date.now() - crop.updatedAt) / (1000 * 60 * 60)))}h ago`,
        color: colorMap[crop.status] || "text-green-600 bg-green-500/10",
      };
    });

  if (recentCrops.length === 0) {
    recentCrops.push({
      icon: Sprout,
      title: "Add your first crop to get started",
      time: "Just now",
      color: "text-green-600 bg-green-500/10",
    });
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base">Recent Activity</CardTitle>
          <Link to="/crops">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground touch-target">
              View All <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 pb-4 sm:space-y-4 sm:px-6 sm:pb-6">
        {recentCrops.map((activity, i) => {
          const Icon = activity.icon;
          return (
            <div key={i} className="flex items-start gap-3">
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${activity.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-xs font-medium sm:text-sm">{activity.title}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Upcoming Tasks (preserved, real harvest dates)
// ============================================================

function UpcomingTasks({
  crops,
}: {
  crops: Array<{ name: string; status: string; expectedHarvestDate?: number }>;
}) {
  const haptic = useHaptic();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const tasks = crops
    .filter(
      (c) =>
        c.expectedHarvestDate &&
        c.expectedHarvestDate > now &&
        c.status !== "harvested" &&
        c.status !== "failed",
    )
    .sort((a, b) => (a.expectedHarvestDate || 0) - (b.expectedHarvestDate || 0))
    .slice(0, 4)
    .map((crop) => {
      const daysUntil = Math.ceil(((crop.expectedHarvestDate || 0) - now) / dayMs);
      let due: string;
      let priority: string;
      if (daysUntil <= 1) {
        due = "Today";
        priority = "high";
      } else if (daysUntil <= 3) {
        due = `In ${daysUntil} days`;
        priority = "medium";
      } else {
        due = `In ${daysUntil} days`;
        priority = "low";
      }
      return { title: `Harvest ${crop.name}`, due, priority };
    });

  if (tasks.length === 0) {
    tasks.push({
      title: "No upcoming harvests scheduled",
      due: "Add crops with harvest dates",
      priority: "low",
    });
  }

  const priorityColors = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-green-500",
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base">Upcoming Tasks</CardTitle>
          <Link to="/calendar" onClick={() => haptic.light()}>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground touch-target">
              Calendar <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 sm:space-y-3 sm:px-6 sm:pb-6">
        {tasks.map((task, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl bg-muted/30 p-2.5 transition-colors hover:bg-muted/50 sm:p-3"
          >
            <div
              className={`h-2 w-2 shrink-0 rounded-full ${priorityColors[task.priority as keyof typeof priorityColors]}`}
            />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-xs font-medium sm:text-sm">{task.title}</p>
              <p className="text-[10px] text-muted-foreground sm:text-xs">{task.due}</p>
            </div>
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground/50" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Crops Overview (real crop data + realistic photography)
// ============================================================

function CropsOverview({
  crops,
  loading,
}: {
  crops: Array<{
    name: string;
    status: string;
    healthScore?: number;
    expectedHarvestDate?: number;
  }>;
  loading: boolean;
}) {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (crops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand-foreground dark:text-brand">
          <Sprout className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-base font-semibold">No crop data yet</h3>
        <p className="mt-1 max-w-xs text-sm text-muted-foreground">
          Add your first crop to start tracking growth and performance.
        </p>
        <Link to="/crops">
          <Button className="mt-5 rounded-full bg-brand text-brand-foreground hover:bg-brand/90">
            <Plus className="mr-1.5 h-4 w-4" /> Add Crop
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {crops.slice(0, 6).map((crop, i) => {
        const statusLabel = crop.status.replace("_", " ");
        const hasScore = typeof crop.healthScore === "number";
        const harvestIn =
          crop.expectedHarvestDate && crop.expectedHarvestDate > now && crop.status !== "harvested" && crop.status !== "failed"
            ? Math.max(1, Math.ceil((crop.expectedHarvestDate - now) / dayMs))
            : null;

        return (
          <Link key={`${crop.name}-${i}`} to="/crops" className="group">
            <div className="relative h-44 overflow-hidden rounded-2xl border border-border/60 transition-all group-hover:-translate-y-0.5 group-hover:shadow-lg">
              <img
                src={getCropImage(crop.name)}
                alt={`${crop.name} crop`}
                loading="lazy"
                onError={(e) => {
                  const img = e.currentTarget;
                  if (img.src !== CROP_IMAGE_FALLBACK) img.src = CROP_IMAGE_FALLBACK;
                }}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <Badge className="absolute right-2 top-2 bg-black/40 text-[10px] text-white backdrop-blur-sm">
                {statusLabel}
              </Badge>
              <div className="absolute inset-x-0 bottom-0 p-3">
                <p className="truncate text-sm font-semibold text-white">{crop.name}</p>
                <p className="mt-0.5 text-[11px] text-white/70">
                  {harvestIn !== null ? `Harvest in ~${harvestIn}d` : statusLabel}
                </p>
                {hasScore && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/25">
                      <div
                        className="h-full rounded-full bg-brand transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.max(0, crop.healthScore as number))}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-white">
                      {Math.round(crop.healthScore as number)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ============================================================
// Crop Stage Distribution (real counts, honest chart)
// ============================================================

function CropStageChart({ crops }: { crops: Array<{ status: string }> }) {
  const stages = ["seedling", "growing", "flowering", "fruiting", "harvest_ready", "harvested"];
  const counts = stages.map((status) => ({
    status,
    count: crops.filter((c) => c.status === status).length,
  }));
  const max = Math.max(1, ...counts.map((c) => c.count));

  return (
    <div className="space-y-2.5">
      {counts.map(({ status, count }) => (
        <div key={status} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[11px] capitalize text-muted-foreground sm:text-xs">
            {status.replace("_", " ")}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-brand transition-all duration-700"
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right text-xs font-semibold">{count}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// Livestock Overview (real counts by type)
// ============================================================

function LivestockOverview({
  livestock,
  loading,
}: {
  livestock: Array<{ type: string; quantity: number }>;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-24 rounded-2xl" />;

  const byType: Record<string, number> = {};
  livestock.forEach((l) => {
    const key = l.type.toLowerCase();
    byType[key] = (byType[key] || 0) + l.quantity;
  });

  if (Object.keys(byType).length === 0) {
    return (
      <Link
        to="/livestock"
        className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-4 transition-colors hover:border-brand/40"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
          <Beef className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">No livestock yet</p>
          <p className="text-xs text-muted-foreground">Add livestock to track herd health</p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  return (
    <Link
      to="/livestock"
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-muted/20 p-4 transition-colors hover:border-brand/40"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
        <Beef className="h-5 w-5" />
      </div>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {Object.entries(byType)
          .slice(0, 4)
          .map(([type, qty]) => (
            <span
              key={type}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium"
            >
              <span className="font-bold">{qty}</span>{" "}
              <span className="text-muted-foreground">{type}</span>
            </span>
          ))}
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

// ============================================================
// Financial Snapshot (real transaction data or honest empty state)
// ============================================================

function FinancialSnapshot() {
  const summary = useQuery(api.transactions.getFinancialSummary, {});
  // Backend financial totals are stored in KES; convert and format them into
  // the user's configured currency (same pattern as Finances.tsx). KES users
  // get an identity conversion, so the amount is unchanged.
  const { format, convert } = useCurrency();

  if (summary === undefined) return <Skeleton className="h-28 rounded-2xl" />;

  if (summary.totalIncome === 0 && summary.totalExpenses === 0) {
    return (
      <Link
        to="/finances"
        className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-4 transition-colors hover:border-brand/40"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
          <PiggyBank className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">No finances recorded yet</p>
          <p className="text-xs text-muted-foreground">
            Add income or expenses to see your farm's profit at a glance
          </p>
        </div>
        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    );
  }

  const profit = summary.netProfit;
  const profitPositive = profit >= 0;

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Financial snapshot</p>
        <Link to="/finances" className="text-xs font-medium text-brand-foreground hover:underline dark:text-brand">
          View finances
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Income</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm font-bold text-green-600">
            <TrendingUp className="h-3.5 w-3.5" />
            {format(convert(summary.totalIncome, "KES"))}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Expenses</p>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm font-bold text-red-600">
            <TrendingDown className="h-3.5 w-3.5" />
            {format(convert(summary.totalExpenses, "KES"))}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Net</p>
          <p
            className={`mt-1 text-sm font-bold ${profitPositive ? "text-green-600" : "text-red-600"}`}
          >
            {profitPositive ? "+" : "-"}
            {format(convert(Math.abs(profit), "KES"))}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Farm Health Overview (preserved, real NDVI data)
// ============================================================

function FarmHealthOverview({
  farms,
  loading,
}: {
  farms: Array<{ _id: string; name: string; size: number; sizeUnit: string; ndviScore?: number }>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <Map className="h-10 w-10 text-muted-foreground/50" />
        <p className="mt-3 text-sm font-medium">No farms yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Register your farm with GPS to unlock satellite health monitoring
        </p>
        <Link to="/farms/new">
          <Button variant="outline" size="sm" className="mt-4 rounded-full">
            <Plus className="mr-1 h-4 w-4" /> Add Your First Farm
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
      {farms.slice(0, 3).map((farm) => {
        // Data honesty: a real NDVI score is shown only when
        // one exists — no fabricated default %.
        const score = typeof farm.ndviScore === "number" ? farm.ndviScore : null;
        return (
          <div key={farm._id} className="space-y-2 rounded-2xl border border-border/60 bg-muted/20 p-3.5 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-medium sm:text-sm">{farm.name}</p>
              <span className="shrink-0 text-[10px] text-muted-foreground sm:text-xs">
                {farm.size} {farm.sizeUnit === "hectares" ? "ha" : "ac"}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                <span className="text-muted-foreground">Health Score</span>
                {score === null ? (
                  <span className="text-muted-foreground/60">No data yet</span>
                ) : (
                  <span className="font-semibold">{score}%</span>
                )}
              </div>
              {score === null ? (
                <p className="text-[10px] text-muted-foreground/60">
                  Run a satellite scan to get an NDVI health score.
                </p>
              ) : (
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${score}%`,
                      background:
                        score >= 90
                          ? "linear-gradient(90deg, #4ade80, #16a34a)"
                          : score >= 70
                          ? "linear-gradient(90deg, #fbbf24, #d97706)"
                          : "linear-gradient(90deg, #f87171, #dc2626)",
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Welcome Hero (real farm context only)
// ============================================================

function WelcomeHero({
  farms,
  loading,
}: {
  farms: Array<{ name: string; location?: { city?: string; country?: string; address?: string }; size: number; sizeUnit: string; ndviScore?: number }>;
  loading: boolean;
}) {
  const { user } = useAuth();
  const { data: weather, getWeatherDescription } = useWeather();
  const { tempValue, tempUnit } = useUnits();
  const firstName = user?.name?.split(" ")[0] || "Farmer";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const farm = farms[0];
  const location = farm?.location
    ? [farm.location.city, farm.location.country].filter(Boolean).join(", ")
    : null;
  const farmLine = farm
    ? `${farm.name}${location ? ` · ${location}` : ""}${farm.size ? ` · ${farm.size} ${farm.sizeUnit === "hectares" ? "ha" : "ac"}` : ""}`
    : null;

  const temp = weather?.current ? Math.round(weather.current.temperature) : null;
  const desc = weather?.current ? getWeatherDescription(weather.current.weatherCode) : null;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/60">
      <img
        src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?q=80&w=1920&auto=format&fit=crop"
        alt="Golden wheat field at harvest"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-brand-deep via-brand-deep/92 to-brand-deep/55" />

      <div className="relative z-10 flex flex-col gap-5 p-5 text-white sm:p-7 md:flex-row md:items-center md:justify-between lg:p-9">
        <div className="min-w-0">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-brand/50 bg-black/25 px-3.5 py-1 text-[11px] font-medium text-brand backdrop-blur-sm sm:text-xs">
            <span aria-hidden>◆</span>
            {today}
          </p>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-white/80 sm:text-base">
            Here's what's happening on your farm today.
          </p>
          {loading ? (
            <Skeleton className="mt-3 h-5 w-64 max-w-full bg-white/20" />
          ) : farmLine ? (
            <p className="mt-3 flex items-center gap-2 text-xs font-medium text-white/85 sm:text-sm">
              <LandPlot className="h-4 w-4 shrink-0 text-brand" />
              <span className="truncate">{farmLine}</span>
            </p>
          ) : (
            <Link
              to="/farms/new"
              className="mt-3 inline-flex h-10 items-center rounded-full border border-white/25 bg-white/10 px-5 text-sm font-medium backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Register your first farm
            </Link>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {temp !== null && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              {weather?.current && weatherIcon(weather.current.weatherCode, "h-8 w-8")}
              <div>
                <p className="text-xl font-bold leading-none">
                  {tempValue(temp)}
                  <span className="ml-0.5 text-xs font-semibold text-brand">{tempUnit}</span>
                </p>
                <p className="mt-1 text-[11px] text-white/75">{desc}</p>
              </div>
            </div>
          )}
          <Link
            to="/weather"
            className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm transition-colors hover:bg-white/20"
            aria-label="View weather forecast"
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Main Dashboard Component
// ============================================================

export default function Dashboard() {
  const variants = useEntranceVariants();

  // Real Convex data (paginated via usePaginatedQuery with infinite scroll)
  const { results: farms, isLoading: isLoadingFarms } = usePaginatedQuery(api.farms.listUserFarms);
  const { results: crops, isLoading: isLoadingCrops } = usePaginatedQuery(api.crops.listUserCrops);
  const {
    results: livestock,
    isLoading: isLoadingLivestock,
    sentinelRef,
    canLoadMore,
    isLoadingMore,
  } = usePaginatedQuery(api.livestock.listUserLivestock);
  const isLoading = isLoadingFarms || isLoadingCrops || isLoadingLivestock;

  const activeFarms = farms.length;
  const activeCrops = crops.filter((c) => c.status !== "harvested" && c.status !== "failed").length;
  const totalLivestock = livestock.reduce((sum, l) => sum + l.quantity, 0);
  const totalFarmSize = farms.reduce((sum, f) => sum + f.size, 0);
  const allAcres = farms.length > 0 && farms.every((f) => f.sizeUnit === "acres");
  const areaUnit = allAcres ? "ac" : "ha";

  // Intelligence engine data
  const latestInsights = useQuery(api.intelligence.getLatestInsights, { limit: 5 });

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Welcome hero */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <WelcomeHero farms={farms} loading={isLoadingFarms} />
        </motion.div>

        {/* Initial admin bootstrap (renders nothing unless needed) */}
        <AdminBootstrapCard />

        <motion.div
          variants={variants.container}
          initial="hidden"
          animate="visible"
          className="mt-4 space-y-4 sm:mt-6 sm:space-y-6"
        >
          {/* Stats Grid */}
          <motion.div variants={variants.item} className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="border-border/60">
                  <CardContent className="p-4 sm:p-5">
                    <Skeleton className="mb-2 h-4 w-24" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <StatCard title="Active Farms" value={String(activeFarms)} icon={Map} />
                <StatCard title="Active Crops" value={String(activeCrops)} icon={Leaf} />
                <StatCard title="Livestock" value={String(totalLivestock)} icon={Beef} />
                <StatCard
                  title="Total Area"
                  value={`${totalFarmSize} ${areaUnit}`}
                  sub={farms.length > 0 ? `${farms.length} farm${farms.length === 1 ? "" : "s"} registered` : "No farms registered"}
                  icon={Sprout}
                />
              </>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={variants.item}>
            <h2 className="mb-3 text-base font-semibold sm:mb-4 sm:text-lg">Quick Actions</h2>
            <div className="grid grid-cols-4 gap-2 sm:gap-3 lg:grid-cols-8">
              <QuickAction icon={Plus} label="Add Farm" href="/farms/new" />
              <QuickAction icon={Sprout} label="Add Crop" href="/crops" />
              <QuickAction icon={Beef} label="Add Livestock" href="/livestock" />
              <QuickAction icon={Bot} label="Ask AI" href="/ai-assistant" />
              <QuickAction icon={Cloud} label="Weather" href="/weather" />
              <QuickAction icon={Droplets} label="Irrigation" href="/irrigation" />
              <QuickAction icon={DollarSign} label="Finances" href="/finances" />
              <QuickAction icon={Store} label="Market" href="/marketplace" />
            </div>
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
            {/* Left Column */}
            <motion.div variants={variants.item} className="space-y-4 sm:space-y-6 lg:col-span-2">
              {/* Farm Health Overview */}
              <Card className="border-border/60">
                <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base">Farm Health Overview</CardTitle>
                    {isLoading ? null : (
                      <Badge className="border-green-500/20 bg-green-500/10 text-[10px] text-green-700 sm:text-xs dark:text-green-400">
                        <Check className="mr-1 h-3 w-3" />
                        {farms.length} Active
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                  <FarmHealthOverview farms={farms} loading={isLoading} />
                </CardContent>
              </Card>

              {/* Crops Overview */}
              <Card className="border-border/60">
                <CardHeader className="px-4 pb-3 pt-4 sm:px-6 sm:pt-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base">Your Crops</CardTitle>
                    <Link to="/crops">
                      <Button variant="ghost" size="sm" className="text-xs text-muted-foreground touch-target">
                        Manage <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
                  <CropsOverview crops={crops} loading={isLoadingCrops} />
                </CardContent>
              </Card>

              {/* Livestock + Financial snapshot */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 sm:gap-6">
                <div className="space-y-4 sm:space-y-6">
                  <div>
                    <h3 className="mb-2.5 text-sm font-semibold">Livestock</h3>
                    <LivestockOverview livestock={livestock} loading={isLoadingLivestock} />
                  </div>
                  <div>
                    <h3 className="mb-2.5 text-sm font-semibold">Finances</h3>
                    <FinancialSnapshot />
                  </div>
                </div>
                <CropStageChartSection crops={crops} />
              </div>

              {/* Recent Activity & Tasks */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 sm:gap-6">
                <RecentActivity crops={crops} />
                <UpcomingTasks crops={crops} />
              </div>
            </motion.div>

            {/* Right Column */}
            <motion.div variants={variants.item} className="space-y-4 sm:space-y-6">
              <FarmHealthScoreWidget />
              <WeatherWidget />
              <IntelligenceInsightsWidget insights={latestInsights ?? []} />
              <AnnouncementsWidget />
              <AIAssistantWidget />
            </motion.div>
          </div>

          {/* Livestock infinite-scroll sentinel (preserved) */}
          {canLoadMore && <div ref={sentinelRef} className="h-4" />}
          {isLoadingMore && (
            <div className="flex justify-center py-3">
              <Activity className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </motion.div>
      </div>
    </AppLayout>
  );
}

// ============================================================
// Crop Stage Distribution Section (real data)
// ============================================================

function CropStageChartSection({ crops }: { crops: Array<{ status: string }> }) {
  if (crops.length === 0) {
    return (
      <div>
        <h3 className="mb-2.5 text-sm font-semibold">Crops by stage</h3>
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/20 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">No crops to chart yet</p>
            <p className="text-xs text-muted-foreground">
              Growth-stage analytics appear once you add crops
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="mb-2.5 text-sm font-semibold">Crops by stage</h3>
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
        <CropStageChart crops={crops} />
        <p className="sr-only" aria-live="polite">
          Crop counts by growth stage:{" "}
          {Object.entries(
            crops.reduce<Record<string, number>>((acc, c) => {
              acc[c.status] = (acc[c.status] || 0) + 1;
              return acc;
            }, {}),
          )
            .map(([status, count]) => `${status}: ${count}`)
            .join(", ")}
        </p>
      </div>
    </div>
  );
}
