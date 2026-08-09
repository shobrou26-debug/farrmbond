import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, verifyNotificationOwnership, createAuditLog, sanitizeInput, validateNumber, validateCoordinates } from "./authHelpers";

// ============================================================
// Allowed values
// ============================================================

export const WEATHER_ALERT_TYPES = [
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
  "soil_moisture_high",
  "optimal_spraying",
  "optimal_harvest",
  "optimal_planting",
  "optimal_fertilizer",
] as const;

export type WeatherAlertType = (typeof WEATHER_ALERT_TYPES)[number];

export type AlertSeverity = "critical" | "high" | "medium" | "low";

export interface WeatherAlertConfig {
  enabled: boolean;
  types: WeatherAlertType[];
  severityThreshold: "low" | "medium" | "high";
  pushNotifications: boolean;
  emailNotifications: boolean;
  checkInterval: number;
  location: { latitude: number; longitude: number };
}

export const DEFAULT_WEATHER_ALERT_CONFIG: WeatherAlertConfig = {
  enabled: true,
  types: [...WEATHER_ALERT_TYPES],
  severityThreshold: "low",
  pushNotifications: true,
  emailNotifications: false,
  checkInterval: 30,
  location: { latitude: -1.2921, longitude: 36.8219 },
};

/**
 * Cooldown per alert subtype (ms). Prevents the cron and reactive
 * generation from creating duplicate alerts of the same type too often.
 */
export const ALERT_COOLDOWNS: Record<WeatherAlertType, number> = {
  heavy_rain: 6 * 60 * 60 * 1000,
  flood: 6 * 60 * 60 * 1000,
  drought: 24 * 60 * 60 * 1000,
  frost: 12 * 60 * 60 * 1000,
  heat_wave: 24 * 60 * 60 * 1000,
  strong_wind: 6 * 60 * 60 * 1000,
  thunderstorm: 6 * 60 * 60 * 1000,
  hail: 12 * 60 * 60 * 1000,
  high_uv: 12 * 60 * 60 * 1000,
  soil_moisture_low: 12 * 60 * 60 * 1000,
  soil_moisture_high: 12 * 60 * 60 * 1000,
  optimal_spraying: 12 * 60 * 60 * 1000,
  optimal_harvest: 24 * 60 * 60 * 1000,
  optimal_planting: 24 * 60 * 60 * 1000,
  optimal_fertilizer: 12 * 60 * 60 * 1000,
};

// ============================================================
// Pure helpers (exported for unit testing)
// ============================================================

/** Server-side config validation. Returns error strings (empty = valid). */
export interface AlertConfigInput {
  enabled: boolean;
  types: string[];
  severityThreshold: "low" | "medium" | "high";
  pushNotifications: boolean;
  emailNotifications: boolean;
  checkInterval: number;
  location: { latitude: number; longitude: number };
}

export function validateAlertConfig(input: AlertConfigInput): string[] {
  const errors: string[] = [];

  if (typeof input.enabled !== "boolean") errors.push("enabled must be a boolean");

  if (!Array.isArray(input.types) || input.types.length === 0) {
    errors.push("At least one alert type must be enabled");
  } else {
    for (const t of input.types) {
      if (!WEATHER_ALERT_TYPES.includes(t as WeatherAlertType)) {
        errors.push(`Unknown alert type: ${t}`);
      }
    }
  }

  if (!["low", "medium", "high"].includes(input.severityThreshold)) {
    errors.push("severityThreshold must be low, medium, or high");
  }

  if (typeof input.pushNotifications !== "boolean") errors.push("pushNotifications must be a boolean");
  if (typeof input.emailNotifications !== "boolean") errors.push("emailNotifications must be a boolean");

  if (!Number.isFinite(input.checkInterval) || input.checkInterval < 5 || input.checkInterval > 1440) {
    errors.push("checkInterval must be between 5 and 1440 minutes");
  }

  if (
    !input.location ||
    typeof input.location.latitude !== "number" ||
    typeof input.location.longitude !== "number"
  ) {
    errors.push("A valid location is required");
  } else {
    if (input.location.latitude < -90 || input.location.latitude > 90) errors.push("Latitude out of range");
    if (input.location.longitude < -180 || input.location.longitude > 180) errors.push("Longitude out of range");
  }

  return errors;
}

