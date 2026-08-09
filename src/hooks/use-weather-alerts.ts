import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ============================================================
// Types (public interface kept stable for consumers)
// ============================================================

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

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export interface WeatherAlertConfig {
  enabled: boolean;
  types: AlertType[];
  severityThreshold: "low" | "medium" | "high";
  pushNotifications: boolean;
  emailNotifications: boolean;
  checkInterval: number; // minutes
  location: { latitude: number; longitude: number };
}

export interface WeatherAlert {
  type: string;
  severity: AlertSeverity;
  title: string;
  message: string;
}

export interface ExtendedWeatherAlert extends WeatherAlert {
  id: string;
  timestamp: Date;
  expiresAt: Date;
  acknowledged: boolean;
  priority: AlertSeverity;
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
// Alert Type Presentation Config (client-only static reference
// data — icons/colors/labels are presentation, not business data)
// ============================================================

export const alertTypeConfig: Record<AlertType, {
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
// Defaults (client-side mirror of the server default)
// ============================================================

const defaultConfig: WeatherAlertConfig = {
  enabled: true,
  types: Object.keys(alertTypeConfig) as AlertType[],
  severityThreshold: "low",
  pushNotifications: true,
  emailNotifications: false,
  checkInterval: 30,
  location: { latitude: -1.2921, longitude: 36.8219 },
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const THRESHOLD_ORDER: Record<"low" | "medium" | "high", number> = {
  low: 0,
  medium: 1,
  high: 2,
};

interface ServerHistoryRow {
  _id: Id<"notifications">;
  title: string;
  message: string;
  type: string;
  severity: AlertSeverity;
  isRead: boolean;
  dismissedAt?: number;
  createdAt: number;
  details: Record<string, unknown>;
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
  checkNow: () => Promise<void>;
  getAlertsByType: (type: AlertType) => ExtendedWeatherAlert[];
  getAlertsByCategory: (category: "severe" | "advisory" | "opportunity") => ExtendedWeatherAlert[];
}

export function useWeatherAlerts(
  _weatherOptions?: { latitude?: number; longitude?: number }
): UseWeatherAlertsReturn {
  // ---- Server-backed state -------------------------------------------------
  const serverConfig = useQuery(api.weatherAlerts.getMyWeatherAlertConfig);
  const historyRows = useQuery(api.weatherAlerts.listMyWeatherAlertHistory, {});

  const updateConfigMutation = useMutation(api.weatherAlerts.updateWeatherAlertConfig);
  const generateMutation = useMutation(api.weatherAlerts.generateWeatherAlerts);
  const dismissMutation = useMutation(api.weatherAlerts.dismissWeatherAlert);
  const clearHistoryMutation = useMutation(api.weatherAlerts.clearWeatherAlertHistory);
  const markReadMutation = useMutation(api.smartNotifications.markNotificationsRead);

  // Local config state mirrors the server config; initialised from defaults
  // then synced once the server config loads. A ref tracks the latest value
  // so mutation calls are computed outside the state updater (avoids
  // double-invocation side effects under Strict Mode).
  const [config, setConfig] = useState<WeatherAlertConfig>(defaultConfig);
  const configRef = useRef<WeatherAlertConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (serverConfig === undefined) return; // still loading
    setIsLoading(false);
    if (serverConfig === null) return; // never saved — keep defaults
    setConfig((prev) => {
      const next = {
        enabled: serverConfig.enabled,
        types: serverConfig.types as AlertType[],
        severityThreshold: serverConfig.severityThreshold,
        pushNotifications: serverConfig.pushNotifications,
        emailNotifications: serverConfig.emailNotifications,
        checkInterval: serverConfig.checkInterval,
        location: serverConfig.location,
      };
      configRef.current = next;
      return next;
    });
  }, [serverConfig]);

  // Map server history rows into the public alert/history shapes.
  const alertHistory: AlertHistory[] = useMemo(() => {
    if (!historyRows) return [];
    return historyRows.map((row) => {
      const alert = mapRowToAlert(row);
      return {
        id: alert.id,
        alert,
        triggeredAt: new Date(row.createdAt),
        acknowledgedAt: row.isRead ? new Date(row.createdAt) : undefined,
        dismissedAt: row.dismissedAt ? new Date(row.dismissedAt) : undefined,
      };
    });
  }, [historyRows]);

  // Active alerts: not dismissed, not expired, and meeting the threshold.
  const alerts: ExtendedWeatherAlert[] = useMemo(() => {
    const now = Date.now();
    const thresholdRank = THRESHOLD_ORDER[config.severityThreshold];
    return alertHistory
      .filter((h) => !h.dismissedAt && h.alert.expiresAt.getTime() > now)
      .map((h) => h.alert)
      .filter((a) => SEVERITY_ORDER[a.severity] >= thresholdRank && config.types.includes(a.type as AlertType));
  }, [alertHistory, config.severityThreshold, config.types]);

  const lastCheck = useMemo(() => {
    const ts = serverConfig?.lastCheckedAt;
    return ts ? new Date(ts) : null;
  }, [serverConfig]);

  const stats: WeatherAlertStats = {
    totalAlerts: alertHistory.length,
    activeAlerts: alerts.filter((a) => !a.acknowledged).length,
    criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
    todayAlerts: alertHistory.filter((h) => {
      const today = new Date();
      return h.triggeredAt.toDateString() === today.toDateString();
    }).length,
    lastCheck,
    nextCheck: lastCheck
      ? new Date(lastCheck.getTime() + config.checkInterval * 60 * 1000)
      : null,
  };

  // ---- Actions -------------------------------------------------------------

  const updateConfig = useCallback(
    (updates: Partial<WeatherAlertConfig>) => {
      const next = { ...configRef.current, ...updates };
      configRef.current = next;
      setConfig(next);
      updateConfigMutation({ config: next }).catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to save alert settings");
      });
    },
    [updateConfigMutation]
  );

  const acknowledgeAlert = useCallback(
    (id: string) => {
      markReadMutation({ notificationIds: [id as Id<"notifications">] }).catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to acknowledge alert");
      });
    },
    [markReadMutation]
  );

  const dismissAlert = useCallback(
    (id: string) => {
      dismissMutation({ notificationId: id as Id<"notifications"> }).catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to dismiss alert");
      });
    },
    [dismissMutation]
  );

  const clearHistory = useCallback(() => {
    clearHistoryMutation().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to clear alert history");
    });
  }, [clearHistoryMutation]);

  const checkNow = useCallback(async () => {
    setError(null);
    try {
      await generateMutation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check weather alerts");
      throw err;
    }
  }, [generateMutation]);

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
    isLoading,
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

