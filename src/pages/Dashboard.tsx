import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
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
    transition: { duration: 0.4 } as const
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
  return (
    <Link to={href}>
      <motion.div
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/20 hover:shadow-lg transition-all cursor-pointer group"
      >
        <div
          className={`flex items-center justify-center w-12 h-12 rounded-xl ${color} group-hover:scale-110 transition-transform`}
        >
          <Icon className="w-6 h-6 text-white" />
        </div>
        <span className="text-sm font-medium text-foreground/80">{label}</span>
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
    <Card className="relative overflow-hidden border-border/50 card-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {change && (
              <div className="flex items-center gap-1">
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                )}
                <span
                  className={`text-xs font-medium ${
                    isPositive ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {change}
                </span>
              </div>
            )}
          </div>
          <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${color}`}>
            <Icon className="w-5 h-5 text-white" />
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
  return (
    <Card className="border-border/50 overflow-hidden">
      <div className="gradient-nature p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-white/80 text-sm">Current Weather</p>
            <p className="text-3xl font-bold">24°C</p>
          </div>
          <Sun className="w-12 h-12 text-yellow-300" />
        </div>
        <p className="text-white/90 text-sm">Partly Cloudy • Feels like 26°C</p>
      </div>
      <CardContent className="p-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="space-y-1">
            <Droplets className="w-4 h-4 mx-auto text-blue-400" />
            <p className="text-xs text-muted-foreground">Humidity</p>
            <p className="text-sm font-semibold">65%</p>
          </div>
          <div className="space-y-1">
            <Wind className="w-4 h-4 mx-auto text-cyan-400" />
            <p className="text-xs text-muted-foreground">Wind</p>
            <p className="text-sm font-semibold">12 km/h</p>
          </div>
          <div className="space-y-1">
            <Thermometer className="w-4 h-4 mx-auto text-orange-400" />
            <p className="text-xs text-muted-foreground">UV Index</p>
            <p className="text-sm font-semibold">6</p>
          </div>
        </div>
        <Link to="/weather">
          <Button variant="ghost" className="w-full mt-4 text-primary">
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
  const suggestions = [
    "What crops should I plant this season?",
    "Analyze my farm's soil requirements",
    "Best pest control for tomatoes",
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-base">AI Farming Assistant</CardTitle>
            <p className="text-xs text-muted-foreground">Powered by advanced AI</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion, i) => (
          <Link key={i} to="/ai-assistant">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors cursor-pointer group">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                {suggestion}
              </span>
              <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground/50 group-hover:text-primary transition-colors" />
            </div>
          </Link>
        ))}
        <Link to="/ai-assistant">
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

function RecentActivity() {
  const activities = [
    {
      icon: CheckCircle2,
      title: "Tomato crop marked as harvest ready",
      time: "2 hours ago",
      color: "text-green-500 bg-green-500/10",
    },
    {
      icon: AlertTriangle,
      title: "Low soil moisture detected in Plot A",
      time: "5 hours ago",
      color: "text-amber-500 bg-amber-500/10",
    },
    {
      icon: DollarSign,
      title: "Income recorded: $2,400 from maize sale",
      time: "1 day ago",
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      icon: Activity,
      title: "Farm health score updated to 87%",
      time: "2 days ago",
      color: "text-purple-500 bg-purple-500/10",
    },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Recent Activity</CardTitle>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
            View All <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activities.map((activity, i) => {
          const Icon = activity.icon;
          return (
            <div key={i} className="flex items-start gap-3">
              <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${activity.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{activity.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{activity.time}</p>
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

function UpcomingTasks() {
  const tasks = [
    { title: "Apply fertilizer to maize field", due: "Tomorrow", priority: "high" },
    { title: "Harvest tomatoes from Plot B", due: "In 2 days", priority: "medium" },
    { title: "Schedule vet visit for cattle", due: "In 3 days", priority: "low" },
    { title: "Irrigate vegetable garden", due: "Today", priority: "high" },
  ];

  const priorityColors = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-green-500",
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Upcoming Tasks</CardTitle>
          <Link to="/calendar">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
              Calendar <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tasks.map((task, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className={`w-2 h-2 rounded-full shrink-0 ${priorityColors[task.priority as keyof typeof priorityColors]}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">{task.title}</p>
              <p className="text-xs text-muted-foreground">{task.due}</p>
            </div>
            <Clock className="w-4 h-4 text-muted-foreground/50" />
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
  const firstName = user?.name?.split(" ")[0] || "Farmer";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Welcome Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold tracking-tight">
            Good morning, {firstName} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's what's happening on your farm today.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Stats Grid */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Active Farms"
              value="3"
              change="+1 this month"
              icon={Map}
              color="bg-emerald-500"
            />
            <StatCard
              title="Active Crops"
              value="12"
              change="+3 this month"
              icon={Leaf}
              color="bg-green-500"
            />
            <StatCard
              title="Livestock"
              value="48"
              change="+5 this month"
              icon={Beef}
              color="bg-amber-500"
            />
            <StatCard
              title="Monthly Profit"
              value="$4,250"
              change="+12.5%"
              icon={DollarSign}
              color="bg-blue-500"
            />
          </motion.div>

          {/* Quick Actions */}
          <motion.div variants={itemVariants}>
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              <QuickAction icon={Plus} label="Add Farm" href="/farms/new" color="bg-emerald-500" />
              <QuickAction icon={Sprout} label="Add Crop" href="/crops/new" color="bg-green-500" />
              <QuickAction icon={Beef} label="Add Livestock" href="/livestock/new" color="bg-amber-500" />
              <QuickAction icon={Bot} label="AI Assistant" href="/ai-assistant" color="bg-purple-500" />
              <QuickAction icon={Cloud} label="Weather" href="/weather" color="bg-blue-500" />
              <QuickAction icon={BarChart3} label="Analytics" href="/analytics" color="bg-rose-500" />
            </div>
          </motion.div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
              {/* Farm Health Overview */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Farm Health Overview</CardTitle>
                    <Badge variant="secondary" className="bg-green-500/10 text-green-600 border-green-500/20">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Healthy
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { name: "Green Valley Farm", score: 92, acres: 45 },
                      { name: "Sunrise Ranch", score: 78, acres: 120 },
                      { name: "Riverside Fields", score: 85, acres: 30 },
                    ].map((farm) => (
                      <div key={farm.name} className="p-4 rounded-xl bg-muted/30 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium truncate">{farm.name}</p>
                          <span className="text-xs text-muted-foreground">{farm.acres} ac</span>
                        </div>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Health Score</span>
                            <span className="font-medium">{farm.score}%</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${farm.score}%`,
                                background: farm.score >= 90
                                  ? "linear-gradient(90deg, #22c55e, #16a34a)"
                                  : farm.score >= 70
                                  ? "linear-gradient(90deg, #f59e0b, #d97706)"
                                  : "linear-gradient(90deg, #ef4444, #dc2626)",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity & Tasks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <RecentActivity />
                <UpcomingTasks />
              </div>
            </motion.div>

            {/* Right Column */}
            <motion.div variants={itemVariants} className="space-y-6">
              <WeatherWidget />
              <AIAssistantWidget />
            </motion.div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
