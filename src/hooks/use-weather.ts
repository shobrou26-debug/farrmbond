import { useState, useEffect, useCallback } from "react";

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

function isNightHour(hourStr: string, sunrise?: string, sunset?: string): boolean {
  const hour = new Date(hourStr).getHours();
  if (sunrise && sunset) {
    const sunriseHour = new Date(sunrise).getHours();
    const sunsetHour = new Date(sunset).getHours();
    return hour < sunriseHour || hour >= sunsetHour;
  }
  return hour < 6 || hour >= 19;
}

// ============================================================
// Reverse Geocoding via Open-Meteo
// ============================================================

async function reverseGeocode(lat: number, lon: number): Promise<{ name: string; country: string }> {
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=&latitude=${lat}&longitude=${lon}&count=1&language=en`
    );
    // Fallback: use timezone as location name
    return { name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, country: "" };
  } catch {
    return { name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, country: "" };
  }
}

// ============================================================
// Generate Alerts from Weather Data
// ============================================================

function generateAlerts(
  current: CurrentWeather,
  daily: DailyForecast[],
  soil: SoilData
): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];

  // Heavy rain alert
  const heavyRainDay = daily.find((d) => d.precipitationSum > 20);
  if (heavyRainDay) {
    alerts.push({
      type: "heavy_rain",
      severity: "high",
      title: "Heavy Rain Expected",
      message: `${heavyRainDay.precipitationSum.toFixed(1)}mm of rain expected on ${heavyRainDay.date}. Ensure drainage is clear and delay field operations.`,
    });
  }

  // High UV alert
  if (current.uvIndex >= 8) {
    alerts.push({
      type: "uv",
      severity: "medium",
      title: "Very High UV Index",
      message: `UV index is ${current.uvIndex}. Avoid midday field work and wear protective clothing.`,
    });
  }

  // Low temperature / frost risk
  const frostRisk = daily.find((d) => d.tempMin < 5);
  if (frostRisk) {
    alerts.push({
      type: "frost",
      severity: frostRisk.tempMin < 2 ? "high" : "medium",
      title: "Frost Risk",
      message: `Temperatures may drop to ${frostRisk.tempMin.toFixed(0)}°C on ${frostRisk.date}. Protect sensitive crops.`,
    });
  }

  // High wind
  if (current.windSpeed > 40) {
    alerts.push({
      type: "wind",
      severity: "medium",
      title: "Strong Winds",
      message: `Wind speeds of ${current.windSpeed.toFixed(0)} km/h. Secure loose structures and delay spraying operations.`,
    });
  }

  // Soil moisture low
  if (soil.moisture0to1cm < 0.15) {
    alerts.push({
      type: "drought",
      severity: "high",
      title: "Low Soil Moisture",
      message: `Soil moisture at ${soil.moisture0to1cm.toFixed(2)} m³/m³ is critically low. Increase irrigation immediately.`,
    });
  }

  // Heavy rain in coming days
  const heavyRainDays = daily.filter((d) => d.precipitationSum > 10);
  if (heavyRainDays.length > 0 && !alerts.find((a) => a.type === "heavy_rain")) {
    alerts.push({
      type: "rain",
      severity: "medium",
      title: "Rain Expected This Week",
      message: `${heavyRainDays.length} day(s) with significant rainfall expected. Plan activities accordingly.`,
    });
  }

  return alerts;
}

// ============================================================
// Generate Recommendations from Weather Data
// ============================================================

function generateRecommendations(
  current: CurrentWeather,
  daily: DailyForecast[],
  soil: SoilData
): WeatherRecommendation[] {
  const recs: WeatherRecommendation[] = [];

  // Irrigation recommendation based on soil moisture
  if (soil.moisture0to1cm < 0.2) {
    recs.push({
      title: "Increase Irrigation",
      description: `Soil moisture is at ${(soil.moisture0to1cm * 100).toFixed(0)}%. Increase irrigation frequency for all crops.`,
      priority: "high",
      category: "irrigation",
    });
  } else if (soil.moisture0to1cm > 0.4) {
    recs.push({
      title: "Reduce Irrigation",
      description: `Soil moisture is high at ${(soil.moisture0to1cm * 100).toFixed(0)}%. Delay irrigation to prevent waterlogging.`,
      priority: "medium",
      category: "irrigation",
    });
  }

  // Fertilizer recommendation
  const upcomingRain = daily.slice(0, 3).reduce((sum, d) => sum + d.precipitationSum, 0);
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
      description: `${upcomingRain.toFixed(0)}mm of rain expected soon. Fertilizer may wash away before absorption.`,
      priority: "high",
      category: "fertilizer",
    });
  }

  // Harvest window
  const dryDays = daily.filter((d) => d.precipitationSum < 1);
  if (dryDays.length >= 2) {
    recs.push({
      title: "Harvest Window Available",
      description: `${dryDays.length} dry days ahead. Ideal conditions for harvesting mature crops.`,
      priority: "low",
      category: "harvest",
    });
  }

  // Spraying recommendation
  if (current.windSpeed < 15 && current.humidity > 40 && current.humidity < 80) {
    recs.push({
      title: "Good Conditions for Spraying",
      description: `Low wind (${current.windSpeed.toFixed(0)} km/h) and moderate humidity (${current.humidity}%). Ideal for pesticide/fungicide application.`,
      priority: "low",
      category: "spraying",
    });
  }

  // High evapotranspiration
  if (soil.et0FaoEvapotranspiration > 6) {
    recs.push({
      title: "High Water Demand",
      description: `Evapotranspiration rate is ${soil.et0FaoEvapotranspiration.toFixed(1)} mm/day. Crops will need extra water.`,
      priority: "medium",
      category: "irrigation",
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
  const [data, setData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocationState] = useState({
    latitude: options?.latitude ?? -1.2921,
    longitude: options?.longitude ?? 36.8219,
  });

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
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

      const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
      if (!response.ok) throw new Error("Failed to fetch weather data");
      const json = await response.json();

      // Fetch soil data separately (different parameters)
      const soilParams = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        hourly: [
          "soil_temperature_0cm",
          "soil_temperature_6cm",
          "soil_moisture_0_to_1cm",
          "soil_moisture_1_to_3cm",
          "soil_moisture_3_to_9cm",
          "et0_fao_evapotranspiration",
        ].join(","),
        timezone: "auto",
        forecast_days: "1",
      });

      const soilResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${soilParams}`);
      const soilJson = await soilResponse.json();

      // Process current weather
      const current: CurrentWeather = {
        temperature: json.current.temperature_2m,
        humidity: json.current.relative_humidity_2m,
        windSpeed: json.current.wind_speed_10m,
        windDirection: json.current.wind_direction_10m ?? 0,
        precipitation: json.current.precipitation,
        uvIndex: json.current.uv_index ?? 0,
        weatherCode: json.current.weather_code,
        time: json.current.time,
        isDay: json.current.is_day === 1,
      };

      // Process hourly (next 24 hours)
      const now = new Date();
      const hourlyStartIdx = json.hourly.time.findIndex((t: string) => new Date(t) >= now);
      const hourlySlice = Math.max(0, hourlyStartIdx);
      const hourly: HourlyForecast[] = json.hourly.time
        .slice(hourlySlice, hourlySlice + 24)
        .map((time: string, i: number) => ({
          time,
          temperature: json.hourly.temperature_2m[hourlySlice + i],
          humidity: json.hourly.relative_humidity_2m[hourlySlice + i],
          windSpeed: json.hourly.wind_speed_10m[hourlySlice + i],
          precipitation: json.hourly.precipitation[hourlySlice + i],
          precipitationProbability: json.hourly.precipitation_probability?.[hourlySlice + i] ?? 0,
          uvIndex: json.hourly.uv_index?.[hourlySlice + i] ?? 0,
          weatherCode: json.hourly.weather_code[hourlySlice + i],
          isDay: json.hourly.is_day?.[hourlySlice + i] === 1,
        }));

      // Process daily
      const daily: DailyForecast[] = json.daily.time.map((date: string, i: number) => ({
        date,
        tempMax: json.daily.temperature_2m_max[i],
        tempMin: json.daily.temperature_2m_min[i],
        precipitationSum: json.daily.precipitation_sum[i],
        precipitationProbabilityMax: json.daily.precipitation_probability_max?.[i] ?? 0,
        windSpeedMax: json.daily.wind_speed_10m_max[i],
        uvIndexMax: json.daily.uv_index_max?.[i] ?? 0,
        weatherCode: json.daily.weather_code[i],
        sunrise: json.daily.sunrise?.[i] ?? "",
        sunset: json.daily.sunset?.[i] ?? "",
      }));

      // Process soil data (use current hour or last available)
      const soilHourlyTime = soilJson.hourly?.time ?? [];
      const soilIdx = soilHourlyTime.findIndex((t: string) => new Date(t) >= now);
      const soilI = Math.max(0, soilIdx === -1 ? soilHourlyTime.length - 1 : soilIdx);

      const soil: SoilData = {
        temperature0cm: soilJson.hourly?.soil_temperature_0cm?.[soilI] ?? 20,
        temperature6cm: soilJson.hourly?.soil_temperature_6cm?.[soilI] ?? 18,
        moisture0to1cm: soilJson.hourly?.soil_moisture_0_to_1cm?.[soilI] ?? 0.3,
        moisture1to3cm: soilJson.hourly?.soil_moisture_1_to_3cm?.[soilI] ?? 0.35,
        moisture3to9cm: soilJson.hourly?.soil_moisture_3_to_9cm?.[soilI] ?? 0.4,
        et0FaoEvapotranspiration: soilJson.hourly?.et0_fao_evapotranspiration?.[soilI] ?? 3,
      };

      const weatherData: WeatherData = {
        current,
        hourly,
        daily,
        soil,
        location: {
          latitude: json.latitude,
          longitude: json.longitude,
          name: json.timezone ?? `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`,
          country: "",
          elevation: json.elevation ?? 0,
          timezone: json.timezone,
        },
        alerts: generateAlerts(current, daily, soil),
        recommendations: generateRecommendations(current, daily, soil),
      };

      setData(weatherData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch weather data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather(location.latitude, location.longitude);
  }, [location.latitude, location.longitude, fetchWeather]);

  const refetch = useCallback(() => {
    fetchWeather(location.latitude, location.longitude);
  }, [location.latitude, location.longitude, fetchWeather]);

  const setLocation = useCallback((lat: number, lon: number) => {
    setLocationState({ latitude: lat, longitude: lon });
  }, []);

  return {
    data,
    isLoading,
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