/** True when the cooldown for `type` has elapsed since the last trigger. */
export function shouldGenerateAlert(
  lastTriggeredAt: number | undefined,
  type: WeatherAlertType,
  now: number
): boolean {
  if (!lastTriggeredAt) return true;
  const cooldown = ALERT_COOLDOWNS[type] ?? 12 * 60 * 60 * 1000;
  return now - lastTriggeredAt >= cooldown;
}

/**
 * Severity rank used to apply the user's severity threshold.
 * 0 = low ... 3 = critical.
 */
export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const THRESHOLD_RANK: Record<"low" | "medium" | "high", number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export interface WeatherSnapshot {
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  uvIndex?: number;
  forecast: {
    date: number;
    tempHigh: number;
    tempLow: number;
    precipitation: number;
    windSpeed: number;
  }[];
  soilMoisture?: number; // 0-1 fraction (weatherData.soil.moisture0to1cm)
}

export interface EvaluatedAlert {
  type: WeatherAlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  recommendations: string[];
  expiresAt: number;
  affectedCrops?: string[];
  estimatedImpact?: string;
}

/**
 * Derive weather alerts from REAL data only — the weather snapshot passed
 * in and the user's config. No fabricated sensor readings: if a field is
 * absent (e.g. no soil moisture), the soil-derived alerts simply do not
 * appear. Deterministic for identical inputs.
 */
