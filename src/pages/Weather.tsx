import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useIsMobile, useHaptic } from "@/hooks/use-mobile";
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
  RefreshCw,
  MapPin,
  Calendar,
  AlertTriangle,
  Sprout,
  Clock,
  Navigation,
  Loader2,
  Compass,
  Sunrise,
  Sunset,
  Gauge,
} from "lucide-react";
import { useWeather, useGeolocation } from "@/hooks/use-weather";

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
    transition: { duration: 0.4 },
  },
};

// ============================================================
// Weather Icon Mapping (by WMO code)
// ============================================================

function getWeatherIconForCode(code: number, isDay = true) {
  if (code === 0) return Sun;
  if (code <= 3) return Cloud;
  if (code === 45 || code === 48) return Cloud;
  if (code >= 51 && code <= 57) return CloudRain;
  if (code >= 61 && code <= 67) return CloudRain;
  if (code >= 71 && code <= 77) return CloudSnow;
  if (code >= 80 && code <= 82) return CloudRain;
  if (code >= 85 && code <= 86) return CloudSnow;
  if (code >= 95) return CloudLightning;
  return Sun;
}

function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear Sky", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime Fog", 51: "Light Drizzle", 53: "Moderate Drizzle",
    55: "Dense Drizzle", 61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
    71: "Light Snow", 73: "Moderate Snow", 75: "Heavy Snow",
    80: "Rain Showers", 81: "Moderate Showers", 82: "Heavy Showers",
    95: "Thunderstorm", 96: "Thunderstorm + Hail", 99: "Severe Thunderstorm",
  };
  return descriptions[code] || "Unknown";
}

