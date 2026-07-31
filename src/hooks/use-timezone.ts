import { useCallback, useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// ============================================================
// Popular Timezones (grouped by region)
// ============================================================

export const TIMEZONE_GROUPS = [
  {
    label: "Africa",
    zones: [
      { value: "Africa/Nairobi", label: "Nairobi (EAT, UTC+3)" },
      { value: "Africa/Lagos", label: "Lagos (WAT, UTC+1)" },
      { value: "Africa/Johannesburg", label: "Johannesburg (SAST, UTC+2)" },
      { value: "Africa/Cairo", label: "Cairo (EET, UTC+2)" },
      { value: "Africa/Addis_Ababa", label: "Addis Ababa (EAT, UTC+3)" },
      { value: "Africa/Dar_es_Salaam", label: "Dar es Salaam (EAT, UTC+3)" },
      { value: "Africa/Accra", label: "Accra (GMT, UTC+0)" },
      { value: "Africa/Kampala", label: "Kampala (EAT, UTC+3)" },
      { value: "Africa/Khartoum", label: "Khartoum (CAT, UTC+2)" },
      { value: "Africa/Casablanca", label: "Casablanca (WET, UTC+1)" },
    ],
  },
  {
    label: "Europe",
    zones: [
      { value: "Europe/London", label: "London (GMT/BST)" },
      { value: "Europe/Paris", label: "Paris (CET/CEST)" },
      { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
      { value: "Europe/Rome", label: "Rome (CET/CEST)" },
      { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
      { value: "Europe/Amsterdam", label: "Amsterdam (CET/CEST)" },
      { value: "Europe/Moscow", label: "Moscow (MSK, UTC+3)" },
      { value: "Europe/Istanbul", label: "Istanbul (TRT, UTC+3)" },
      { value: "Europe/Kiev", label: "Kyiv (EET/EEST)" },
    ],
  },
  {
    label: "Americas",
    zones: [
      { value: "America/New_York", label: "New York (EST/EDT)" },
      { value: "America/Chicago", label: "Chicago (CST/CDT)" },
      { value: "America/Denver", label: "Denver (MST/MDT)" },
      { value: "America/Los_Angeles", label: "Los Angeles (PST/PDT)" },
      { value: "America/Sao_Paulo", label: "São Paulo (BRT, UTC-3)" },
      { value: "America/Mexico_City", label: "Mexico City (CST/CDT)" },
      { value: "America/Toronto", label: "Toronto (EST/EDT)" },
      { value: "America/Bogota", label: "Bogota (COT, UTC-5)" },
      { value: "America/Nairobi", label: "Nairobi" },
    ],
  },
  {
    label: "Asia",
    zones: [
      { value: "Asia/Dubai", label: "Dubai (GST, UTC+4)" },
      { value: "Asia/Kolkata", label: "Mumbai (IST, UTC+5:30)" },
      { value: "Asia/Shanghai", label: "Shanghai (CST, UTC+8)" },
      { value: "Asia/Tokyo", label: "Tokyo (JST, UTC+9)" },
      { value: "Asia/Bangkok", label: "Bangkok (ICT, UTC+7)" },
      { value: "Asia/Jakarta", label: "Jakarta (WIB, UTC+7)" },
      { value: "Asia/Manila", label: "Manila (PHT, UTC+8)" },
      { value: "Asia/Karachi", label: "Karachi (PKT, UTC+5)" },
      { value: "Asia/Ho_Chi_Minh", label: "Ho Chi Minh (ICT, UTC+7)" },
    ],
  },
  {
    label: "Oceania",
    zones: [
      { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
      { value: "Australia/Melbourne", label: "Melbourne (AEST/AEDT)" },
      { value: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
      { value: "Pacific/Fiji", label: "Fiji (FJT, UTC+12)" },
    ],
  },
] as const;

// ============================================================
// Detect browser timezone
// ============================================================

function detectBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

// ============================================================
// Formatting helpers
// ============================================================

/**
 * Format a time string (HH:MM or ISO date) in the given timezone
 */
export function formatTimeInTimezone(
  timeStr: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    // Try parsing as ISO date first
    const date = timeStr.includes("T")
      ? new Date(timeStr)
      : new Date(`2000-01-01T${timeStr}`);

    if (isNaN(date.getTime())) return timeStr;

    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...options,
    }).format(date);
  } catch {
    return timeStr;
  }
}

/**
 * Format a full date/time in the given timezone
 */
export function formatDateTimeInTimezone(
  isoStr: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return isoStr;

    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...options,
    }).format(date);
  } catch {
    return isoStr;
  }
}

/**
 * Get current time in a timezone
 */
export function getCurrentTimeInTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch {
    return new Date().toLocaleTimeString();
  }
}

/**
 * Get the UTC offset string for a timezone
 */
export function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const parts = formatter.formatToParts(now);
    const offsetPart = parts.find((p) => p.type === "timeZoneName");
    return offsetPart?.value ?? "";
  } catch {
    return "";
  }
}

// ============================================================
// Hook
// ============================================================

const STORAGE_KEY = "farmbond-timezone";

export function useTimezone() {
  const prefs = useQuery(api.users.getPreferences);
  const updatePrefs = useMutation(api.users.updatePreferences);

  // Determine timezone: prefer user preference, then browser detection
  const timezone = useMemo(() => {
    if (prefs?.timezone) return prefs.timezone;
    // Check localStorage before Convex loads
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    }
    return detectBrowserTimezone();
  }, [prefs?.timezone]);

  /**
   * Set user's timezone preference (persists to Convex + localStorage)
   */
  const setTimezone = useCallback(
    async (tz: string) => {
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEY, tz);
      }
      await updatePrefs({ timezone: tz });
    },
    [updatePrefs]
  );

  /**
   * Format a time string in the user's timezone
   */
  const formatTime = useCallback(
    (timeStr: string, options?: Intl.DateTimeFormatOptions) => {
      return formatTimeInTimezone(timeStr, timezone, options);
    },
    [timezone]
  );

  /**
   * Format a full date/time in the user's timezone
   */
  const formatDateTime = useCallback(
    (isoStr: string, options?: Intl.DateTimeFormatOptions) => {
      return formatDateTimeInTimezone(isoStr, timezone, options);
    },
    [timezone]
  );

  /**
   * Get current time display in user's timezone
   */
  const currentTime = useMemo(() => getCurrentTimeInTimezone(timezone), [timezone]);

  /**
   * Get the offset string (e.g., "UTC+3")
   */
  const offset = useMemo(() => getTimezoneOffset(timezone), [timezone]);

  /**
   * Auto-detect timezone and save if no preference set yet
   */
  const autoDetect = useCallback(async () => {
    if (!prefs?.timezone) {
      const detected = detectBrowserTimezone();
      await setTimezone(detected);
    }
  }, [prefs?.timezone, setTimezone]);

  return {
    timezone,
    setTimezone,
    formatTime,
    formatDateTime,
    currentTime,
    offset,
    autoDetect,
    timezoneGroups: TIMEZONE_GROUPS,
    isLoading: prefs === undefined,
  };
}

/**
 * TimezoneApplier - auto-detects and saves timezone on first visit.
 * Renders nothing, side-effect only.
 */
export { detectBrowserTimezone as getTimezoneOffset_ };
