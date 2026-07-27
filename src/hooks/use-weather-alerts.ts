import { useState, useEffect, useCallback, useRef } from "react";
import { useWeather, WeatherAlert, DailyForecast, CurrentWeather, SoilData } from "./use-weather";

// ============================================================
// Types
// ============================================================
export interface WeatherAlertConfig {
  enabled: boolean;
  types: AlertType[];
  severityThreshold: "low" | "medium" | "high";
  pushNotifications: boolean;
  emailNotifications: boolean;
  checkInterval: number; // minutes
  location: { latitude: number; longitude: number };
}

export type AlertType =
  | "heavy_rain"
  | "flood"
  | "drought"
  | "frost"
  | "heat_wave"
  | "strong_wind"
  | "thunderstorm"
  | "hail"
  | "high_uv"
  | "soil_moisture_low"
  | "soil_moisture_high"
  | "optimal_spraying"
  | "optimal_harvest"
  | "optimal_planting"
  | "optimal_fertilizer";

export interface ExtendedWeatherAlert extends WeatherAlert {
  id: string;
  timestamp: Date;
  expiresAt: Date;
  acknowledged: boolean;
  priority: "critical" | "high" | "medium" | "low";
  category: "severe" | "advisory" | "opportunity";
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  recommendations: string[];
  affectedCrops?: string[];
  estimatedImpact?: string;
  source: string;
}

export interface AlertHistory {
  id: string;
  alert: ExtendedWeatherAlert;
  triggeredAt: Date;
  acknowledgedAt?: Date;
  dismissedAt?: Date;
}

export interface WeatherAlertStats {
  totalAlerts: number;
  activeAlerts: number;
  criticalAlerts: number;
  todayAlerts: number;
  lastCheck: Date | null;
  nextCheck: Date | null;
}

// ============================================================
// Alert Configuration Defaults
// ============================================================
const defaultConfig: WeatherAlertConfig = {
  enabled: true,
  types: [
    "heavy_rain",
    "flood",
    "drought",
    "frost",
    "heat_wave",
    "strong_wind",
    "thunderstorm",
    "hail",
    "high_uv",
    "soil_moisture_low",
    "optimal_spraying",
    "optimal_harvest",
    "optimal_planting",
    "optimal_fertilizer",
  ],
  severityThreshold: "low",
  pushNotifications: true,
  emailNotifications: false,
  checkInterval: 30,
  location: { latitude: -1.2921, longitude: 36.8219 },
};

