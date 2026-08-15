import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useHaptic } from "@/hooks/use-mobile";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  Thermometer,
  RefreshCw,
  MapPin,
  AlertTriangle,
  Sprout,
  Clock,
  Loader2,
  Sunrise,
  Sunset,
  Gauge,
  LocateFixed,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import { useWeather, useGeolocation } from "@/hooks/use-weather";
import { useUnits } from "@/hooks/use-units";
import { useTimezone } from "@/hooks/use-timezone";

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

function formatTime(timeStr: string, timezone?: string): string {
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) return timeStr;
  return date.toLocaleTimeString("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
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
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div
          className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center"
          role="status"
          aria-live="polite"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10">
            <Loader2 className="h-8 w-8 animate-spin text-brand-foreground dark:text-brand" />
          </div>
          <div>
            <p className="text-base sm:text-lg font-semibold">Loading weather data</p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Fetching real-time conditions from Open-Meteo…
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

// ============================================================
// Hourly Forecast Card
// ============================================================

function HourlyForecast({
  hourly,
  tempValue,
  tempUnit,
}: {
  hourly: import("@/hooks/use-weather").HourlyForecast[];
  tempValue: (celsius: number) => number;
  tempUnit: string;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Hourly Forecast</CardTitle>
          <span className="text-xs font-medium text-muted-foreground">Next 24 hours · {tempUnit}</span>
        </div>
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
                className={`flex flex-col items-center gap-2 p-3 rounded-2xl min-w-[80px] ${
                  isNow
                    ? "bg-brand text-brand-foreground shadow-lg shadow-brand/20"
                    : "bg-muted/50 hover:bg-muted transition-colors"
                }`}
              >
                <span className={`text-xs font-medium ${isNow ? "text-brand-foreground/80" : "text-muted-foreground"}`}>
                  {isNow ? "Now" : time.toLocaleTimeString("en-US", { hour: "numeric", hour12: true })}
                </span>
                <Icon className={`w-6 h-6 ${isNow ? "text-brand-foreground" : "text-foreground/70"}`} />
                <span className="text-lg font-bold tabular-nums">{Math.round(tempValue(hour.temperature))}°</span>
                <div className="flex items-center gap-1">
                  <Droplets className={`w-3 h-3 ${isNow ? "text-brand-foreground/80" : "text-blue-400"}`} />
                  <span className={`text-xs tabular-nums ${isNow ? "text-brand-foreground/80" : "text-muted-foreground"}`}>
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

function WeeklyForecast({
  daily,
  tempValue,
  tempUnit,
  precip,
}: {
  daily: import("@/hooks/use-weather").DailyForecast[];
  tempValue: (celsius: number) => number;
  tempUnit: string;
  precip: (mm: number) => string;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">7-Day Forecast</CardTitle>
          <span className="text-xs font-medium text-muted-foreground">{tempUnit}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {daily.map((day, i) => {
          const Icon = getWeatherIconForCode(day.weatherCode, true);
          const prob = day.precipitationProbabilityMax ?? 0;
          return (
            <motion.div
              key={day.date}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors"
            >
              <span className="w-20 shrink-0 text-sm font-medium">{formatDay(day.date, i)}</span>
              <Icon className="w-5 h-5 shrink-0 text-foreground/70" />
              <div className="flex-1 flex items-center gap-2 min-w-0">
                <span className="text-sm font-semibold w-10 text-right tabular-nums">
                  {Math.round(tempValue(day.tempMax))}°
                </span>
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[100px]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-400 to-orange-400"
                    style={{ width: `${Math.min(100, Math.max(10, ((day.tempMax - day.tempMin) / 25) * 100))}%` }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-10 tabular-nums">
                  {Math.round(tempValue(day.tempMin))}°
                </span>
              </div>
              <div className="flex items-center gap-1 w-24 justify-end shrink-0" title={`Rainfall: ${precip(day.precipitationSum)}`}>
                <Droplets className="w-3 h-3 text-blue-400 shrink-0" />
                <span className="text-xs text-muted-foreground tabular-nums">{precip(day.precipitationSum)}</span>
                {prob > 0 && (
                  <span className="text-xs text-muted-foreground/70 tabular-nums">· {prob}%</span>
                )}
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
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agricultural Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/5 border border-green-500/20">
            <Sprout className="w-5 h-5 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                No active alerts.
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Conditions look good for farming right now.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
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
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold">{alert.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
              </div>
            </div>
          </div>
        ))}
        <Link
          to="/weather-alerts"
          className="inline-flex items-center gap-1 text-sm font-medium text-brand-foreground hover:underline dark:text-brand"
        >
          Open the weather alert center
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Soil Conditions
// ============================================================

function SoilConditions({ soil }: { soil: import("@/hooks/use-weather").SoilData | null }) {
  const { tempValue, tempUnit, isMetric } = useUnits();

  // Honest no-data state: soil values are only ever shown when the backend
  // actually returned a soil record — never invented fallback numbers.
  if (!soil) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Soil Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border/50">
            <Sprout className="w-5 h-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm font-medium">No soil data available</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Soil moisture and temperature are shown once a soil record is available for this location.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Only render rows for fields the provider actually returned — never
  // invented moisture/ET₀ values dressed up as measurements. Soil
  // temperature comes from Open-Meteo in °C and is converted to the
  // user's preferred unit system for display.
  const conditions = [
    { label: "Soil Moisture (Surface)", value: soil.moisture0to1cm * 100, unit: "%", max: 100, icon: Droplets },
    { label: "Soil Temperature (Surface)", value: tempValue(soil.temperature0cm), unit: tempUnit, max: isMetric ? 50 : 120, icon: Thermometer },
    { label: "Soil Moisture (Root Zone)", value: soil.moisture1to3cm !== undefined ? soil.moisture1to3cm * 100 : undefined, unit: "%", max: 100, icon: Droplets },
    { label: "Evapotranspiration (ET₀)", value: soil.et0FaoEvapotranspiration, unit: "mm/day", max: 12, icon: Sun },
  ].filter((c) => c.value !== undefined) as Array<{ label: string; value: number; unit?: string; max: number; icon: React.ComponentType<{ className?: string }> }>;

  return (
    <Card className="border-border/60">
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
              <div className="flex items-center justify-center w-10 h-10 shrink-0 rounded-xl bg-muted/50">
                <Icon className={`w-5 h-5 ${statusColor}`} />
              </div>
              <div className="flex-1 min-w-0">
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
              <span className="text-sm font-semibold tabular-nums shrink-0">
                {item.value.toFixed(1)}{item.unit}
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
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Weather-Based Recommendations</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.map((rec, i) => {
          const icons: Record<string, typeof Sun> = {
            irrigation: Droplets,
            fertilizer: Sprout,
            harvest: Sun,
            spraying: Wind,
          };
          const Icon = icons[rec.category] || Sun;

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
              <div className="min-w-0">
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
  const shouldReduceMotion = useReducedMotion();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const { data, isLoading, error, refetch, setLocation, isDefaultLocation } = useWeather();
  const {
    latitude: geoLatitude,
    longitude: geoLongitude,
    loading: geoLoading,
    error: geoError,
    requestLocation,
  } = useGeolocation();
  const { temp, tempValue, tempUnit, wind, precip } = useUnits();
  const { timezone } = useTimezone();
  const haptic = useHaptic();

  // Real registered farms — used to anchor weather to the farmer's location.
  const farms = useQuery(api.farms.listUserFarms, {});
  const farmOptions = useMemo(
    () =>
      (farms?.page ?? []).filter(
        (f) => f.location?.latitude != null && f.location?.longitude != null
      ),
    [farms]
  );
  const [selectedFarmId, setSelectedFarmId] = useState<string>("");
  const farmAppliedRef = useRef(false);

  // Once farms load, prefer the first registered farm over the default
  // region — unless the user or geolocation already chose a location.
  useEffect(() => {
    if (farmAppliedRef.current) return;
    if (!isDefaultLocation) return;
    if (farmOptions.length === 0) return;
    const farm = farmOptions[0];
    setLocation(farm.location.latitude, farm.location.longitude);
    setSelectedFarmId(farm._id);
    farmAppliedRef.current = true;
  }, [farmOptions, isDefaultLocation, setLocation]);

  // Once the user opts in to geolocation, show weather for their real
  // location instead of a farm/default region.
  useEffect(() => {
    if (geoLatitude != null && geoLongitude != null) {
      setSelectedFarmId("");
      setLocation(geoLatitude, geoLongitude);
    }
  }, [geoLatitude, geoLongitude, setLocation]);

  useEffect(() => {
    if (data) setLastUpdated(new Date());
  }, [data]);

  const handleFarmChange = (farmId: string) => {
    const farm = farmOptions.find((f) => f._id === farmId);
    if (!farm) return;
    haptic.light();
    setSelectedFarmId(farmId);
    setLocation(farm.location.latitude, farm.location.longitude);
  };

  if (isLoading) return <WeatherLoading />;

  if (error || !data) {
    return (
      <AppLayout>
        <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
            </div>
            <div>
              <p className="text-base sm:text-lg font-semibold">Unable to load weather</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{error || "Please try again later."}</p>
            </div>
            <Button
              onClick={() => {
                haptic.medium();
                refetch();
              }}
              variant="outline"
              className="h-11 touch-target rounded-full px-6"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const { current, hourly, daily, soil, location, alerts, recommendations } = data;
  const WeatherIcon = getWeatherIconForCode(current.weatherCode, current.isDay);
  const selectedFarm = farmOptions.find((f) => f._id === selectedFarmId);
  const locationLabel = selectedFarm
    ? selectedFarm.name
    : isDefaultLocation
    ? "Default region"
    : location.name;
  const locationDetail = selectedFarm?.location?.city
    ? [selectedFarm.location.city, selectedFarm.location.country].filter(Boolean).join(", ")
    : isDefaultLocation
    ? "Default region — enable location for your area"
    : "Your current location";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.5 }}
          className="mb-6 md:mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Weather</h1>
              <p className="mt-1 text-sm text-muted-foreground sm:text-base">
                Real-time conditions and agricultural forecasts for your farm.
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="text-right">
                <p className="text-[10px] sm:text-xs text-muted-foreground">Last updated</p>
                <p className="text-xs sm:text-sm font-medium">
                  <Clock className="h-3 w-3 inline mr-1" />
                  {lastUpdated.toLocaleTimeString()}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  haptic.light();
                  refetch();
                }}
                className="h-11 touch-target rounded-full px-5"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial={shouldReduceMotion ? false : "hidden"}
          animate="visible"
          className="space-y-4 sm:space-y-6"
        >
          {/* Current Weather Hero */}
          <motion.div variants={itemVariants}>
            <div className="relative overflow-hidden rounded-3xl bg-brand-deep p-5 sm:p-7 md:p-9 text-white">
              <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand/20 blur-2xl" />
              <div className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full bg-white/5 blur-2xl" />

              <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 lg:gap-10">
                <div className="min-w-0">
                  {/* Location / farm context */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                      <MapPin className="h-3.5 w-3.5 text-brand-foreground" />
                      {locationLabel}
                    </span>
                    {locationDetail && (
                      <span className="text-xs text-white/60">{locationDetail}</span>
                    )}
                    {farmOptions.length > 0 && (
                      <div className="relative">
                        <select
                          value={selectedFarmId}
                          onChange={(e) => handleFarmChange(e.target.value)}
                          aria-label="Select farm for weather"
                          className="appearance-none rounded-full bg-white/10 pl-3 pr-8 py-1 text-xs font-medium text-white backdrop-blur-sm outline-none focus-visible:ring-2 focus-visible:ring-brand cursor-pointer hover:bg-white/15 transition-colors [&>option]:text-foreground [&>option]:bg-background"
                        >
                          <option value="">Choose farm…</option>
                          {farmOptions.map((farm) => (
                            <option key={farm._id} value={farm._id}>
                              {farm.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/70" />
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 rounded-full px-3 text-[11px]"
                      disabled={geoLoading}
                      onClick={() => {
                        haptic.light();
                        requestLocation();
                      }}
                    >
                      <LocateFixed className="h-3 w-3 mr-1" />
                      {geoLoading ? "Locating…" : "Use my location"}
                    </Button>
                    {geoError && isDefaultLocation && (
                      <span className="text-[10px] text-white/70">
                        Location unavailable: {geoError}
                      </span>
                    )}
                  </div>

                  {/* Temperature + condition */}
                  <div className="mt-6 flex items-end gap-4 flex-wrap">
                    <span className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight tabular-nums">
                      {Math.round(tempValue(current.temperature))}
                      <span className="text-3xl sm:text-4xl md:text-5xl text-brand-foreground">{tempUnit}</span>
                    </span>
                    <div className="pb-2">
                      <p className="text-lg font-medium text-white/90">{getWeatherDescription(current.weatherCode)}</p>
                      <p className="text-sm text-white/70">Feels like {temp(Math.round(current.temperature))}</p>
                    </div>
                  </div>

                  {/* Key metrics */}
                  <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                    <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 backdrop-blur-sm">
                      <Thermometer className="h-4 w-4 shrink-0 text-white/70" />
                      <span className="text-sm text-white/85 tabular-nums">
                        H: {Math.round(tempValue(daily[0]?.tempMax ?? current.temperature))}{tempUnit}
                        <span className="text-white/60"> · L: {Math.round(tempValue(daily[0]?.tempMin ?? current.temperature))}{tempUnit}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 backdrop-blur-sm">
                      <Droplets className="h-4 w-4 shrink-0 text-white/70" />
                      <span className="text-sm text-white/85 tabular-nums">Humidity: {current.humidity}%</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 backdrop-blur-sm">
                      <Wind className="h-4 w-4 shrink-0 text-white/70" />
                      <span className="text-sm text-white/85 tabular-nums">
                        Wind: {wind(Math.round(current.windSpeed))} {getWindDirection(current.windDirection)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 backdrop-blur-sm">
                      <CloudRain className="h-4 w-4 shrink-0 text-white/70" />
                      <span className="text-sm text-white/85 tabular-nums">Rain: {precip(current.precipitation)}</span>
                    </div>
                    <div className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5 backdrop-blur-sm">
                      <Gauge className="h-4 w-4 shrink-0 text-white/70" />
                      <span className="text-sm text-white/85 tabular-nums">UV: {current.uvIndex?.toFixed(1) ?? "N/A"}</span>
                    </div>
                  </div>

                  {/* Sunrise/Sunset */}
                  {daily[0]?.sunrise && daily[0]?.sunset && (
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-5 pt-4 border-t border-white/15">
                      <span className="flex items-center gap-2">
                        <Sunrise className="h-4 w-4 text-orange-300" />
                        <span className="text-sm text-white/80">Sunrise {formatTime(daily[0].sunrise, timezone)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Sunset className="h-4 w-4 text-orange-400" />
                        <span className="text-sm text-white/80">Sunset {formatTime(daily[0].sunset, timezone)}</span>
                      </span>
                      {!isDefaultLocation && (
                        <span className="text-xs text-white/50 tabular-nums">
                          {location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center lg:justify-end">
                  <WeatherIcon className="h-32 w-32 sm:h-40 sm:w-40 text-brand drop-shadow-lg" />
                </div>
              </div>
            </div>
          </motion.div>

          {/* Hourly Forecast */}
          <motion.div variants={itemVariants}>
            <HourlyForecast hourly={hourly} tempValue={tempValue} tempUnit={tempUnit} />
          </motion.div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <motion.div variants={itemVariants}>
              <WeeklyForecast daily={daily} tempValue={tempValue} tempUnit={tempUnit} precip={precip} />
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
