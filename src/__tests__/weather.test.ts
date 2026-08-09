import { describe, test, expect } from "bun:test";
import {
  extractSoilFromOpenMeteo,
  mapForecastDays,
  selectLocationsToRefresh,
  chunkArray,
} from "../convex/weather";

// ============================================================
// Phase 3 — weather data honesty
// Previously the backend persisted hardcoded soil defaults and the UI
// hardcoded weatherCode: 0 (always "Clear Sky"). These tests lock in
// real provider data flowing through, and nothing being invented.
// ============================================================

describe("extractSoilFromOpenMeteo — no fabricated soil", () => {
  test("returns null when the provider returns no hourly soil arrays", () => {
    expect(extractSoilFromOpenMeteo({})).toBe(null);
    expect(extractSoilFromOpenMeteo({ hourly: {} })).toBe(null);
    expect(
      extractSoilFromOpenMeteo({
        hourly: { soil_temperature_0cm: [20], soil_moisture_0_to_1cm: undefined },
      })
    ).toBe(null);
  });

  test("returns only real fields when soil data exists — no invented depth/ET0", () => {
    const soil = extractSoilFromOpenMeteo({
      hourly: {
        soil_temperature_0cm: [21.5, 22],
        soil_moisture_0_to_1cm: [0.24, 0.26],
      },
    });
    expect(soil).not.toBe(null);
    expect(typeof soil!.temperature0cm).toBe("number");
    expect(typeof soil!.moisture0to1cm).toBe("number");
    // Fields Open-Meteo does not provide must stay ABSENT — never invented.
    expect("et0FaoEvapotranspiration" in (soil as object)).toBe(false);
    expect("moisture3to9cm" in (soil as object)).toBe(false);
    expect("moisture1to3cm" in (soil as object)).toBe(false);
  });
});

describe("mapForecastDays — real codes, no hardcoded values", () => {
  const daily = {
    time: ["2026-08-09", "2026-08-10"],
    weather_code: [61, 95],
    temperature_2m_max: [24, 22],
    temperature_2m_min: [14, 13],
    precipitation_sum: [8.2, 15.5],
    precipitation_probability_max: [70, 90],
    relative_humidity_2m_max: [88, 92],
    wind_speed_10m_max: [18, 25],
    uv_index_max: [6, 4],
    sunrise: ["2026-08-09T06:12:00", "2026-08-10T06:11:00"],
    sunset: ["2026-08-09T18:40:00", "2026-08-10T18:39:00"],
  };

  test("carries the real WMO weather codes (no hardcoded 0 / eternal Clear Sky)", () => {
    const days = mapForecastDays({ daily }, 60);
    expect(days[0].weatherCode).toBe(61);
    expect(days[1].weatherCode).toBe(95);
    expect(days[0].condition).toBe("rain");
    expect(days[1].condition).toBe("thunderstorm");
  });

  test("carries real precipitation probability and UV max", () => {
    const days = mapForecastDays({ daily }, 60);
    expect(days[0].precipitationProbability).toBe(70);
    expect(days[1].precipitationProbability).toBe(90);
    expect(days[0].uvIndexMax).toBe(6);
  });

  test("carries real sunrise/sunset timestamps", () => {
    const days = mapForecastDays({ daily }, 60);
    expect(days[0].sunrise).toBe(Date.parse("2026-08-09T06:12:00"));
    expect(days[0].sunset).toBe(Date.parse("2026-08-09T18:40:00"));
  });

  test("humidity comes from the real daily max, never a hardcoded 50", () => {
    const days = mapForecastDays({ daily }, 60);
    expect(days[0].humidity).toBe(88);
  });

  test("missing daily data yields an empty array (never fabricated days)", () => {
    expect(mapForecastDays({}, 60)).toEqual([]);
    expect(mapForecastDays({ daily: {} }, 60)).toEqual([]);
  });
});

// ============================================================
// Phase 5 — bounded, freshness-aware weather cron batching
// ============================================================

describe("selectLocationsToRefresh — bounded + freshness-aware", () => {
  const locations = [
    { latitude: 1, longitude: 1 },
    { latitude: 2, longitude: 2 },
    { latitude: 3, longitude: 3 },
  ];

  test("never-cached locations are always refreshed", () => {
    const selected = selectLocationsToRefresh(locations, new Map(), Date.now(), 10);
    expect(selected).toHaveLength(3);
  });

  test("locations with a still-fresh cache are skipped", () => {
    const now = Date.now();
    const expires = new Map<string, number>([
      ["1,1", now + 60_000],
      ["2,2", now - 1],
    ]);
    const selected = selectLocationsToRefresh(locations, expires, now, 10);
    expect(selected.map((l) => l.longitude)).toEqual([2, 3]);
  });

  test("the batch is capped per cron run", () => {
    const selected = selectLocationsToRefresh(locations, new Map(), Date.now(), 2);
    expect(selected).toHaveLength(2);
  });

  test("chunkArray splits work into bounded parallel chunks", () => {
    expect(chunkArray([1, 2, 3, 4, 5, 6], 2)).toEqual([[1, 2], [3, 4], [5, 6]]);
    expect(chunkArray([], 5)).toEqual([]);
  });
});