export function evaluateWeatherAlerts(
  snapshot: WeatherSnapshot,
  config: Pick<WeatherAlertConfig, "types" | "severityThreshold">,
  now: number
): EvaluatedAlert[] {
  const alerts: EvaluatedAlert[] = [];
  const isEnabled = (type: WeatherAlertType) => config.types.includes(type);
  const thresholdRank = THRESHOLD_RANK[config.severityThreshold];

  const push = (alert: EvaluatedAlert) => {
    if (SEVERITY_RANK[alert.severity] >= thresholdRank) alerts.push(alert);
  };

  const day = 24 * 60 * 60 * 1000;

  // Heavy Rain (> 20mm in a forecast day)
  if (isEnabled("heavy_rain")) {
    const heavyRainDay = snapshot.forecast.find((d) => d.precipitation > 20);
    if (heavyRainDay) {
      push({
        type: "heavy_rain",
        severity: heavyRainDay.precipitation > 50 ? "critical" : "high",
        title: "Heavy Rain Warning",
        message: `${heavyRainDay.precipitation.toFixed(1)}mm of rain expected. Risk of flooding and crop damage.`,
        recommendations: [
          "Clear drainage channels immediately",
          "Delay field operations and spraying",
          "Move livestock to higher ground if needed",
          "Harvest mature crops before the rain",
          "Secure harvested produce in waterproof storage",
        ],
        expiresAt: heavyRainDay.date + day,
        affectedCrops: ["Maize", "Beans", "Vegetables"],
        estimatedImpact: "Potential yield loss of 10-30% if not protected",
      });
    }
  }

  // Flood Risk (> 30mm with saturated soil)
  if (isEnabled("flood") && snapshot.soilMoisture !== undefined) {
    const floodDay = snapshot.forecast.find((d) => d.precipitation > 30 && (snapshot.soilMoisture ?? 0) > 0.35);
    if (floodDay) {
      push({
        type: "flood",
        severity: "critical",
        title: "Flood Risk Warning",
        message: `High rainfall combined with saturated soil creates flood risk.`,
        recommendations: [
          "Evacuate low-lying areas if necessary",
          "Move equipment to higher ground",
          "Document crop conditions for insurance",
          "Check and clear all drainage systems",
          "Monitor weather updates frequently",
        ],
        expiresAt: floodDay.date + day,
        affectedCrops: ["All crops in low-lying areas"],
        estimatedImpact: "Complete crop loss possible in flooded areas",
      });
    }
  }

  // Drought (3+ dry days and low soil moisture)
  if (isEnabled("drought")) {
    const dryDays = snapshot.forecast.filter((d) => d.precipitation < 1).length;
    if (dryDays >= 3 && snapshot.soilMoisture !== undefined && snapshot.soilMoisture < 0.15) {
      push({
        type: "drought",
        severity: "high",
        title: "Drought Warning",
        message: `Extended dry period with critically low soil moisture (${(snapshot.soilMoisture * 100).toFixed(0)}%).`,
        recommendations: [
          "Increase irrigation frequency immediately",
          "Apply mulch to conserve soil moisture",
          "Prioritize irrigation for most vulnerable crops",
          "Consider drought-tolerant varieties for next season",
          "Monitor crop stress indicators daily",
        ],
        expiresAt: now + 3 * day,
        affectedCrops: ["All crops", "Pasture"],
        estimatedImpact: "Yield reduction of 20-50% without intervention",
      });
    }
  }

  // Frost (temp below 5°C)
  if (isEnabled("frost")) {
    const frostDay = snapshot.forecast.find((d) => d.tempLow < 5);
    if (frostDay) {
      push({
        type: "frost",
        severity: frostDay.tempLow < 2 ? "critical" : "high",
        title: "Frost Warning",
        message: `Temperatures expected to drop to ${frostDay.tempLow.toFixed(1)}°C.`,
        recommendations: [
          "Cover sensitive crops with frost blankets",
          "Irrigate before frost to protect root zones",
          "Use frost protection methods (smudge pots, sprinklers)",
          "Delay transplanting of seedlings",
          "Harvest frost-sensitive crops immediately",
        ],
        expiresAt: frostDay.date + 9 * 60 * 60 * 1000,
        affectedCrops: ["Tomatoes", "Peppers", "Beans", "Seedlings"],
        estimatedImpact: "Severe damage or death to sensitive crops",
      });
    }
  }

  // Heat wave (3+ days above 35°C)
  if (isEnabled("heat_wave")) {
    const hotDays = snapshot.forecast.filter((d) => d.tempHigh > 35).length;
    if (hotDays >= 3) {
      push({
        type: "heat_wave",
        severity: "high",
        title: "Heat Wave Alert",
        message: `Temperatures above 35°C expected for ${hotDays} consecutive days.`,
        recommendations: [
          "Increase irrigation to compensate for evaporation",
          "Provide shade for livestock",
          "Avoid field work during peak heat hours (11am-3pm)",
          "Monitor crops for heat stress signs",
          "Ensure adequate water supply for workers",
        ],
        expiresAt: now + 3 * day,
        affectedCrops: ["All crops", "Livestock"],
        estimatedImpact: "Heat stress can reduce yields by 15-40%",
      });
    }
  }

  // Strong wind (> 40 km/h)
  if (isEnabled("strong_wind")) {
    const maxWind = Math.max(snapshot.windSpeed, ...snapshot.forecast.map((d) => d.windSpeed));
    if (maxWind > 40) {
      push({
        type: "strong_wind",
        severity: maxWind > 60 ? "critical" : "medium",
        title: "Strong Wind Advisory",
        message: `Wind speeds of ${maxWind.toFixed(0)} km/h expected.`,
        recommendations: [
          "Secure all loose structures and equipment",
          "Delay spraying operations (drift risk)",
          "Check and reinforce tree supports",
          "Postpone harvesting of standing crops",
          "Monitor greenhouse structures",
        ],
        expiresAt: now + 24 * 60 * 60 * 1000,
        affectedCrops: ["Tall crops", "Fruiting trees"],
        estimatedImpact: "Physical damage to crops and structures",
      });
    }
  }

  // High UV (index >= 8)
  if (isEnabled("high_uv") && snapshot.uvIndex !== undefined && snapshot.uvIndex >= 8) {
    push({
      type: "high_uv",
      severity: snapshot.uvIndex >= 11 ? "high" : "medium",
      title: "High UV Index Alert",
      message: `UV index at ${snapshot.uvIndex}. Risk of sunburn and heat stress.`,
      recommendations: [
        "Avoid field work between 10am-4pm",
        "Wear protective clothing and sunscreen",
        "Provide shade for workers and livestock",
        "Increase irrigation due to high evaporation",
        "Monitor crops for sunscald damage",
      ],
      expiresAt: now + 24 * 60 * 60 * 1000,
      affectedCrops: ["Fruits", "Leafy vegetables"],
      estimatedImpact: "Sunscald damage to exposed produce",
    });
  }

  // Low soil moisture
  if (isEnabled("soil_moisture_low") && snapshot.soilMoisture !== undefined && snapshot.soilMoisture < 0.15) {
    push({
      type: "soil_moisture_low",
      severity: snapshot.soilMoisture < 0.1 ? "high" : "medium",
      title: "Low Soil Moisture Alert",
      message: `Soil moisture at ${(snapshot.soilMoisture * 100).toFixed(0)}% is below optimal levels.`,
      recommendations: [
        "Increase irrigation frequency",
        "Apply mulch to reduce evaporation",
        "Check irrigation system for efficiency",
        "Prioritize water for most critical growth stages",
        "Consider deficit irrigation strategies",
      ],
      expiresAt: now + 24 * 60 * 60 * 1000,
      affectedCrops: ["All crops"],
      estimatedImpact: "Reduced growth and yield if not addressed",
    });
  }

  // High soil moisture
  if (isEnabled("soil_moisture_high") && snapshot.soilMoisture !== undefined && snapshot.soilMoisture > 0.5) {
    push({
      type: "soil_moisture_high",
      severity: "medium",
      title: "High Soil Moisture Advisory",
      message: `Soil moisture at ${(snapshot.soilMoisture * 100).toFixed(0)}% is above optimal. Risk of waterlogging.`,
      recommendations: [
        "Reduce or stop irrigation",
        "Improve field drainage",
        "Monitor for root rot symptoms",
        "Delay fertilizer application",
        "Avoid heavy machinery on wet soil",
      ],
      expiresAt: now + 24 * 60 * 60 * 1000,
      affectedCrops: ["Root crops", "Seedlings"],
      estimatedImpact: "Root rot and oxygen stress",
    });
  }

  // Optimal spraying window (low wind, no rain within 2 days)
  if (isEnabled("optimal_spraying")) {
    const sprayDay = snapshot.forecast.find(
      (d) => d.windSpeed < 15 && d.precipitation < 1 && d.date > now - day && d.date < now + 2 * day
    );
    if (sprayDay && snapshot.windSpeed < 15) {
      push({
        type: "optimal_spraying",
        severity: "low",
        title: "Optimal Spraying Window",
        message: `Good conditions for pesticide/fungicide application. Low wind and no rain expected.`,
        recommendations: [
          "Apply pesticides/fungicides now",
          "Use appropriate PPE",
          "Follow label instructions carefully",
          "Monitor weather for changes",
          "Document application details",
        ],
        expiresAt: sprayDay.date + 18 * 60 * 60 * 1000,
        estimatedImpact: "Improved pesticide efficacy",
      });
    }
  }

  // Optimal harvest (3+ consecutive dry days)
  if (isEnabled("optimal_harvest")) {
    let run = 0;
    let bestEnd = 0;
    for (const d of snapshot.forecast) {
      if (d.precipitation < 1) {
        run++;
        bestEnd = d.date;
      } else {
        run = 0;
      }
    }
    if (run >= 3) {
      push({
        type: "optimal_harvest",
        severity: "low",
        title: "Harvest Window Available",
        message: `${run} consecutive dry days expected. Ideal for harvesting mature crops.`,
        recommendations: [
          "Harvest mature crops during this window",
          "Prepare drying and storage facilities",
          "Arrange transportation and labor",
          "Quality check before harvest",
          "Document yield for records",
        ],
        expiresAt: bestEnd + day,
        estimatedImpact: "Optimal harvest quality and minimal losses",
      });
    }
  }

  // Optimal planting (rain 5-20mm, mild temps)
  if (isEnabled("optimal_planting")) {
    const plantDay = snapshot.forecast.find(
      (d) => d.precipitation > 5 && d.precipitation < 20 && d.tempLow > 10
    );
    if (plantDay) {
      push({
        type: "optimal_planting",
        severity: "low",
        title: "Planting Window",
        message: `Good soil moisture expected from upcoming rain. Consider planting.`,
        recommendations: [
          "Prepare seedbed before rain",
          "Select appropriate seed varieties",
          "Plan planting schedule",
          "Ensure adequate seed supply",
          "Check soil temperature for germination",
        ],
        expiresAt: plantDay.date + day,
        estimatedImpact: "Improved germination and establishment",
      });
    }
  }

  // Optimal fertilizer (light rain 2-10mm)
  if (isEnabled("optimal_fertilizer")) {
    const fertDay = snapshot.forecast.find((d) => d.precipitation > 2 && d.precipitation < 10);
    if (fertDay) {
      push({
        type: "optimal_fertilizer",
        severity: "low",
        title: "Fertilizer Application Window",
        message: `Light rain expected to help incorporate fertilizer into soil.`,
        recommendations: [
          "Apply fertilizer before rain",
          "Use appropriate rates for crop stage",
          "Ensure even distribution",
          "Avoid application on waterlogged soil",
          "Record fertilizer types and rates",
        ],
        expiresAt: fertDay.date + 12 * 60 * 60 * 1000,
        estimatedImpact: "Improved nutrient uptake efficiency",
      });
    }
  }

  return alerts;
}