function formatTime(timeStr: string): string {
  const date = new Date(timeStr);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDay(dateStr: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function getWindDirection(degrees: number): string {
  const dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return dirs[Math.round(degrees / 22.5) % 16];
}

// ============================================================
// Loading State
// ============================================================

function WeatherLoading() {
  return (
    <AppLayout>        <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary animate-spin" />
            <div className="text-center">
              <p className="text-base sm:text-lg font-semibold">Loading Weather Data</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">Fetching real-time weather from Open-Meteo...</p>
            </div>
          </div>
        </div>
    </AppLayout>
  );
}

// ============================================================
// Hourly Forecast Card
// ============================================================

function HourlyForecast({ hourly }: { hourly: import("@/hooks/use-weather").HourlyForecast[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Hourly Forecast (Next 24 Hours)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {hourly.slice(0, 12).map((hour, i) => {
            const Icon = getWeatherIconForCode(hour.weatherCode, hour.isDay !== false);
            const time = new Date(hour.time);
            const isNow = i === 0;
            return (
              <motion.div
                key={hour.time}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl min-w-[80px] ${
                  isNow
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 hover:bg-muted transition-colors"
                }`}
              >
                <span className={`text-xs font-medium ${isNow ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                  {isNow ? "Now" : time.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })}
                </span>
                <Icon className={`w-6 h-6 ${isNow ? "text-yellow-300" : "text-foreground/70"}`} />
                <span className="text-lg font-bold">{Math.round(hour.temperature)}°</span>
                <div className="flex items-center gap-1">
                  <Droplets className={`w-3 h-3 ${isNow ? "text-blue-200" : "text-blue-400"}`} />
                  <span className={`text-xs ${isNow ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                    {hour.precipitationProbability ?? 0}%
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

function WeeklyForecast({ daily }: { daily: import("@/hooks/use-weather").DailyForecast[] }) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">7-Day Forecast</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {daily.map((day, i) => {
          const Icon = getWeatherIconForCode(day.weatherCode, true);
          return (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <span className="w-24 text-sm font-medium">{formatDay(day.date, i)}</span>
              <Icon className="w-5 h-5 text-foreground/70" />
              <div className="flex-1 flex items-center gap-2">
                <span className="text-sm font-semibold w-10 text-right">{Math.round(day.tempMax)}°</span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[100px]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-orange-400"
                    style={{ width: `${((day.tempMax - day.tempMin) / 25) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-10">{Math.round(day.tempMin)}°</span>
              </div>
              <div className="flex items-center gap-1 w-14">
                <Droplets className="w-3 h-3 text-blue-400" />
                <span className="text-xs text-muted-foreground">{day.precipitationProbabilityMax ?? Math.round(day.precipitationSum > 0 ? 80 : 10)}%</span>
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

function AgriWeatherAlerts({ alerts }: { alerts: import("@/hooks/use-weather").WeatherAlert[] }) {
  if (alerts.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agricultural Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
            <Sprout className="w-5 h-5 text-green-500" />
            <p className="text-sm text-green-700 dark:text-green-400">No active alerts. Conditions look good for farming.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

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

function SoilConditions({ soil }: { soil: import("@/hooks/use-weather").SoilData }) {
  const conditions = [
    { label: "Soil Moisture (Surface)", value: soil.moisture0to1cm * 100, unit: "%", max: 100, icon: Droplets },
    { label: "Soil Temperature (Surface)", value: soil.temperature0cm, unit: "°C", max: 50, icon: Thermometer },
    { label: "Soil Moisture (Root Zone)", value: soil.moisture1to3cm * 100, unit: "%", max: 100, icon: Droplets },
    { label: "Evapotranspiration (ET₀)", value: soil.et0FaoEvapotranspiration, unit: "mm/day", max: 12, icon: Sun },
  ];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Soil Conditions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {conditions.map((item, i) => {
          const Icon = item.icon;
          const pct = Math.min(100, (item.value / item.max) * 100);
          const statusColor = item.label.includes("Moisture")
            ? pct > 60 ? "text-blue-500" : pct > 30 ? "text-green-500" : "text-amber-500"
            : "text-orange-500";

          return (
            <div key={i} className="flex items-center gap-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/50">
                <Icon className={`w-5 h-5 ${statusColor}`} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{item.label}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {item.label.includes("Moisture") ? item.value.toFixed(1) : item.value.toFixed(1)}{item.unit}
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

function FarmingRecommendations({ recommendations }: { recommendations: import("@/hooks/use-weather").WeatherRecommendation[] }) {
  if (recommendations.length === 0) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Weather-Based Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec, i) => {
          const icons: Record<string, typeof Calendar> = {
            irrigation: Droplets,
            fertilizer: Sprout,
            harvest: Sun,
            spraying: Wind,
          };
          const Icon = icons[rec.category] || Calendar;

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
  const { data, isLoading, error, refetch } = useWeather();
  const isMobile = useIsMobile();
  const haptic = useHaptic();

  useEffect(() => {
    if (data) setLastUpdated(new Date());
  }, [data]);

  if (isLoading) return <WeatherLoading />;

  if (error || !data) {
    return (
      <AppLayout>          <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
            <AlertTriangle className="w-10 h-10 sm:w-12 sm:h-12 text-amber-500" />
            <div className="text-center">
              <p className="text-base sm:text-lg font-semibold">Unable to Load Weather</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{error || "Please try again later."}</p>
            </div>
            <Button onClick={() => { haptic.medium(); refetch(); }} variant="outline" className="touch-target">
              <RefreshCw className="w-4 h-4 mr-2" />Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const { current, hourly, daily, soil, location, alerts, recommendations } = data;
  const WeatherIcon = getWeatherIconForCode(current.weatherCode, current.isDay);

  return (
    <AppLayout>        <div className="p-3 sm:p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-5 sm:mb-6 md:mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Weather Intelligence</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Real-time weather data and agricultural forecasts
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-right">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Last updated</p>
                <p className="text-xs sm:text-sm font-medium">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { haptic.light(); refetch(); }} className="touch-target">
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
          className="space-y-4 sm:space-y-6"
        >
          {/* Current Weather Hero */}
          <motion.div variants={itemVariants}>
            <div className="gradient-nature rounded-2xl p-4 sm:p-6 md:p-8 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

              <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="text-white/80">{location.name}</span>
                  </div>
                  <div className="flex items-end gap-4 mb-4">
                    <span className="text-4xl sm:text-5xl md:text-6xl font-bold">{Math.round(current.temperature)}°</span>
                    <div className="pb-2">
                      <p className="text-white/90 font-medium">{getWeatherDescription(current.weatherCode)}</p>
                      <p className="text-white/70 text-sm">
                        Feels like {Math.round(current.temperature)}°C
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4 text-white/70" />
                      <span className="text-sm text-white/80">
                        High: {Math.round(daily[0]?.tempMax ?? current.temperature)}° Low: {Math.round(daily[0]?.tempMin ?? current.temperature)}°
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-white/70" />
                      <span className="text-sm text-white/80">Humidity: {current.humidity}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4 text-white/70" />
                      <span className="text-sm text-white/80">
                        Wind: {Math.round(current.windSpeed)} km/h {getWindDirection(current.windDirection)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-white/70" />
                      <span className="text-sm text-white/80">UV Index: {current.uvIndex?.toFixed(1) ?? "N/A"}</span>
                    </div>
                  </div>
                  {/* Sunrise/Sunset */}
                  {daily[0]?.sunrise && daily[0]?.sunset && (
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/20">
                      <div className="flex items-center gap-2">
                        <Sunrise className="w-4 h-4 text-orange-300" />
                        <span className="text-sm text-white/80">{formatTime(daily[0].sunrise)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sunset className="w-4 h-4 text-orange-400" />
                        <span className="text-sm text-white/80">{formatTime(daily[0].sunset)}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center">
                  <WeatherIcon className="w-32 h-32 text-yellow-300 drop-shadow-lg" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Hourly Forecast */}
          <motion.div variants={itemVariants}>
            <HourlyForecast hourly={hourly} />
          </motion.div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <motion.div variants={itemVariants}>
              <WeeklyForecast daily={daily} />
            </motion.div>
            <motion.div variants={itemVariants} className="space-y-4 sm:space-y-6">
              <SoilConditions soil={soil} />
              <AgriWeatherAlerts alerts={alerts} />
            </motion.div>
          </div>

          {/* Recommendations */}
          <motion.div variants={itemVariants}>
            <FarmingRecommendations recommendations={recommendations} />
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