// ============================================================
// Alert Type Configuration
// ============================================================
const alertTypeConfig: Record<AlertType, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  category: "severe" | "advisory" | "opportunity";
}> = {
  heavy_rain: { label: "Heavy Rain", icon: "🌧️", color: "text-blue-600", bgColor: "bg-blue-50", borderColor: "border-blue-200", category: "severe" },
  flood: { label: "Flood Risk", icon: "🌊", color: "text-blue-700", bgColor: "bg-blue-100", borderColor: "border-blue-300", category: "severe" },
  drought: { label: "Drought Warning", icon: "☀️", color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-orange-200", category: "severe" },
  frost: { label: "Frost Alert", icon: "❄️", color: "text-cyan-600", bgColor: "bg-cyan-50", borderColor: "border-cyan-200", category: "severe" },
  heat_wave: { label: "Heat Wave", icon: "🔥", color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200", category: "severe" },
  strong_wind: { label: "Strong Wind", icon: "💨", color: "text-gray-600", bgColor: "bg-gray-50", borderColor: "border-gray-200", category: "advisory" },
  thunderstorm: { label: "Thunderstorm", icon: "⛈️", color: "text-purple-600", bgColor: "bg-purple-50", borderColor: "border-purple-200", category: "severe" },
  hail: { label: "Hail Warning", icon: "🧊", color: "text-indigo-600", bgColor: "bg-indigo-50", borderColor: "border-indigo-200", category: "severe" },
  high_uv: { label: "High UV Index", icon: "☀️", color: "text-yellow-600", bgColor: "bg-yellow-50", borderColor: "border-yellow-200", category: "advisory" },
  soil_moisture_low: { label: "Low Soil Moisture", icon: "🏜️", color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-200", category: "advisory" },
  soil_moisture_high: { label: "High Soil Moisture", icon: "💧", color: "text-blue-500", bgColor: "bg-blue-50", borderColor: "border-blue-200", category: "advisory" },
  optimal_spraying: { label: "Good Spraying Window", icon: "💊", color: "text-green-600", bgColor: "bg-green-50", borderColor: "border-green-200", category: "opportunity" },
  optimal_harvest: { label: "Harvest Opportunity", icon: "🌾", color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-200", category: "opportunity" },
  optimal_planting: { label: "Planting Window", icon: "🌱", color: "text-green-500", bgColor: "bg-green-50", borderColor: "border-green-200", category: "opportunity" },
  optimal_fertilizer: { label: "Fertilizer Window", icon: "🧪", color: "text-emerald-600", bgColor: "bg-emerald-50", borderColor: "border-emerald-200", category: "opportunity" },
};

// ============================================================
// Alert Generation Engine
// ============================================================
function generateExtendedAlerts(
  current: CurrentWeather,
  daily: DailyForecast[],
  soil: SoilData,
  config: WeatherAlertConfig
): ExtendedWeatherAlert[] {
  const alerts: ExtendedWeatherAlert[] = [];
  const now = new Date();

  // Helper to check if alert type is enabled
  const isEnabled = (type: AlertType) => config.types.includes(type);

  // Helper to create alert
  const createAlert = (
    type: AlertType,
    severity: "critical" | "high" | "medium" | "low",
    title: string,
    message: string,
    recommendations: string[],
    options?: {
      expiresAt?: Date;
      affectedCrops?: string[];
      estimatedImpact?: string;
    }
  ): ExtendedWeatherAlert => {
    const config2 = alertTypeConfig[type];
    return {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      severity,
      title,
      message,
      timestamp: now,
      expiresAt: options?.expiresAt || new Date(now.getTime() + 24 * 60 * 60 * 1000),
      acknowledged: false,
      priority: severity,
      category: config2.category,
      icon: config2.icon,
      color: config2.color,
      bgColor: config2.bgColor,
      borderColor: config2.borderColor,
      recommendations,
      affectedCrops: options?.affectedCrops,
      estimatedImpact: options?.estimatedImpact,
      source: "Open-Meteo Weather API",
    };
  };

  // ==========================================
  // SEVERE WEATHER ALERTS
  // ==========================================

  // Heavy Rain Alert ( > 20mm)
  if (isEnabled("heavy_rain")) {
    const heavyRainDays = daily.filter((d) => d.precipitationSum > 20);
    if (heavyRainDays.length > 0) {
      const day = heavyRainDays[0];
      alerts.push(
        createAlert(
          "heavy_rain",
          day.precipitationSum > 50 ? "critical" : "high",
          "Heavy Rain Warning",
          `${day.precipitationSum.toFixed(1)}mm of rain expected on ${day.date}. Risk of flooding and crop damage.`,
          [
            "Clear drainage channels immediately",
            "Delay field operations and spraying",
            "Move livestock to higher ground if needed",
            "Harvest mature crops before the rain",
            "Secure harvested produce in waterproof storage",
          ],
          {
            expiresAt: new Date(day.date + "T23:59:59"),
            affectedCrops: ["Maize", "Beans", "Vegetables"],
            estimatedImpact: "Potential yield loss of 10-30% if not protected",
          }
        )
      );
    }
  }

  // Flood Risk ( > 30mm in a day with saturated soil)
  if (isEnabled("flood")) {
    const floodRisk = daily.find(
      (d) => d.precipitationSum > 30 && soil.moisture0to1cm > 0.35
    );
    if (floodRisk) {
      alerts.push(
        createAlert(
          "flood",
          "critical",
          "Flood Risk Warning",
          `High rainfall combined with saturated soil creates flood risk on ${floodRisk.date}.`,
          [
            "Evacuate low-lying areas if necessary",
            "Move equipment to higher ground",
            "Document crop conditions for insurance",
            "Check and clear all drainage systems",
            "Monitor weather updates frequently",
          ],
          {
            expiresAt: new Date(floodRisk.date + "T23:59:59"),
            affectedCrops: ["All crops in low-lying areas"],
            estimatedImpact: "Complete crop loss possible in flooded areas",
          }
        )
      );
    }
  }

  // Drought Warning (soil moisture < 0.15 for 3+ days)
  if (isEnabled("drought")) {
    const lowMoistureDays = daily.filter((d) => d.precipitationSum < 1);
    if (lowMoistureDays.length >= 3 && soil.moisture0to1cm < 0.15) {
      alerts.push(
        createAlert(
          "drought",
          "high",
          "Drought Warning",
          `Extended dry period with critically low soil moisture (${(soil.moisture0to1cm * 100).toFixed(0)}%).`,
          [
            "Increase irrigation frequency immediately",
            "Apply mulch to conserve soil moisture",
            "Prioritize irrigation for most vulnerable crops",
            "Consider drought-tolerant varieties for next season",
            "Monitor crop stress indicators daily",
          ],
          {
            affectedCrops: ["All crops", "Pasture"],
            estimatedImpact: "Yield reduction of 20-50% without intervention",
          }
        )
      );
    }
  }

  // Frost Alert
  if (isEnabled("frost")) {
    const frostDays = daily.filter((d) => d.tempMin < 5);
    if (frostDays.length > 0) {
      const day = frostDays[0];
      alerts.push(
        createAlert(
          "frost",
          day.tempMin < 2 ? "critical" : "high",
          "Frost Warning",
          `Temperatures expected to drop to ${day.tempMin.toFixed(1)}°C on ${day.date}.`,
          [
            "Cover sensitive crops with frost blankets",
            "Irrigate before frost to protect root zones",
            "Use frost protection methods (smudge pots, sprinklers)",
            "Delay transplanting of seedlings",
            "Harvest frost-sensitive crops immediately",
          ],
          {
            expiresAt: new Date(day.date + "T09:00:00"),
            affectedCrops: ["Tomatoes", "Peppers", "Beans", "Seedlings"],
            estimatedImpact: "Severe damage or death to sensitive crops",
          }
        )
      );
    }
  }

  // Heat Wave ( > 35°C for 3+ days)
  if (isEnabled("heat_wave")) {
    const hotDays = daily.filter((d) => d.tempMax > 35);
    if (hotDays.length >= 3) {
      alerts.push(
        createAlert(
          "heat_wave",
          "high",
          "Heat Wave Alert",
          `Temperatures above 35°C expected for ${hotDays.length} consecutive days.`,
          [
            "Increase irrigation to compensate for evaporation",
            "Provide shade for livestock",
            "Avoid field work during peak heat hours (11am-3pm)",
            "Monitor crops for heat stress signs",
            "Ensure adequate water supply for workers",
          ],
          {
            affectedCrops: ["All crops", "Livestock"],
            estimatedImpact: "Heat stress can reduce yields by 15-40%",
          }
        )
      );
    }
  }

  // Strong Wind ( > 40 km/h)
  if (isEnabled("strong_wind")) {
    if (current.windSpeed > 40 || daily.some((d) => d.windSpeedMax > 40)) {
      alerts.push(
        createAlert(
          "strong_wind",
          current.windSpeed > 60 ? "critical" : "medium",
          "Strong Wind Advisory",
          `Wind speeds of ${Math.max(current.windSpeed, ...daily.map((d) => d.windSpeedMax)).toFixed(0)} km/h expected.`,
          [
            "Secure all loose structures and equipment",
            "Delay spraying operations (drift risk)",
            "Check and reinforce tree supports",
            "Postpone harvesting of standing crops",
            "Monitor greenhouse structures",
          ],
          {
            affectedCrops: ["Tall crops", "Fruiting trees"],
            estimatedImpact: "Physical damage to crops and structures",
          }
        )
      );
    }
  }

  // Thunderstorm
  if (isEnabled("thunderstorm")) {
    const thunderstormCodes = [95, 96, 99];
    if (
      thunderstormCodes.includes(current.weatherCode) ||
      daily.some((d) => thunderstormCodes.includes(d.weatherCode))
    ) {
      alerts.push(
        createAlert(
          "thunderstorm",
          "high",
          "Thunderstorm Warning",
          "Thunderstorms expected with potential for lightning, heavy rain, and hail.",
          [
            "Seek shelter immediately when storm approaches",
            "Disconnect electrical equipment",
            "Avoid open fields and tall isolated trees",
            "Secure livestock in sheltered areas",
            "Check for damage after storm passes",
          ],
          {
            affectedCrops: ["All crops"],
            estimatedImpact: "Physical damage from wind, hail, and flooding",
          }
        )
      );
    }
  }

  // Hail Warning
  if (isEnabled("hail")) {
    if (current.weatherCode === 96 || current.weatherCode === 99) {
      alerts.push(
        createAlert(
          "hail",
          "critical",
          "Hail Warning",
          "Hailstorm expected with potential for severe crop damage.",
          [
            "Deploy hail nets if available",
            "Move vehicles under cover",
            "Document pre-storm crop condition",
            "Check crop insurance coverage",
            "Prepare for damage assessment after storm",
          ],
          {
            affectedCrops: ["All exposed crops"],
            estimatedImpact: "Complete crop loss possible in severe hail",
          }
        )
      );
    }
  }

  // ==========================================
  // ADVISORY ALERTS
  // ==========================================

  // High UV Index
  if (isEnabled("high_uv")) {
    if (current.uvIndex >= 8 || daily.some((d) => d.uvIndexMax >= 8)) {
      alerts.push(
        createAlert(
          "high_uv",
          current.uvIndex >= 11 ? "high" : "medium",
          "High UV Index Alert",
          `UV index at ${Math.max(current.uvIndex, ...daily.map((d) => d.uvIndexMax))}. Risk of sunburn and heat stress.`,
          [
            "Avoid field work between 10am-4pm",
            "Wear protective clothing and sunscreen",
            "Provide shade for workers and livestock",
            "Increase irrigation due to high evaporation",
            "Monitor crops for sunscald damage",
          ],
          {
            affectedCrops: ["Fruits", "Leafy vegetables"],
            estimatedImpact: "Sunscald damage to exposed produce",
          }
        )
      );
    }
  }

  // Low Soil Moisture
  if (isEnabled("soil_moisture_low")) {
    if (soil.moisture0to1cm < 0.15) {
      alerts.push(
        createAlert(
          "soil_moisture_low",
          soil.moisture0to1cm < 0.1 ? "high" : "medium",
          "Low Soil Moisture Alert",
          `Soil moisture at ${(soil.moisture0to1cm * 100).toFixed(0)}% is below optimal levels.`,
          [
            "Increase irrigation frequency",
            "Apply mulch to reduce evaporation",
            "Check irrigation system for efficiency",
            "Prioritize water for most critical growth stages",
            "Consider deficit irrigation strategies",
          ],
          {
            affectedCrops: ["All crops"],
            estimatedImpact: "Reduced growth and yield if not addressed",
          }
        )
      );
    }
  }

  // High Soil Moisture
  if (isEnabled("soil_moisture_high")) {
    if (soil.moisture0to1cm > 0.5) {
      alerts.push(
        createAlert(
          "soil_moisture_high",
          "medium",
          "High Soil Moisture Advisory",
          `Soil moisture at ${(soil.moisture0to1cm * 100).toFixed(0)}% is above optimal. Risk of waterlogging.`,
          [
            "Reduce or stop irrigation",
            "Improve field drainage",
            "Monitor for root rot symptoms",
            "Delay fertilizer application",
            "Avoid heavy machinery on wet soil",
          ],
          {
            affectedCrops: ["Root crops", "Seedlings"],
            estimatedImpact: "Root rot and oxygen stress",
          }
        )
      );
    }
  }

  // ==========================================
  // OPPORTUNITY ALERTS
  // ==========================================

  // Optimal Spraying Window
  if (isEnabled("optimal_spraying")) {
    const sprayingDays = daily.filter(
      (d) => d.windSpeedMax < 15 && d.precipitationSum < 1
    );
    const tomorrow = sprayingDays.find((d) => {
      const date = new Date(d.date);
      const today = new Date();
      return date.getTime() - today.getTime() < 2 * 24 * 60 * 60 * 1000;
    });
    if (tomorrow && current.windSpeed < 15) {
      alerts.push(
        createAlert(
          "optimal_spraying",
          "low",
          "Optimal Spraying Window",
          `Good conditions for pesticide/fungicide application. Low wind and no rain expected.`,
          [
            "Apply pesticides/fungicides now",
            "Use appropriate PPE",
            "Follow label instructions carefully",
            "Monitor weather for changes",
            "Document application details",
          ],
          {
            expiresAt: new Date(tomorrow.date + "T18:00:00"),
            estimatedImpact: "Improved pesticide efficacy",
          }
        )
      );
    }
  }

  // Optimal Harvest Window
  if (isEnabled("optimal_harvest")) {
    const dryDays = daily.filter((d) => d.precipitationSum < 1 && d.precipitationProbabilityMax < 20);
    if (dryDays.length >= 3) {
      alerts.push(
        createAlert(
          "optimal_harvest",
          "low",
          "Harvest Window Available",
          `${dryDays.length} consecutive dry days expected. Ideal for harvesting mature crops.`,
          [
            "Harvest mature crops during this window",
            "Prepare drying and storage facilities",
            "Arrange transportation and labor",
            "Quality check before harvest",
            "Document yield for records",
          ],
          {
            expiresAt: new Date(dryDays[dryDays.length - 1].date + "T23:59:59"),
            estimatedImpact: "Optimal harvest quality and minimal losses",
          }
        )
      );
    }
  }

  // Optimal Planting Window
  if (isEnabled("optimal_planting")) {
    const plantingWindow = daily.find(
      (d) => d.precipitationSum > 5 && d.precipitationSum < 20 && d.tempMin > 10
    );
    if (plantingWindow) {
      alerts.push(
        createAlert(
          "optimal_planting",
          "low",
          "Planting Window",
          `Good soil moisture expected from upcoming rain. Consider planting.`,
          [
            "Prepare seedbed before rain",
            "Select appropriate seed varieties",
            "Plan planting schedule",
            "Ensure adequate seed supply",
            "Check soil temperature for germination",
          ],
          {
            expiresAt: new Date(plantingWindow.date + "T23:59:59"),
            estimatedImpact: "Improved germination and establishment",
          }
        )
      );
    }
  }

  // Optimal Fertilizer Window
  if (isEnabled("optimal_fertilizer")) {
    const fertilizerWindow = daily.find(
      (d) => d.precipitationSum > 2 && d.precipitationSum < 10 && d.precipitationProbabilityMax > 30
    );
    if (fertilizerWindow) {
      alerts.push(
        createAlert(
          "optimal_fertilizer",
          "low",
          "Fertilizer Application Window",
          `Light rain expected to help incorporate fertilizer into soil.`,
          [
            "Apply fertilizer before rain",
            "Use appropriate rates for crop stage",
            "Ensure even distribution",
            "Avoid application on waterlogged soil",
            "Record fertilizer types and rates",
          ],
          {
            expiresAt: new Date(fertilizerWindow.date + "T12:00:00"),
            estimatedImpact: "Improved nutrient uptake efficiency",
          }
        )
      );
    }
  }

  return alerts;
}

// ============================================================
// Main Hook
// ============================================================
interface UseWeatherAlertsReturn {
  alerts: ExtendedWeatherAlert[];
  alertHistory: AlertHistory[];
  config: WeatherAlertConfig;
  stats: WeatherAlertStats;
  isLoading: boolean;
  error: string | null;
  lastCheck: Date | null;
  nextCheck: Date | null;
  updateConfig: (updates: Partial<WeatherAlertConfig>) => void;
  acknowledgeAlert: (id: string) => void;
  dismissAlert: (id: string) => void;
  clearHistory: () => void;
  checkNow: () => void;
  getAlertsByType: (type: AlertType) => ExtendedWeatherAlert[];
  getAlertsByCategory: (category: "severe" | "advisory" | "opportunity") => ExtendedWeatherAlert[];
}

export function useWeatherAlerts(
  weatherOptions?: { latitude?: number; longitude?: number }
): UseWeatherAlertsReturn {
  const [config, setConfig] = useState<WeatherAlertConfig>(() => {
    const stored = localStorage.getItem("farmbond-alert-config");
    if (stored) {
      try {
        return { ...defaultConfig, ...JSON.parse(stored) };
      } catch {
        return defaultConfig;
      }
    }
    return {
      ...defaultConfig,
      location: {
        latitude: weatherOptions?.latitude ?? -1.2921,
        longitude: weatherOptions?.longitude ?? 36.8219,
      },
    };
  });

  const [alerts, setAlerts] = useState<ExtendedWeatherAlert[]>([]);
  const [alertHistory, setAlertHistory] = useState<AlertHistory[]>(() => {
    const stored = localStorage.getItem("farmbond-alert-history");
    if (stored) {
      try {
        return JSON.parse(stored).map((h: AlertHistory) => ({
          ...h,
          triggeredAt: new Date(h.triggeredAt),
          acknowledgedAt: h.acknowledgedAt ? new Date(h.acknowledgedAt) : undefined,
          dismissedAt: h.dismissedAt ? new Date(h.dismissedAt) : undefined,
          alert: { ...h.alert, timestamp: new Date(h.alert.timestamp), expiresAt: new Date(h.alert.expiresAt) },
        }));
      } catch {
        return [];
      }
    }
    return [];
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<Date | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use weather hook for data
  const { data: weatherData, isLoading: weatherLoading } = useWeather({
    latitude: config.location.latitude,
    longitude: config.location.longitude,
  });

  // Generate alerts when weather data changes
  useEffect(() => {
    if (weatherData && !weatherLoading) {
      setIsLoading(true);
      try {
        const newAlerts = generateExtendedAlerts(
          weatherData.current,
          weatherData.daily,
          weatherData.soil,
          config
        );

        // Filter by severity threshold
        const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 };
        const thresholdIndex = severityOrder[config.severityThreshold as keyof typeof severityOrder];
        const filteredAlerts = newAlerts.filter(
          (a) => severityOrder[a.severity] >= thresholdIndex
        );

        // Only add new alerts (not already in history)
        const existingTypes = new Set(
          alertHistory
            .filter((h) => {
              const age = Date.now() - h.triggeredAt.getTime();
              return age < 24 * 60 * 60 * 1000; // Last 24 hours
            })
            .map((h) => h.alert.type)
        );

        const trulyNewAlerts = filteredAlerts.filter(
          (a) => !existingTypes.has(a.type)
        );

        // Add to history
        if (trulyNewAlerts.length > 0) {
          const newHistory = trulyNewAlerts.map((alert) => ({
            id: alert.id,
            alert,
            triggeredAt: new Date(),
          }));

          setAlertHistory((prev) => {
            const updated = [...newHistory, ...prev].slice(0, 100);
            localStorage.setItem("farmbond-alert-history", JSON.stringify(updated));
            return updated;
          });

          // Send push notifications for critical/high severity
          if (config.pushNotifications && "Notification" in window && Notification.permission === "granted") {
            trulyNewAlerts
              .filter((a) => a.severity === "critical" || a.severity === "high")
              .forEach((alert) => {
                try {
                  new Notification(`${alert.icon} ${alert.title}`, {
                    body: alert.message,
                    icon: "/icons/icon-192.png",
                    tag: `weather-alert-${alert.type}`,
                    requireInteraction: alert.severity === "critical",
                  });
                } catch (e) {
                  console.error("Failed to send notification:", e);
                }
              });
          }
        }

        setAlerts(filteredAlerts);
        setLastCheck(new Date());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate alerts");
      } finally {
        setIsLoading(false);
      }
    }
  }, [weatherData, weatherLoading, config]);

  // Set up periodic checking
  useEffect(() => {
    if (config.enabled) {
      checkIntervalRef.current = setInterval(() => {
        // Trigger re-check by updating a dependency
        setLastCheck(new Date());
      }, config.checkInterval * 60 * 1000);

      return () => {
        if (checkIntervalRef.current) {
          clearInterval(checkIntervalRef.current);
        }
      };
    }
  }, [config.enabled, config.checkInterval]);

  // Clean up expired alerts
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = new Date();
      setAlerts((prev) => prev.filter((a) => a.expiresAt > now));
    }, 60 * 1000);

    return () => clearInterval(cleanup);
  }, []);

  // Save config to localStorage
  useEffect(() => {
    localStorage.setItem("farmbond-alert-config", JSON.stringify(config));
  }, [config]);

  // Calculate stats
  const stats: WeatherAlertStats = {
    totalAlerts: alertHistory.length,
    activeAlerts: alerts.filter((a) => !a.acknowledged).length,
    criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
    todayAlerts: alertHistory.filter((h) => {
      const today = new Date();
      const hDate = new Date(h.triggeredAt);
      return hDate.toDateString() === today.toDateString();
    }).length,
    lastCheck,
    nextCheck: lastCheck
      ? new Date(lastCheck.getTime() + config.checkInterval * 60 * 1000)
      : null,
  };

  // Update config
  const updateConfig = useCallback((updates: Partial<WeatherAlertConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  // Acknowledge alert
  const acknowledgeAlert = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
    setAlertHistory((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, acknowledgedAt: new Date() } : h
      )
    );
  }, []);

  // Dismiss alert
  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    setAlertHistory((prev) =>
      prev.map((h) =>
        h.id === id ? { ...h, dismissedAt: new Date() } : h
      )
    );
  }, []);

  // Clear history
  const clearHistory = useCallback(() => {
    setAlertHistory([]);
    localStorage.removeItem("farmbond-alert-history");
  }, []);

  // Manual check
  const checkNow = useCallback(() => {
    setLastCheck(new Date());
  }, []);

  // Filter helpers
  const getAlertsByType = useCallback(
    (type: AlertType) => alerts.filter((a) => a.type === type),
    [alerts]
  );

  const getAlertsByCategory = useCallback(
    (category: "severe" | "advisory" | "opportunity") =>
      alerts.filter((a) => a.category === category),
    [alerts]
  );

  return {
    alerts,
    alertHistory,
    config,
    stats,
    isLoading: isLoading || weatherLoading,
    error,
    lastCheck,
    nextCheck: stats.nextCheck,
    updateConfig,
    acknowledgeAlert,
    dismissAlert,
    clearHistory,
    checkNow,
    getAlertsByType,
    getAlertsByCategory,
  };
}

// Export alert type config for use in UI
export { alertTypeConfig };
export type { WeatherAlertConfig as AlertConfig };
