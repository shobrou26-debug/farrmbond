import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

// ============================================================
// Weather Caching Layer
// Cache Open-Meteo responses in Convex to reduce API calls.
// Cache TTL: 30 minutes.
// ============================================================

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ============================================================
// Shared Helper: Fetch weather from Open-Meteo API
// ============================================================

interface SoilData {
  temperature0cm: number;
  temperature6cm: number;
  moisture0to1cm: number;
  moisture1to3cm: number;
  moisture3to9cm: number;
  et0FaoEvapotranspiration: number;
}

interface ForecastDay {
  date: number;
  tempHigh: number;
  tempLow: number;
  precipitation: number;
  humidity: number;
  windSpeed: number;
  condition: string;
}

interface WeatherAlert {
  type: string;
  severity: string;
  message: string;
  startTime: number;
  endTime: number;
}

interface WeatherResult {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  uvIndex: number;
  soil: SoilData;
  forecast: ForecastDay[];
  alerts: WeatherAlert[];
}

async function fetchOpenMeteoWeather(latitude: number, longitude: number): Promise<WeatherResult> {
  const params = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
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
    hourly: [
      "soil_temperature_0cm",
      "soil_moisture_0_to_1cm",
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

  const temperature: number = json.current.temperature_2m;
  const humidity: number = json.current.relative_humidity_2m;
  const windSpeed: number = json.current.wind_speed_10m;
  const windDirection: number = json.current.wind_direction_10m ?? 0;
  const precipitation: number = json.current.precipitation;
  const uvIndex: number = json.current.uv_index ?? 0;

  const forecast: ForecastDay[] = json.daily.time.map((date: string, i: number) => {
    const code: number = json.daily.weather_code[i];
    const condition: string =
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

  // Soil data from Open-Meteo hourly soil parameters (use first available)
  let soil: SoilData = {
    temperature0cm: 20,
    temperature6cm: 18,
    moisture0to1cm: 0.3,
    moisture1to3cm: 0.35,
    moisture3to9cm: 0.4,
    et0FaoEvapotranspiration: 3,
  };

  if (json.hourly && json.hourly.soil_temperature_0cm && json.hourly.soil_moisture_0_to_1cm) {
    // Get the current hour's soil data
    const currentHour = new Date().getHours();
    const soilTemp = json.hourly.soil_temperature_0cm[currentHour] ?? 20;
    const soilMoisture = json.hourly.soil_moisture_0_to_1cm[currentHour] ?? 0.3;
    soil = {
      temperature0cm: soilTemp,
      temperature6cm: soilTemp - 2, // Approximate: deeper soil is ~2°C cooler
      moisture0to1cm: soilMoisture,
      moisture1to3cm: Math.min(1, soilMoisture * 1.15), // Slightly more moisture deeper
      moisture3to9cm: Math.min(1, soilMoisture * 1.3), // More moisture at depth
      et0FaoEvapotranspiration: 3,
    };
  }

  const alerts: WeatherAlert[] = [];

  const heavyRainDay = forecast.find((d: ForecastDay) => d.precipitation > 20);
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

  return {
    temperature,
    humidity,
    windSpeed,
    windDirection,
    precipitation,
    uvIndex,
    soil,
    forecast,
    alerts,
  };
}

// ============================================================
// Queries
// ============================================================

/** Get cached weather data for a location. Returns null if expired. */
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
    if (cached.expiresAt > now) return cached;
    return null;
  },
});

// ============================================================
// Mutations
// ============================================================

/** Upsert weather data for a location. */
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
    soil: v.optional(
      v.object({
        temperature0cm: v.number(),
        temperature6cm: v.number(),
        moisture0to1cm: v.number(),
        moisture1to3cm: v.number(),
        moisture3to9cm: v.number(),
        et0FaoEvapotranspiration: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const old = await ctx.db
      .query("weatherData")
      .withIndex("by_location", (q) =>
        q.eq("latitude", args.latitude).eq("longitude", args.longitude)
      )
      .collect();

    for (const doc of old) {
      await ctx.db.delete(doc._id);
    }

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
      soil: args.soil,
      fetchedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    });

    return id;
  },
});

// ============================================================
// Actions
// ============================================================

/** Fetch fresh weather from Open-Meteo and cache in Convex. */
export const fetchAndCacheWeather = action({
  args: {
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const latRounded = Math.round(args.latitude * 100) / 100;
    const lonRounded = Math.round(args.longitude * 100) / 100;

    const weatherData = await fetchOpenMeteoWeather(latRounded, lonRounded);

    await ctx.runMutation(api.weather.upsertWeather, {
      latitude: latRounded,
      longitude: lonRounded,
      ...weatherData,
    });

    return weatherData;
  },
});

/** Pre-fetch weather for all unique farm locations. Called by cron every 30 min. */
export const prefetchAllFarmWeather = action({
  args: {},
  handler: async (ctx) => {
    // Fetch all farm locations directly from DB (no auth needed for cron)
    const farmsResult = await ctx.runQuery(api.farmLocations.getAllFarmLocations) as Array<{ latitude: number; longitude: number }>;
    const farms = farmsResult;

    console.log(`[Weather Cron] Pre-fetching weather for ${farms.length} unique locations`);

    let successCount = 0;
    let errorCount = 0;

    for (const loc of farms) {
      try {
        const weatherData = await fetchOpenMeteoWeather(loc.latitude, loc.longitude);

        await ctx.runMutation(api.weather.upsertWeather, {
          latitude: loc.latitude,
          longitude: loc.longitude,
          ...weatherData,
        });

        successCount++;
        console.log(`[Weather Cron] Cached weather for ${loc.latitude}, ${loc.longitude}`);
      } catch (error) {
        errorCount++;
        console.error(`[Weather Cron] Failed for ${loc.latitude}, ${loc.longitude}:`, error);
      }

      // Small delay to avoid rate-limiting Open-Meteo
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(`[Weather Cron] Done: ${successCount} cached, ${errorCount} failed`);
    return { successCount, errorCount, totalLocations: farms.length };
  },
});
