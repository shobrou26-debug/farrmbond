import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  Eye,
  Umbrella,
  RefreshCw,
  MapPin,
  Calendar,
  TrendingUp,
  AlertTriangle,
  Sprout,
  Clock,
} from "lucide-react";

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
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
// Weather Icon Mapping
// ============================================================

function getWeatherIcon(condition: string) {
  switch (condition.toLowerCase()) {
    case "sunny":
    case "clear":
      return Sun;
    case "cloudy":
    case "partly cloudy":
    case "overcast":
      return Cloud;
    case "rain":
    case "rainy":
    case "drizzle":
      return CloudRain;
    case "snow":
    case "snowy":
      return CloudSnow;
    case "thunderstorm":
      return CloudLightning;
    default:
      return Sun;
  }
}

// ============================================================
// Hourly Forecast Card
// ============================================================

function HourlyForecast() {
  const hours = [
    { time: "Now", temp: 24, condition: "Partly Cloudy", rain: 10 },
    { time: "1PM", temp: 26, condition: "Sunny", rain: 5 },
    { time: "2PM", temp: 27, condition: "Sunny", rain: 5 },
    { time: "3PM", temp: 28, condition: "Partly Cloudy", rain: 15 },
    { time: "4PM", temp: 27, condition: "Cloudy", rain: 25 },
    { time: "5PM", temp: 25, condition: "Cloudy", rain: 30 },
    { time: "6PM", temp: 23, condition: "Rain", rain: 60 },
    { time: "7PM", temp: 22, condition: "Rain", rain: 70 },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Hourly Forecast</CardTitle>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Nairobi, Kenya</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {hours.map((hour, i) => {
            const Icon = getWeatherIcon(hour.condition);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl min-w-[80px] ${
                  i === 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 hover:bg-muted transition-colors"
                }`}
              >
                <span className={`text-xs font-medium ${i === 0 ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {hour.time}
                </span>
                <Icon className={`w-6 h-6 ${i === 0 ? "text-yellow-300" : "text-foreground/70"}`} />
                <span className="text-lg font-bold">{hour.temp}°</span>
                <div className="flex items-center gap-1">
                  <Droplets className={`w-3 h-3 ${i === 0 ? "text-blue-200" : "text-blue-400"}`} />
                  <span className={`text-xs ${i === 0 ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {hour.rain}%
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 7-Day Forecast Card
// ============================================================

function WeeklyForecast() {
  const days = [
    { day: "Today", high: 28, low: 18, condition: "Partly Cloudy", rain: 20, icon: Cloud },
    { day: "Tomorrow", high: 26, low: 17, condition: "Rain", rain: 80, icon: CloudRain },
    { day: "Wednesday", high: 24, low: 16, condition: "Rain", rain: 90, icon: CloudRain },
    { day: "Thursday", high: 25, low: 17, condition: "Cloudy", rain: 40, icon: Cloud },
    { day: "Friday", high: 27, low: 18, condition: "Partly Cloudy", rain: 15, icon: Cloud },
    { day: "Saturday", high: 29, low: 19, condition: "Sunny", rain: 5, icon: Sun },
    { day: "Sunday", high: 30, low: 20, condition: "Sunny", rain: 0, icon: Sun },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">7-Day Forecast</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {days.map((day, i) => {
          const Icon = day.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <span className="w-24 text-sm font-medium">{day.day}</span>
              <Icon className="w-5 h-5 text-foreground/70" />
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm font-semibold">{day.high}°</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[100px]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-orange-400"
                    style={{ width: `${((day.high - 15) / 20) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground">{day.low}°</span>
              </div>
              <div className="flex items-center gap-1 w-12">
                <Droplets className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-muted-foreground">{day.rain}%</span>
              </div>
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Agriculture Weather Alerts
// ============================================================

function AgriWeatherAlerts() {
  const alerts = [
    {
      type: "rain",
      severity: "high",
      title: "Heavy Rain Expected",
      message: "Heavy rainfall expected tomorrow through Wednesday. Consider delaying fertilizer application and ensuring proper drainage.",
      time: "Issued 2 hours ago",
    },
    {
      type: "frost",
      severity: "low",
      title: "Frost Risk Next Week",
      message: "Night temperatures may drop below 5°C on Saturday night. Protect sensitive crops.",
      time: "Issued 1 day ago",
    },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Agricultural Alerts</CardTitle>
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            {alerts.length} Active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert, i) => (
          <div
            key={i}
            className={`p-4 rounded-xl border-l-4 ${
              alert.severity === "high"
                ? "border-red-500 bg-red-500/5"
                : alert.severity === "medium"
                ? "border-amber-500 bg-amber-500/5"
                : "border-blue-500 bg-blue-500/5"
            }`}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  alert.severity === "high"
                    ? "text-red-500"
                    : alert.severity === "medium"
                    ? "text-amber-500"
                    : "text-blue-500"
                }`}
              />
              <div className="flex-1">
                <h4 className="text-sm font-semibold">{alert.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                <p className="text-xs text-muted-foreground/70 mt-2">{alert.time}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Soil Conditions
// ============================================================

function SoilConditions() {
  const conditions = [
    { label: "Soil Moisture", value: 42, unit: "%", status: "optimal", icon: Droplets },
    { label: "Soil Temperature", value: 22, unit: "°C", status: "optimal", icon: Thermometer },
    { label: "Soil pH", value: 6.5, unit: "", status: "optimal", icon: Sprout },
    { label: "Evapotranspiration", value: 4.2, unit: "mm/day", status: "normal", icon: Sun },
  ];

  const statusColors = {
    optimal: "text-green-500",
    warning: "text-amber-500",
    normal: "text-blue-500",
    critical: "text-red-500",
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Soil Conditions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {conditions.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/50">
                <Icon className={`w-5 h-5 ${statusColors[item.status as keyof typeof statusColors]}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.status === "optimal"
                          ? "bg-green-500"
                          : item.status === "warning"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                      }`}
                      style={{
                        width: `${
                          item.label === "Soil Moisture"
                            ? item.value
                            : item.label === "Soil Temperature"
                            ? (item.value / 40) * 100
                            : item.label === "Soil pH"
                            ? (item.value / 14) * 100
                            : 50
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {item.value}{item.unit}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Farming Recommendations
// ============================================================

function FarmingRecommendations() {
  const recommendations = [
    {
      title: "Delay Planting",
      description: "Wait until Wednesday when the rain subsides before planting new seeds.",
      icon: Calendar,
      priority: "high",
    },
    {
      title: "Optimal Irrigation",
      description: "With expected rainfall, reduce irrigation by 50% this week.",
      icon: Droplets,
      priority: "medium",
    },
    {
      title: "Harvest Window",
      description: "Saturday and Sunday offer ideal conditions for harvesting mature crops.",
      icon: Sun,
      priority: "low",
    },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Weather-Based Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec, i) => {
          const Icon = rec.icon;
          return (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${
                  rec.priority === "high"
                    ? "bg-red-500/10 text-red-500"
                    : rec.priority === "medium"
                    ? "bg-amber-500/10 text-amber-500"
                    : "bg-green-500/10 text-green-500"
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-semibold">{rec.title}</h4>
                <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Weather Page
// ============================================================

export default function Weather() {
  const [lastUpdated, setLastUpdated] = useState(new Date());

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
              <h1 className="text-3xl font-bold tracking-tight">Weather Intelligence</h1>
              <p className="text-muted-foreground mt-1">
                Real-time weather data and agricultural forecasts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Last updated</p>
                <p className="text-sm font-medium">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLastUpdated(new Date())}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Current Weather Hero */}
          <motion.div variants={itemVariants}>
            <div className="gradient-nature rounded-2xl p-6 md:p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-white/80">Nairobi, Kenya</span>
                  </div>
                  <div className="flex items-end gap-4 mb-4">
                    <span className="text-6xl font-bold">24°</span>
                    <div className="pb-2">
                      <p className="text-white/90 font-medium">Partly Cloudy</p>
                      <p className="text-white/70 text-sm">Feels like 26°C</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-white/70" />
                      <span className="text-sm text-white/80">High: 28° Low: 18°</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-white/70" />
                      <span className="text-sm text-white/80">Humidity: 65%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-white/70" />
                      <span className="text-sm text-white/80">Wind: 12 km/h NW</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4 text-white/70" />
                      <span className="text-sm text-white/80">Visibility: 10 km</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <Sun className="w-32 h-32 text-yellow-300 drop-shadow-lg" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Hourly Forecast */}
          <motion.div variants={itemVariants}>
            <HourlyForecast />
          </motion.div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <WeeklyForecast />
            </motion.div>
            <motion.div variants={itemVariants} className="space-y-6">
              <SoilConditions />
              <AgriWeatherAlerts />
            </motion.div>
          </div>

          {/* Recommendations */}
          <motion.div variants={itemVariants}>
            <FarmingRecommendations />
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