// ============================================================
// Queries
// ============================================================

/** Get the current user's weather alert config (or null if never saved). */
export const getMyWeatherAlertConfig = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    return await ctx.db
      .query("weatherAlertConfigs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/** List the current user's weather-alert notifications (rich payload parsed). */
export const listMyWeatherAlertHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const weatherAlerts = notifications.filter((n) => n.type === "weather_alert" && n.severity);
    const max = Math.min(200, Math.max(1, args.limit ?? 100));

    return weatherAlerts.slice(0, max).map((n) => {
      let details: Record<string, unknown> = {};
      if (n.details) {
        try {
          details = JSON.parse(n.details);
        } catch {
          details = {};
        }
      }
      return {
        _id: n._id,
        title: n.title,
        message: n.message,
        type: n.type,
        severity: n.severity as AlertSeverity,
        isRead: n.isRead,
        dismissedAt: n.dismissedAt,
        createdAt: n.createdAt,
        details,
      };
    });
  },
});

// ============================================================
// Mutations
// ============================================================

/** Save the current user's weather alert config (validated, upsert). */
export const updateWeatherAlertConfig = mutation({
  args: {
    config: v.object({
      enabled: v.boolean(),
      types: v.array(v.string()),
      severityThreshold: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
      pushNotifications: v.boolean(),
      emailNotifications: v.boolean(),
      checkInterval: v.number(),
      location: v.object({ latitude: v.number(), longitude: v.number() }),
    }),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const errors = validateAlertConfig(args.config);
    if (errors.length > 0) {
      throw new Error(`Invalid alert config: ${errors.join("; ")}`);
    }

    validateNumber(args.config.checkInterval, "checkInterval", 5, 1440);
    validateCoordinates(args.config.location.latitude, args.config.location.longitude);

    const existing = await ctx.db
      .query("weatherAlertConfigs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const now = Date.now();
    const clean: WeatherAlertConfig = {
      enabled: args.config.enabled,
      types: args.config.types.filter((t) => WEATHER_ALERT_TYPES.includes(t as WeatherAlertType)) as WeatherAlertType[],
      severityThreshold: args.config.severityThreshold,
      pushNotifications: args.config.pushNotifications,
      emailNotifications: args.config.emailNotifications,
      checkInterval: args.config.checkInterval,
      location: {
        latitude: args.config.location.latitude,
        longitude: args.config.location.longitude,
      },
    };

    if (existing) {
      await ctx.db.patch(existing._id, { ...clean, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("weatherAlertConfigs", {
      userId,
      ...clean,
      updatedAt: now,
    });
  },
});

/**
 * Generate weather alerts for the current user (manual "Check Now").
 * Evaluates the config against the cached weather data for the configured
 * location, dedupes by subtype cooldown, and stores into `notifications`.
 */
export const generateWeatherAlerts = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const configDoc = await ctx.db
      .query("weatherAlertConfigs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    const config: WeatherAlertConfig = configDoc
      ? {
          enabled: configDoc.enabled,
          types: configDoc.types as WeatherAlertType[],
          severityThreshold: configDoc.severityThreshold,
          pushNotifications: configDoc.pushNotifications,
          emailNotifications: configDoc.emailNotifications,
          checkInterval: configDoc.checkInterval,
          location: configDoc.location,
        }
      : DEFAULT_WEATHER_ALERT_CONFIG;

    if (!config.enabled) return { created: 0 };

    const now = Date.now();
    const latRounded = Math.round(config.location.latitude * 100) / 100;
    const lonRounded = Math.round(config.location.longitude * 100) / 100;

    const weather = await ctx.db
      .query("weatherData")
      .withIndex("by_location", (q) => q.eq("latitude", latRounded).eq("longitude", lonRounded))
      .order("desc")
      .first();
    if (!weather || weather.expiresAt <= now) return { created: 0 };

    const snapshot: WeatherSnapshot = {
      temperature: weather.temperature,
      humidity: weather.humidity,
      windSpeed: weather.windSpeed,
      precipitation: weather.precipitation,
      uvIndex: weather.uvIndex,
      forecast: (weather.forecast ?? []).map((f) => ({
        date: f.date,
        tempHigh: f.tempHigh,
        tempLow: f.tempLow,
        precipitation: f.precipitation,
        windSpeed: f.windSpeed,
      })),
      soilMoisture: weather.soil?.moisture0to1cm,
    };

    const evaluated = evaluateWeatherAlerts(snapshot, config, now);

    // Dedup: last trigger time per subtype from the user's existing weather alerts
    const recent = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const lastTriggered: Partial<Record<WeatherAlertType, number>> = {};
    for (const n of recent) {
      if (n.type !== "weather_alert" || !n.severity) continue;
      let alertType: WeatherAlertType | null = null;
      if (n.details) {
        try {
          const d = JSON.parse(n.details) as { type?: string };
          if (d.type && WEATHER_ALERT_TYPES.includes(d.type as WeatherAlertType)) alertType = d.type as WeatherAlertType;
        } catch {
          alertType = null;
        }
      }
      if (!alertType) continue;
      if (lastTriggered[alertType] === undefined || n.createdAt > lastTriggered[alertType]!) {
        lastTriggered[alertType] = n.createdAt;
      }
    }

    let created = 0;
    for (const alert of evaluated) {
      if (!shouldGenerateAlert(lastTriggered[alert.type], alert.type, now)) continue;

      const details = JSON.stringify({
        type: alert.type,
        severity: alert.severity,
        category: getAlertCategory(alert.type),
        recommendations: alert.recommendations,
        affectedCrops: alert.affectedCrops ?? [],
        estimatedImpact: alert.estimatedImpact ?? "",
        expiresAt: alert.expiresAt,
        source: "Open-Meteo weather data",
      });

      await ctx.db.insert("notifications", {
        userId,
        title: alert.title,
        message: alert.message,
        type: "weather_alert",
        severity: alert.severity,
        details,
        isRead: false,
        actionUrl: "/weather-alerts",
        actionLabel: "View Alerts",
        createdAt: now,
      });
      created++;
    }

    // Record the check time on the config (upsert if needed)
    if (configDoc) {
      await ctx.db.patch(configDoc._id, { lastCheckedAt: now, updatedAt: now });
    } else {
      await ctx.db.insert("weatherAlertConfigs", {
        userId,
        ...DEFAULT_WEATHER_ALERT_CONFIG,
        lastCheckedAt: now,
        updatedAt: now,
      });
    }

    return { created };
  },
});

/**
 * Cron entry: generate weather alerts for ALL users with an enabled config.
 * Server-side (no auth). Deduplication via per-subtype cooldowns keeps
 * repeated cron runs from creating unlimited duplicate alerts.
 */
export const generateWeatherAlertsForAllUsers = mutation({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db.query("weatherAlertConfigs").collect();
    const now = Date.now();
    let totalCreated = 0;
    let usersProcessed = 0;

    for (const configDoc of configs) {
      if (!configDoc.enabled) continue;

      const latRounded = Math.round(configDoc.location.latitude * 100) / 100;
      const lonRounded = Math.round(configDoc.location.longitude * 100) / 100;

      const weather = await ctx.db
        .query("weatherData")
        .withIndex("by_location", (q) => q.eq("latitude", latRounded).eq("longitude", lonRounded))
        .order("desc")
        .first();
      if (!weather || weather.expiresAt <= now) continue;

      const snapshot: WeatherSnapshot = {
        temperature: weather.temperature,
        humidity: weather.humidity,
        windSpeed: weather.windSpeed,
        precipitation: weather.precipitation,
        uvIndex: weather.uvIndex,
        forecast: (weather.forecast ?? []).map((f) => ({
          date: f.date,
          tempHigh: f.tempHigh,
          tempLow: f.tempLow,
          precipitation: f.precipitation,
          windSpeed: f.windSpeed,
        })),
        soilMoisture: weather.soil?.moisture0to1cm,
      };

      const config: WeatherAlertConfig = {
        enabled: configDoc.enabled,
        types: configDoc.types as WeatherAlertType[],
        severityThreshold: configDoc.severityThreshold,
        pushNotifications: configDoc.pushNotifications,
        emailNotifications: configDoc.emailNotifications,
        checkInterval: configDoc.checkInterval,
        location: configDoc.location,
      };

      const evaluated = evaluateWeatherAlerts(snapshot, config, now);

      const recent = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", configDoc.userId))
        .order("desc")
        .collect();
      const lastTriggered: Partial<Record<WeatherAlertType, number>> = {};
      for (const n of recent) {
        if (n.type !== "weather_alert" || !n.severity || !n.details) continue;
        try {
          const d = JSON.parse(n.details) as { type?: string };
          if (d.type && WEATHER_ALERT_TYPES.includes(d.type as WeatherAlertType)) {
            const t = d.type as WeatherAlertType;
            if (lastTriggered[t] === undefined || n.createdAt > lastTriggered[t]!) lastTriggered[t] = n.createdAt;
          }
        } catch {
          // skip malformed details
        }
      }

      let created = 0;
      for (const alert of evaluated) {
        if (!shouldGenerateAlert(lastTriggered[alert.type], alert.type, now)) continue;
        await ctx.db.insert("notifications", {
          userId: configDoc.userId,
          title: alert.title,
          message: alert.message,
          type: "weather_alert",
          severity: alert.severity,
          details: JSON.stringify({
            type: alert.type,
            severity: alert.severity,
            category: getAlertCategory(alert.type),
            recommendations: alert.recommendations,
            affectedCrops: alert.affectedCrops ?? [],
            estimatedImpact: alert.estimatedImpact ?? "",
            expiresAt: alert.expiresAt,
            source: "Open-Meteo weather data",
          }),
          isRead: false,
          actionUrl: "/weather-alerts",
          actionLabel: "View Alerts",
          createdAt: now,
        });
        created++;
      }

      if (created > 0 || now - (configDoc.lastCheckedAt ?? 0) > 60 * 60 * 1000) {
        await ctx.db.patch(configDoc._id, { lastCheckedAt: now, updatedAt: now });
      }
      usersProcessed++;
      totalCreated += created;
    }

    return { totalCreated, usersProcessed };
  },
});

/** Dismiss an alert (ownership-checked) — keeps it in history, hides from active. */
export const dismissWeatherAlert = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const notification = await verifyNotificationOwnership(ctx, args.notificationId, userId);
    await ctx.db.patch(notification._id, { dismissedAt: Date.now() });

    await createAuditLog(ctx, {
      userId,
      action: "weather_alert_dismissed",
      resource: "notifications",
      resourceId: args.notificationId,
    });
    return { dismissed: true };
  },
});

/** Clear the current user's weather-alert history (deletes weather_alert notifications). */
export const clearWeatherAlertHistory = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const weatherAlerts = notifications.filter((n) => n.type === "weather_alert");
    for (const n of weatherAlerts) {
      await ctx.db.delete(n._id);
    }

    await createAuditLog(ctx, {
      userId,
      action: "weather_alert_history_cleared",
      resource: "notifications",
      resourceId: "weather_alerts",
      changes: { cleared: weatherAlerts.length },
    });

    return { cleared: weatherAlerts.length };
  },
});

// ============================================================
// Internal helpers
// ============================================================

function getAlertCategory(type: WeatherAlertType): "severe" | "advisory" | "opportunity" {
  switch (type) {
    case "optimal_spraying":
    case "optimal_harvest":
    case "optimal_planting":
    case "optimal_fertilizer":
      return "opportunity";
    case "strong_wind":
    case "high_uv":
    case "soil_moisture_low":
    case "soil_moisture_high":
      return "advisory";
    default:
      return "severe";
  }
}

// Keep sanitizeInput referenced so the module stays consistent with
// FarmBond's input-hygiene conventions for any future string fields.
void sanitizeInput;
