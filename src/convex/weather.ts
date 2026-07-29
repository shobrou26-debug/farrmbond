import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

// ============================================================
// Weather Caching Layer
// Cache Open-Meteo responses in Convex to reduce API calls.
// Cache TTL: 30 minutes.
// ============================================================

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Query: Get cached weather data for a location.
 * Returns null if no cache exists or cache is expired.
 */
export const getCachedWeather = query({
  args: {
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const latRounded = Math.round(args.latitude * 100) / 100;
    const lonRounded = Math.round(args.longitude * 100) / 100;
    const now = Date.now();

    const cached = await ctx.db
      .query("weatherData")
      .withIndex("by_location", (q) =>
        q.eq("latitude", latRounded).eq("longitude", lonRounded)
      )
      .order("desc")
      .first();

    if (!cached) return null;

    if (cached.expiresAt > now) {
      return cached;
    }

    return null; // expired — caller should refetch
  },
});

/**
 * Mutation: Upsert weather data for a location.
 * Deletes old cache entries for the same location first.
 */
export const upsertWeather = mutation({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    temperature: v.number(),
    humidity: v.number(),
    windSpeed: v.number(),
    windDirection: v.optional(v.number()),
    precipitation: v.number(),
    uvIndex: v.optional(v.number()),
    forecast: v.optional(
      v.array(
        v.object({
          date: v.number(),
          tempHigh: v.number(),
          tempLow: v.number(),
          precipitation: v.number(),
          humidity: v.number(),
          windSpeed: v.number(),
          condition: v.string(),
        })
      )
    ),
    alerts: v.optional(
      v.array(
        v.object({
          type: v.string(),
          severity: v.string(),
          message: v.string(),
          startTime: v.number(),
          endTime: v.number(),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Delete old cache entries for this location
    const old = await ctx.db
      .query("weatherData")
      .withIndex("by_location", (q) =>
        q.eq("latitude", args.latitude).eq("longitude", args.longitude)
      )
      .collect();

    for (const doc of old) {
      await ctx.db.delete(doc._id);
    }

    // Insert fresh cache
    const id = await ctx.db.insert("weatherData", {
      farmId: "weather_cache" as any,
      latitude: args.latitude,
      longitude: args.longitude,
      temperature: args.temperature,
      humidity: args.humidity,
      windSpeed: args.windSpeed,
      windDirection: args.windDirection,
      precipitation: args.precipitation,
      uvIndex: args.uvIndex,
      forecast: args.forecast,
      alerts: args.alerts,
      fetchedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    });

    return id;
  },
});

/**
 * Action: Fetch fresh weather from Open-Meteo and cache in Convex.
 * Runs server-side so the API call is not exposed to the browser.
 */
export const fetchAndCacheWeather = action({
  args: {
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const latRounded = Math.round(args.latitude * 100) / 100;
    const lonRounded = Math.round(args.longitude * 100) / 100;

    // --- Fetch current + hourly + daily forecast ---
    const params = new URLSearchParams({
      latitude: latRounded.toString(),
      longitude: lonRounded.toString(),
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
        "wind_direction_10m",
        "uv_index",
        "is_day",
      ].join(","),
      hourly: [
        "temperature_2m",
        "relative_humidity_2m",
        "precipitation_probability",
        "precipitation",
        "weather_code",
        "uv_index",
        "wind_speed_10m",
        "is_day",
      ].join(","),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_sum",
        "precipitation_probability_max",
        "wind_speed_10m_max",
        "uv_index_max",
        "sunrise",
        "sunset",
      ].join(","),
      timezone: "auto",
      forecast_days: "7",
    });

    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`
    );
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }
    const json = await response.json();

    // --- Process current weather ---
    const temperature = json.current.temperature_2m;
    const humidity = json.current.relative_humidity_2m;
    const windSpeed = json.current.wind_speed_10m;
    const windDirection = json.current.wind_direction_10m ?? 0;
    const precipitation = json.current.precipitation;
    const uvIndex = json.current.uv_index ?? 0;

    // --- Process daily forecast ---
    const forecast = json.daily.time.map((date: string, i: number) => {
      const code = json.daily.weather_code[i];
      const condition =
        code === 0
          ? "clear"
          : code <= 3
          ? "partly_cloudy"
          : code === 45 || code === 48
          ? "fog"
          : code >= 51 && code <= 67
          ? "rain"
          : code >= 71 && code <= 77
          ? "snow"
          : code >= 80 && code <= 82
          ? "rain_showers"
          : code >= 95
          ? "thunderstorm"
          : "clear";

      return {
        date: Math.floor(new Date(date).getTime() / 1000) * 1000,
        tempHigh: json.daily.temperature_2m_max[i],
        tempLow: json.daily.temperature_2m_min[i],
        precipitation: json.daily.precipitation_sum[i],
        humidity: 50,
        windSpeed: json.daily.wind_speed_10m_max[i],
        condition,
      };
    });

    // --- Generate alerts ---
    const alerts: Array<{
      type: string;
      severity: string;
      message: string;
      startTime: number;
      endTime: number;
    }> = [];

    const heavyRainDay = forecast.find((d: { precipitation: number }) => d.precipitation > 20);
    if (heavyRainDay) {
      alerts.push({
        type: "heavy_rain",
        severity: "high",
        message: `${heavyRainDay.precipitation.toFixed(1)}mm of rain expected. Ensure drainage is clear.`,
        startTime: heavyRainDay.date,
        endTime: heavyRainDay.date + 24 * 60 * 60 * 1000,
      });
    }

    if (uvIndex >= 8) {
      alerts.push({
        type: "uv",
        severity: "medium",
        message: `Very high UV index (${uvIndex}). Avoid midday field work.`,
        startTime: Date.now(),
        endTime: Date.now() + 6 * 60 * 60 * 1000,
      });
    }

    // --- Cache via mutation ---
    await ctx.runMutation(api.weather.upsertWeather, {
      latitude: latRounded,
      longitude: lonRounded,
      temperature,
      humidity,
      windSpeed,
      windDirection,
      precipitation,
      uvIndex,
      forecast,
      alerts,
    });

    return {
      temperature,
      humidity,
      windSpeed,
      windDirection,
      precipitation,
      uvIndex,
      forecast,
      alerts,
    };
  },
});