// ============================================================
// Internal mapping helpers
// ============================================================

function mapRowToAlert(row: ServerHistoryRow): ExtendedWeatherAlert {
  const details = row.details as {
    type?: string;
    category?: "severe" | "advisory" | "opportunity";
    recommendations?: string[];
    affectedCrops?: string[];
    estimatedImpact?: string;
    expiresAt?: number;
    source?: string;
  };
  const alertType = (details.type ?? row.type) as AlertType;
  const presentation = alertTypeConfig[alertType] ?? alertTypeConfig.heavy_rain;

  return {
    id: row._id,
    type: alertType,
    severity: row.severity ?? "medium",
    title: row.title,
    message: row.message,
    timestamp: new Date(row.createdAt),
    expiresAt: new Date(details.expiresAt ?? row.createdAt + 24 * 60 * 60 * 1000),
    acknowledged: row.isRead,
    priority: row.severity ?? "medium",
    category: details.category ?? presentation.category,
    icon: presentation.icon,
    color: presentation.color,
    bgColor: presentation.bgColor,
    borderColor: presentation.borderColor,
    recommendations: details.recommendations ?? [],
    affectedCrops: details.affectedCrops?.length ? details.affectedCrops : undefined,
    estimatedImpact: details.estimatedImpact || undefined,
    source: details.source ?? "Open-Meteo weather data",
  };
}

// Re-export for consumers (type alias kept for backwards compatibility)
export type { WeatherAlertConfig as AlertConfig };
