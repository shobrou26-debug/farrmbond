import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";

// ============================================================
// Types
// ============================================================

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  uvIndex: number;
  weatherCode: number;
  time: string;
  isDay: boolean;
}

export interface HourlyForecast {
  time: string;
  temperature: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  precipitationProbability: number;
  uvIndex: number;
  weatherCode: number;
  isDay: boolean;
}

export interface DailyForecast {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  precipitationProbabilityMax: number;
  windSpeedMax: number;
  uvIndexMax: number;
  weatherCode: number;
  sunrise: string;
  sunset: string;
}

export interface SoilData {
  temperature0cm: number;
  temperature6cm: number;
  moisture0to1cm: number;
  moisture1to3cm: number;
  moisture3to9cm: number;
  et0FaoEvapotranspiration: number;
}

export interface WeatherLocation {
  latitude: number;
  longitude: number;
  name: string;
  country: string;
  elevation: number;
  timezone: string;
}

export interface WeatherAlert {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
}

export interface WeatherData {
  current: CurrentWeather;
  hourly: HourlyForecast[];
  daily: DailyForecast[];
  soil: SoilData;
  location: WeatherLocation;
  alerts: WeatherAlert[];
  recommendations: WeatherRecommendation[];
}

export interface WeatherRecommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  category: string;
}

// ============================================================
// WMO Weather Code Mapping
// ============================================================

function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "Clear Sky",
    1: "Mainly Clear",
    2: "Partly Cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing Rime Fog",
    51: "Light Drizzle",
    53: "Moderate Drizzle",
    55: "Dense Drizzle",
    56: "Light Freezing Drizzle",
    57: "Dense Freezing Drizzle",
    61: "Slight Rain",
    63: "Moderate Rain",
    65: "Heavy Rain",
    66: "Light Freezing Rain",
    67: "Heavy Freezing Rain",
    71: "Slight Snowfall",
    73: "Moderate Snowfall",
    75: "Heavy Snowfall",
    77: "Snow Grains",
    80: "Slight Rain Showers",
    81: "Moderate Rain Showers",
    82: "Violent Rain Showers",
    85: "Slight Snow Showers",
    86: "Heavy Snow Showers",
    95: "Thunderstorm",
    96: "Thunderstorm with Slight Hail",
    99: "Thunderstorm with Heavy Hail",
  };
  return descriptions[code] || "Unknown";
}

function getConditionCategory(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "partly_cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return "rain_showers";
  if (code >= 85 && code <= 86) return "snow_showers";
  if (code >= 95) return "thunderstorm";
  return "clear";
}

// ============================================================
// Generate Alerts from cached data
// ============================================================

function generateAlerts(
  temperature: number,
  humidity: number,
  windSpeed: number,
  uvIndex: number,
  forecast: Array<{ precipitation: number; date: number; tempLow?: number }>,
  soilMoisture?: number
): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  const heavyRainDay = forecast.find((d) => d.precipitation > 20);
  if (heavyRainDay) {
    alerts.push({
      type: "heavy_rain",
      severity: "high",
      title: "Heavy Rain Expected",
      message: `${heavyRainDay.precipitation.toFixed(1)}mm of rain expected. Ensure drainage is clear.`,
    });
  }

  if (uvIndex >= 8) {
    alerts.push({
      type: "uv",
      severity: "medium",
      title: "Very High UV Index",
      message: `UV index is ${uvIndex}. Avoid midday field work and wear protective clothing.`,
    });
  }

  const frostRisk = forecast.find((d) => d.tempLow !== undefined && d.tempLow < 5);
  if (frostRisk) {
    alerts.push({
      type: "frost",
      severity: "medium",
      title: "Frost Risk",
      message: `Temperatures may drop to ${frostRisk.tempLow}°C. Protect sensitive crops.`,
    });
  }

  if (windSpeed > 40) {
    alerts.push({
      type: "wind",
      severity: "medium",
      title: "Strong Winds",
      message: `Wind speeds of ${windSpeed.toFixed(0)} km/h. Secure loose structures.`,
    });
  }

  if (soilMoisture !== undefined && soilMoisture < 0.15) {
    alerts.push({
      type: "drought",
      severity: "high",
      title: "Low Soil Moisture",
      message: `Soil moisture at ${(soilMoisture * 100).toFixed(0)}% is critically low.`,
    });
  }

  return alerts;
}

