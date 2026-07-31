import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export type UnitSystem = "metric" | "imperial";

// ============================================================
// Conversion Functions
// ============================================================

/** Temperature: Celsius ↔ Fahrenheit */
export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

export function fahrenheitToCelsius(f: number): number {
  return Math.round(((f - 32) * 5) / 9);
}

/** Distance: km ↔ miles */
export function kmToMiles(km: number): number {
  return Math.round(km * 0.621371 * 10) / 10;
}

export function milesToKm(miles: number): number {
  return Math.round(miles * 1.60934 * 10) / 10;
}

/** Wind speed: km/h ↔ mph */
export function kmhToMph(kmh: number): number {
  return Math.round(kmh * 0.621371);
}

/** Precipitation: mm ↔ inches */
export function mmToInches(mm: number): number {
  return Math.round(mm * 0.0393701 * 100) / 100;
}

/** Weight: kg ↔ lbs */
export function kgToLbs(kg: number): number {
  return Math.round(kg * 2.20462 * 10) / 10;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}

/** Area: hectares ↔ acres */
export function hectaresToAcres(ha: number): number {
  return Math.round(ha * 2.47105 * 10) / 10;
}

export function acresToHectares(acres: number): number {
  return Math.round(acres * 0.404686 * 10) / 10;
}

// ============================================================
// Hook
// ============================================================

function getStoredUnits(): UnitSystem {
  const stored = localStorage.getItem("farmbond-units") as UnitSystem | null;
  return stored === "imperial" ? "imperial" : "metric";
}

function applyUnits(units: UnitSystem) {
  localStorage.setItem("farmbond-units", units);
}

export function useUnits() {
  const prefs = useQuery(api.users.getPreferences);
  const updatePrefs = useMutation(api.users.updatePreferences);

  const unitSystem: UnitSystem = useMemo(() => {
    return (prefs?.units as UnitSystem) ?? getStoredUnits();
  }, [prefs?.units]);

  const setUnits = useCallback(
    (units: UnitSystem) => {
      applyUnits(units);
      updatePrefs({ units }).catch(() => {});
    },
    [updatePrefs]
  );

  const isMetric = unitSystem === "metric";

  // Conversion helpers based on current system
  const temp = useCallback(
    (celsius: number) => {
      if (isMetric) return `${celsius}°C`;
      return `${celsiusToFahrenheit(celsius)}°F`;
    },
    [isMetric]
  );

  const tempValue = useCallback(
    (celsius: number) => {
      return isMetric ? celsius : celsiusToFahrenheit(celsius);
    },
    [isMetric]
  );

  const tempUnit = isMetric ? "°C" : "°F";

  const wind = useCallback(
    (kmh: number) => {
      if (isMetric) return `${kmh} km/h`;
      return `${kmhToMph(kmh)} mph`;
    },
    [isMetric]
  );

  const precip = useCallback(
    (mm: number) => {
      if (isMetric) return `${mm} mm`;
      return `${mmToInches(mm)} in`;
    },
    [isMetric]
  );

  const distance = useCallback(
    (km: number) => {
      if (isMetric) return `${km} km`;
      return `${kmToMiles(km)} mi`;
    },
    [isMetric]
  );

  const weight = useCallback(
    (kg: number) => {
      if (isMetric) return `${kg} kg`;
      return `${kgToLbs(kg)} lbs`;
    },
    [isMetric]
  );

  const area = useCallback(
    (hectares: number) => {
      if (isMetric) return `${hectares} ha`;
      return `${hectaresToAcres(hectares)} acres`;
    },
    [isMetric]
  );

  const speedUnit = isMetric ? "km/h" : "mph";
  const precipUnit = isMetric ? "mm" : "in";
  const distanceUnit = isMetric ? "km" : "mi";
  const weightUnit = isMetric ? "kg" : "lbs";
  const areaUnit = isMetric ? "ha" : "acres";

  return {
    unitSystem,
    setUnits,
    isMetric,
    temp,
    tempValue,
    tempUnit,
    wind,
    precip,
    distance,
    weight,
    area,
    speedUnit,
    precipUnit,
    distanceUnit,
    weightUnit,
    areaUnit,
  };
}
