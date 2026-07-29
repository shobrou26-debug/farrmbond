import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { useWeather } from "@/hooks/use-weather";
import { useIsMobile, useHaptic } from "@/hooks/use-mobile";
import {
  Leaf,
  Beef,
  Cloud,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Map,
  Bot,
  Calendar,
  Sprout,
  Droplets,
  Sun,
  ArrowRight,
  Plus,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Zap,
  BarChart3,
  Clock,
  Thermometer,
  Wind,
} from "lucide-react";
import { Link } from "react-router";

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 }
  },
};

// ============================================================
// Quick Action Card
// ============================================================

function QuickAction({
  icon: Icon,
  label,
  href,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  color: string;
}) {
  const haptic = useHaptic();

  return (
    <Link to={href} onClick={() => haptic.selection()}>
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="flex flex-col items-center gap-2 sm:gap-3 p-3 sm:p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/20 hover:shadow-lg transition-all cursor-pointer group touch-target tap-highlight-none"
      >
        <div
          className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${color} group-hover:scale-110 transition-transform`}
        >
          <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </div>
        <span className="text-xs sm:text-sm font-medium text-foreground/80 text-center leading-tight">{label}</span>
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
  change,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  change?: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const isPositive = change && !change.startsWith("-");
  return (
    <Card className="relative overflow-hidden border-border/50 card-hover touch-feedback tap-highlight-none">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 sm:space-y-2">
            <p className="text-xs sm:text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-xl sm:text-2xl font-bold tracking-tight">{value}</p>
            {change && (
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-500" />
                )}
                <span
                  className={`text-[10px] sm:text-xs font-medium ${
                    isPositive ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {change}
                </span>
              </div>
            )}
          </div>
          <div className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${color}`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
        </div>
      </CardContent>
      <div
        className="absolute bottom-0 left-0 right-0 h-1 opacity-60"
        style={{
          background: `linear-gradient(90deg, transparent, ${color.includes("green") ? "#22c55e" : color.includes("amber") ? "#f59e0b" : color.includes("blue") ? "#3b82f6" : "#8b5cf6"}, transparent)`,
        }}
      />
    </Card>
  );
}

// ============================================================
// Weather Widget
// ============================================================

function WeatherWidget() {
  const haptic = useHaptic();
  const { data: weather, isLoading, getWeatherDescription } = useWeather();

  const current = weather?.current;
  const temp = current ? Math.round(current.temperature) : null;
  const humidity = current ? Math.round(current.humidity) : null;
  const wind = current ? Math.round(current.windSpeed) : null;
  const uv = current ? Math.round(current.uvIndex) : null;
  const description = current ? getWeatherDescription(current.weatherCode) : null;

  return (
    <Card className="border-border/50 overflow-hidden">
      <div className="gradient-nature p-4 sm:p-5 text-white">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <p className="text-white/80 text-xs sm:text-sm">Current Weather</p>
            {isLoading ? (
              <Skeleton className="h-8 w-20 bg-white/20" />
            ) : (
              <p className="text-2xl sm:text-3xl font-bold">{temp !== null ? `${temp}°C` : '--'}</p>
            )}
          </div>
          <Sun className="w-10 h-10 sm:w-12 sm:h-12 text-yellow-300" />
        </div>
        <p className="text-white/90 text-xs sm:text-sm">{description || 'Weather data loading...'}</p>
      </div>
      <CardContent className="p-3 sm:p-4">
        <div className="grid grid-cols-3 gap-3 sm:gap-4 text-center">
          <div className="space-y-1">
            <Droplets className="w-4 h-4 mx-auto text-blue-400" />
            <p className="text-[10px] sm:text-xs text-muted-foreground">Humidity</p>
            {isLoading ? (
              <Skeleton className="h-4 w-12 mx-auto" />
            ) : (
              <p className="text-xs sm:text-sm font-semibold">{humidity !== null ? `${humidity}%` : '--'}</p>
            )}
          </div>
          <div className="space-y-1">
            <Wind className="w-4 h-4 mx-auto text-cyan-400" />
            <p className="text-[10px] sm:text-xs text-muted-foreground">Wind</p>
            {isLoading ? (
              <Skeleton className="h-4 w-12 mx-auto" />
            ) : (
              <p className="text-xs sm:text-sm font-semibold">{wind !== null ? `${wind} km/h` : '--'}</p>
            )}
          </div>
          <div className="space-y-1">
            <Thermometer className="w-4 h-4 mx-auto text-orange-400" />
            <p className="text-[10px] sm:text-xs text-muted-foreground">UV Index</p>
            {isLoading ? (
              <Skeleton className="h-4 w-12 mx-auto" />
            ) : (
              <p className="text-xs sm:text-sm font-semibold">{uv !== null ? `${uv}` : '--'}</p>
            )}
          </div>
        </div>
        <Link to="/weather" onClick={() => haptic.light()}>
          <Button variant="ghost" className="w-full mt-3 sm:mt-4 text-primary touch-target">
            View Full Forecast <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================
// AI Assistant Widget
// ============================================================

function AIAssistantWidget() {
  const haptic = useHaptic();
  const suggestions = [
    "What crops should I plant this season?",
    "Analyze my farm's soil requirements",
    "Best pest control for tomatoes",
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl gradient-primary shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-sm sm:text-base">AI Farming Assistant</CardTitle>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Powered by advanced AI</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3 px-4 sm:px-6 pb-4 sm:pb-6">
        {suggestions.map((suggestion, i) => (
          <Link key={i} to="/ai-assistant" onClick={() => haptic.selection()}>
            <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer group touch-feedback">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1">
                {suggestion}
              </span>
              <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
            </div>
          </Link>
        ))}
        <Link to="/ai-assistant" onClick={() => haptic.medium()}>
          <Button className="w-full gradient-primary mt-2" size="sm">
            <Bot className="w-4 h-4 mr-2" />
            Open AI Assistant
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Recent Activity
// ============================================================

function RecentActivity({ crops }: { crops: Array<{ name: string; status: string; updatedAt: number }> }) {
  const recentCrops = crops
    .filter((c) => c.status !== 'failed')
    .slice(0, 4)
    .map((crop, i) => {
      const iconMap: Record<string, typeof CheckCircle2> = {
        seedling: Sprout,
        growing: Leaf,
        flowering: Leaf,
        fruiting: Leaf,
        harvest_ready: CheckCircle2,
        harvested: CheckCircle2,
      };
      const colorMap: Record<string, string> = {
        seedling: 'text-green-500 bg-green-500/10',
        growing: 'text-green-500 bg-green-500/10',
        flowering: 'text-amber-500 bg-amber-500/10',
        fruiting: 'text-amber-500 bg-amber-500/10',
        harvest_ready: 'text-blue-500 bg-blue-500/10',
        harvested: 'text-purple-500 bg-purple-500/10',
      };
      return {
        icon: iconMap[crop.status] || Leaf,
        title: `${crop.name} — ${crop.status.replace('_', ' ')}`,
        time: `${Math.max(1, Math.floor((Date.now() - crop.updatedAt) / (1000 * 60 * 60)))}h ago`,
        color: colorMap[crop.status] || 'text-green-500 bg-green-500/10',
      };
    });

  if (recentCrops.length === 0) {
    recentCrops.push(
      { icon: Sprout, title: 'Add your first crop to get started', time: 'Just now', color: 'text-green-500 bg-green-500/10' },
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base">Recent Activity</CardTitle>
          <Link to="/crops">
            <Button variant="ghost" size="sm" className="text-[10px] sm:text-xs text-muted-foreground touch-target">
              View All <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6 pb-4 sm:pb-6">
        {recentCrops.map((activity, i) => {
          const Icon = activity.icon;
          return (
            <div key={i} className="flex items-start gap-3 touch-feedback">
              <div className={`flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg shrink-0 ${activity.color}`}>
                <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs sm:text-sm font-medium line-clamp-2 sm:line-clamp-1">{activity.title}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{activity.time}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Upcoming Tasks
// ============================================================

function UpcomingTasks({ crops }: { crops: Array<{ name: string; status: string; expectedHarvestDate?: number }> }) {
  const haptic = useHaptic();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const tasks = crops
    .filter((c) => c.expectedHarvestDate && c.expectedHarvestDate > now && c.status !== 'harvested' && c.status !== 'failed')
    .sort((a, b) => (a.expectedHarvestDate || 0) - (b.expectedHarvestDate || 0))
    .slice(0, 4)
    .map((crop) => {
      const daysUntil = Math.ceil(((crop.expectedHarvestDate || 0) - now) / dayMs);
      let due: string;
      let priority: string;
      if (daysUntil <= 1) { due = 'Today'; priority = 'high'; }
      else if (daysUntil <= 3) { due = `In ${daysUntil} days`; priority = 'medium'; }
      else { due = `In ${daysUntil} days`; priority = 'low'; }
      return { title: `Harvest ${crop.name}`, due, priority };
    });

  if (tasks.length === 0) {
    tasks.push(
      { title: 'No upcoming harvests scheduled', due: 'Add crops with harvest dates', priority: 'low' },
    );
  }

  const priorityColors = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-green-500",
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm sm:text-base">Upcoming Tasks</CardTitle>
          <Link to="/calendar" onClick={() => haptic.light()}>
            <Button variant="ghost" size="sm" className="text-[10px] sm:text-xs text-muted-foreground touch-target">
              Calendar <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 sm:space-y-3 px-4 sm:px-6 pb-4 sm:pb-6">
        {tasks.map((task, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 sm:p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors touch-feedback">
            <div className={`w-2 h-2 rounded-full shrink-0 ${priorityColors[task.priority as keyof typeof priorityColors]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium line-clamp-1">{task.title}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{task.due}</p>
            </div>
            <Clock className="w-4 h-4 text-muted-foreground/50 shrink-0" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Dashboard Component
// ============================================================

export default function Dashboard() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const firstName = user?.name?.split(" ")[0] || "Farmer";

  // Real Convex data (paginated — extract .page from results)
  const farmsResult = useQuery(api.farms.listUserFarms, {});
  const cropsResult = useQuery(api.crops.listUserCrops, {});
  const livestockResult = useQuery(api.livestock.listUserLivestock, {});
  const farms = farmsResult?.page ?? [];
  const crops = cropsResult?.page ?? [];
  const livestock = livestockResult?.page ?? [];
  const isLoading = farmsResult === undefined || cropsResult === undefined || livestockResult === undefined;

  const activeFarms = farms.length;
  const activeCrops = crops.filter((c) => c.status !== 'harvested' && c.status !== 'failed').length;
  const totalLivestock = livestock.reduce((sum, l) => sum + l.quantity, 0);
  const totalFarmSize = farms.reduce((sum, f) => sum + f.size, 0);

  // Greeting based on time of day
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <AppLayout>
      <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-5 sm:mb-6 md:mb-8"
        >            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-muted-foreground mt-1">
            Here's what's happening on your farm today.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-4 sm:space-y-6"
        >
          {/* Stats Grid */}
          <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="relative overflow-hidden border-border/50">
                  <CardContent className="p-4 sm:p-5">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-16" />
                  </CardContent>
                </Card>
              ))
            ) : (
              <>
                <StatCard
                  title="Active Farms"
                  value={String(activeFarms)}
                  icon={Map}
                  color="bg-emerald-500"
                />
                <StatCard
                  title="Active Crops"
                  value={String(activeCrops)}
                  icon={Leaf}
                  color="bg-green-500"
                />
                <StatCard
                  title="Livestock"
                  value={String(totalLivestock)}
                  icon={Beef}
                  color="bg-amber-500"
                />
                <StatCard
                  title="Total Area"
                  value={`${totalFarmSize} ha`}
                  icon={Sprout}
                  color="bg-blue-500"
                />
              </>
            )}
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={itemVariants}>
            <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Quick Actions</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
              <QuickAction icon={Plus} label="Add Farm" href="/farms/new" color="bg-emerald-500" />
              <QuickAction icon={Sprout} label="Add Crop" href="/crops/new" color="bg-green-500" />
              <QuickAction icon={Beef} label="Add Livestock" href="/livestock/new" color="bg-amber-500" />
              <QuickAction icon={Bot} label="AI Assistant" href="/ai-assistant" color="bg-purple-500" />
              <QuickAction icon={Cloud} label="Weather" href="/weather" color="bg-blue-500" />
              <QuickAction icon={BarChart3} label="Analytics" href="/analytics" color="bg-rose-500" />
            </div>
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Column */}
            <motion.div variants={itemVariants} className="lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Farm Health Overview */}
              <Card className="border-border/50">
                <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm sm:text-base">Farm Health Overview</CardTitle>
                    {isLoading ? null : (
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px] sm:text-xs">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        {farms.length} Active
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                  {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-xl" />
                      ))}
                    </div>
                  ) : farms.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Map className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p className="text-sm">No farms yet</p>
                      <Link to="/farms/new">
                        <Button variant="outline" size="sm" className="mt-3">
                          <Plus className="w-4 h-4 mr-1" /> Add Your First Farm
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      {farms.slice(0, 3).map((farm) => {
                        const score = farm.ndviScore ?? 85;
                        return (
                          <div key={farm._id} className="p-3 sm:p-4 rounded-xl bg-muted/30 space-y-2 sm:space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs sm:text-sm font-medium truncate">{farm.name}</p>
                              <span className="text-[10px] sm:text-xs text-muted-foreground shrink-0 ml-2">{farm.size} {farm.sizeUnit === 'hectares' ? 'ha' : 'ac'}</span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] sm:text-xs">
                                <span className="text-muted-foreground">Health Score</span>
                                <span className="font-medium">{score}%</span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{
                                    width: `${score}%`,
                                    background: score >= 90
                                      ? "linear-gradient(90deg, #22c55e, #16a34a)"
                                      : score >= 70
                                      ? "linear-gradient(90deg, #f59e0b, #d97706)"
                                      : "linear-gradient(90deg, #ef4444, #dc2626)",
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Activity & Tasks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <RecentActivity crops={crops} />
                <UpcomingTasks crops={crops} />
              </div>
            </motion.div>

            {/* Right Column */}
            <motion.div variants={itemVariants} className="space-y-4 sm:space-y-6">
              <WeatherWidget />
              <AIAssistantWidget />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