// ============================================================
// Generate Recommendations from cached data
// ============================================================

function generateRecommendations(
  uvIndex: number,
  windSpeed: number,
  humidity: number,
  forecast: Array<{ precipitation: number }>
): WeatherRecommendation[] {
  const recs: WeatherRecommendation[] = [];

  const upcomingRain = forecast.slice(0, 3).reduce((sum, d) => sum + d.precipitation, 0);
  if (upcomingRain < 5) {
    recs.push({
      title: "Good Window for Fertilizing",
      description: "No heavy rain expected in the next 3 days. Apply fertilizer now for optimal absorption.",
      priority: "medium",
      category: "fertilizer",
    });
  } else if (upcomingRain > 15) {
    recs.push({
      title: "Delay Fertilizer Application",
      description: `${upcomingRain.toFixed(0)}mm of rain expected soon. Fertilizer may wash away.`,
      priority: "high",
      category: "fertilizer",
    });
  }

  const dryDays = forecast.filter((d) => d.precipitation < 1);
  if (dryDays.length >= 2) {
    recs.push({
      title: "Harvest Window Available",
      description: `${dryDays.length} dry days ahead. Ideal conditions for harvesting.`,
      priority: "low",
      category: "harvest",
    });
  }

  if (windSpeed < 15 && humidity > 40 && humidity < 80) {
    recs.push({
      title: "Good Conditions for Spraying",
      description: `Low wind (${windSpeed.toFixed(0)} km/h) and moderate humidity (${humidity}%).`,
      priority: "low",
      category: "spraying",
    });
  }

  return recs;
}

// ============================================================
// Main Hook
// ============================================================

interface UseWeatherOptions {
  latitude?: number;
  longitude?: number;
}

interface UseWeatherReturn {
  data: WeatherData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  setLocation: (lat: number, lon: number) => void;
  getWeatherDescription: (code: number) => string;
  getConditionCategory: (code: number) => string;
}

export function useWeather(options?: UseWeatherOptions): UseWeatherReturn {
  const [error, setError] = useState<string | null>(null);
  const [location, setLocationState] = useState({
    latitude: options?.latitude ?? -1.2921,
    longitude: options?.longitude ?? 36.8219,
  });

  // Round to ~1km precision for cache key
  const latRounded = Math.round(location.latitude * 100) / 100;
  const lonRounded = Math.round(location.longitude * 100) / 100;

  // 1. Try reading from Convex cache
  const cachedWeather = useQuery(api.weather.getCachedWeather, {
    latitude: latRounded,
    longitude: lonRounded,
  });

  // 2. Action to fetch fresh data from Open-Meteo (server-side)
  const fetchAndCacheWeather = useAction(api.weather.fetchAndCacheWeather);

  // 3. Trigger fresh fetch when cache is missing
  useEffect(() => {
    if (cachedWeather === undefined) return; // still loading
    if (cachedWeather !== null) return; // cache hit

    // No cache — fetch fresh data
    setError(null);
    fetchAndCacheWeather({
      latitude: location.latitude,
      longitude: location.longitude,
    }).catch((err) => {
      console.error("Weather fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch weather data");
    });
  }, [cachedWeather, location.latitude, location.longitude, fetchAndCacheWeather]);

  // 4. Process cached data into WeatherData format
  const data: WeatherData | null = useMemo(() => {
    if (!cachedWeather) return null;

    const now = new Date();
    const current: CurrentWeather = {
      temperature: cachedWeather.temperature,
      humidity: cachedWeather.humidity,
      windSpeed: cachedWeather.windSpeed,
      windDirection: cachedWeather.windDirection ?? 0,
      precipitation: cachedWeather.precipitation,
      uvIndex: cachedWeather.uvIndex ?? 0,
      weatherCode: 0,
      time: now.toISOString(),
      isDay: now.getHours() >= 6 && now.getHours() < 19,
    };

    // Build hourly from current + daily (simplified)
    const hourly: HourlyForecast[] = [];
    for (let h = 0; h < 24; h++) {
      const hourDate = new Date(now.getTime() + h * 60 * 60 * 1000);
      const dailyForHour = cachedWeather.forecast?.find((d) => {
        const dDate = new Date(d.date);
        return dDate.toDateString() === hourDate.toDateString();
      });
      hourly.push({
        time: hourDate.toISOString(),
        temperature: dailyForHour
          ? (dailyForHour.tempHigh + dailyForHour.tempLow) / 2
          : current.temperature,
        humidity: cachedWeather.humidity,
        windSpeed: cachedWeather.windSpeed,
        precipitation: dailyForHour?.precipitation ?? 0,
        precipitationProbability: 0,
        uvIndex: current.uvIndex,
        weatherCode: 0,
        isDay: hourDate.getHours() >= 6 && hourDate.getHours() < 19,
      });
    }

    const daily: DailyForecast[] = (cachedWeather.forecast || []).map((f) => ({
      date: new Date(f.date).toISOString().split("T")[0],
      tempMax: f.tempHigh,
      tempMin: f.tempLow,
      precipitationSum: f.precipitation,
      precipitationProbabilityMax: 0,
      windSpeedMax: f.windSpeed,
      uvIndexMax: current.uvIndex,
      weatherCode: 0,
      sunrise: "",
      sunset: "",
    }));

    const soil: SoilData = {
      temperature0cm: 20,
      temperature6cm: 18,
      moisture0to1cm: 0.3,
      moisture1to3cm: 0.35,
      moisture3to9cm: 0.4,
      et0FaoEvapotranspiration: 3,
    };

    const alerts: WeatherAlert[] = (cachedWeather.alerts || []).map((a) => ({
      type: a.type,
      severity: a.severity as "low" | "medium" | "high" | "critical",
      title: a.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      message: a.message,
    }));

    const recommendations = generateRecommendations(
      current.uvIndex,
      current.windSpeed,
      current.humidity,
      cachedWeather.forecast || []
    );

    return {
      current,
      hourly,
      daily,
      soil,
      location: {
        latitude: cachedWeather.latitude,
        longitude: cachedWeather.longitude,
        name: `${cachedWeather.latitude.toFixed(2)}°, ${cachedWeather.longitude.toFixed(2)}°`,
        country: "",
        elevation: 0,
        timezone: "auto",
      },
      alerts,
      recommendations,
    };
  }, [cachedWeather]);

  const refetch = useCallback(() => {
    setError(null);
    fetchAndCacheWeather({
      latitude: location.latitude,
      longitude: location.longitude,
    }).catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to fetch weather data");
    });
  }, [location.latitude, location.longitude, fetchAndCacheWeather]);

  const setLocation = useCallback((lat: number, lon: number) => {
    setLocationState({ latitude: lat, longitude: lon });
  }, []);

  return {
    data,
    isLoading: cachedWeather === undefined,
    error,
    refetch,
    setLocation,
    getWeatherDescription,
    getConditionCategory,
  };
}

// ============================================================
// Geolocation Hook
// ============================================================

interface UseGeolocationReturn {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => void;
}

export function useGeolocation(): UseGeolocationReturn {
  const [position, setPosition] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({ latitude: null, longitude: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return {
    latitude: position.latitude,
    longitude: position.longitude,
    loading,
    error,
    requestLocation,
  };
}
