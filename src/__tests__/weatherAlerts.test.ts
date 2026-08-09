import { describe, expect, test } from "bun:test";
import {
  WEATHER_ALERT_TYPES,
  validateAlertConfig,
  shouldGenerateAlert,
  ALERT_COOLDOWNS,
  SEVERITY_RANK,
  evaluateWeatherAlerts,
  DEFAULT_WEATHER_ALERT_CONFIG,
  type WeatherAlertConfig,
  type WeatherSnapshot,
} from "../convex/weatherAlerts";
import { verifyNotificationOwnership } from "../convex/authHelpers";

// ============================================================
// Fake Convex ctx: only the `db.get` surface used by the
// ownership verifier is mocked.
// ============================================================
function makeCtx(docs: Record<string, unknown>) {
  return {
    db: {
      get: async (id: string) => docs[id] ?? null,
    },
  } as never;
}

const userId = "user_owner";

// ============================================================
// Config validation (server-side rules)
// ============================================================
describe("validateAlertConfig", () => {
  test("accepts the default config", () => {
    expect(validateAlertConfig(DEFAULT_WEATHER_ALERT_CONFIG)).toEqual([]);
  });

  test("accepts a minimal valid config", () => {
    const cfg: WeatherAlertConfig = {
      enabled: false,
      types: ["heavy_rain", "frost"],
      severityThreshold: "medium",
      pushNotifications: false,
      emailNotifications: false,
      checkInterval: 60,
      location: { latitude: -1.2921, longitude: 36.8219 },
    };
    expect(validateAlertConfig(cfg)).toEqual([]);
  });

  test("rejects an unknown alert type", () => {
    expect(
      validateAlertConfig({ ...DEFAULT_WEATHER_ALERT_CONFIG, types: ["volcano"] as never }).join("; ")
    ).toContain("Unknown alert type");
  });

  test("rejects an empty types list", () => {
    expect(
      validateAlertConfig({ ...DEFAULT_WEATHER_ALERT_CONFIG, types: [] }).join("; ")
    ).toContain("At least one alert type");
  });

  test("rejects an invalid severity threshold", () => {
    expect(
      validateAlertConfig({ ...DEFAULT_WEATHER_ALERT_CONFIG, severityThreshold: "extreme" as never }).join("; ")
    ).toContain("severityThreshold");
  });

  test("rejects a check interval below 5 minutes", () => {
    expect(
      validateAlertConfig({ ...DEFAULT_WEATHER_ALERT_CONFIG, checkInterval: 1 }).join("; ")
    ).toContain("checkInterval");
  });

  test("rejects latitude out of range", () => {
    expect(
      validateAlertConfig({
        ...DEFAULT_WEATHER_ALERT_CONFIG,
        location: { latitude: 91, longitude: 36 },
      }).join("; ")
    ).toContain("Latitude");
  });

  test("rejects longitude out of range", () => {
    expect(
      validateAlertConfig({
        ...DEFAULT_WEATHER_ALERT_CONFIG,
        location: { latitude: 0, longitude: -181 },
      }).join("; ")
    ).toContain("Longitude");
  });
});

// ============================================================
// Alert derivation — real data only, no fabricated readings
// ============================================================
function makeSnapshot(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  const day = 24 * 60 * 60 * 1000;
  const today = Date.now();
  return {
    temperature: 22,
    humidity: 60,
    windSpeed: 10,
    precipitation: 0,
    uvIndex: 4,
    // Alternate dry/wet days so no 3-day dry streak (which would
    // legitimately trigger an optimal_harvest opportunity alert).
    forecast: [
      { date: today + day, tempHigh: 26, tempLow: 14, precipitation: 1, windSpeed: 8 },
      { date: today + 2 * day, tempHigh: 27, tempLow: 15, precipitation: 0, windSpeed: 9 },
      { date: today + 3 * day, tempHigh: 28, tempLow: 16, precipitation: 1, windSpeed: 10 },
      { date: today + 4 * day, tempHigh: 25, tempLow: 15, precipitation: 0, windSpeed: 11 },
      { date: today + 5 * day, tempHigh: 24, tempLow: 14, precipitation: 1, windSpeed: 10 },
      { date: today + 6 * day, tempHigh: 26, tempLow: 15, precipitation: 0, windSpeed: 9 },
      { date: today + 7 * day, tempHigh: 27, tempLow: 16, precipitation: 1, windSpeed: 8 },
    ],
    ...overrides,
  };
}

const ALL_TYPES_CONFIG: WeatherAlertConfig = {
  ...DEFAULT_WEATHER_ALERT_CONFIG,
  severityThreshold: "low",
};

describe("evaluateWeatherAlerts — derivation from real data", () => {
  test("benign weather produces no alerts", () => {
    const alerts = evaluateWeatherAlerts(makeSnapshot(), ALL_TYPES_CONFIG, Date.now());
    expect(alerts).toEqual([]);
  });

  test("heavy rain day produces a heavy_rain alert", () => {
    const day = 24 * 60 * 60 * 1000;
    const today = Date.now();
    const snapshot = makeSnapshot({
      forecast: [
        { date: today + day, tempHigh: 22, tempLow: 15, precipitation: 35, windSpeed: 10 },
        ...makeSnapshot().forecast.slice(1),
      ],
    });
    const alerts = evaluateWeatherAlerts(snapshot, ALL_TYPES_CONFIG, today);
    expect(alerts.some((a) => a.type === "heavy_rain")).toBe(true);
  });

  test("frost day produces a frost alert", () => {
    const day = 24 * 60 * 60 * 1000;
    const today = Date.now();
    const snapshot = makeSnapshot({
      forecast: [
        { date: today + day, tempHigh: 8, tempLow: 3, precipitation: 0, windSpeed: 8 },
        ...makeSnapshot().forecast.slice(1),
      ],
    });
    const alerts = evaluateWeatherAlerts(snapshot, ALL_TYPES_CONFIG, today);
    expect(alerts.some((a) => a.type === "frost")).toBe(true);
  });

  test("low soil moisture produces a soil_moisture_low alert", () => {
    const alerts = evaluateWeatherAlerts(
      makeSnapshot({ soilMoisture: 0.1 }),
      ALL_TYPES_CONFIG,
      Date.now()
    );
    expect(alerts.some((a) => a.type === "soil_moisture_low")).toBe(true);
  });

  test("high soil moisture produces a soil_moisture_high alert", () => {
    const alerts = evaluateWeatherAlerts(
      makeSnapshot({ soilMoisture: 0.6 }),
      ALL_TYPES_CONFIG,
      Date.now()
    );
    expect(alerts.some((a) => a.type === "soil_moisture_high")).toBe(true);
  });

  test("no soil moisture data produces NO soil-derived alerts (no fabrication)", () => {
    const alerts = evaluateWeatherAlerts(
      makeSnapshot({ soilMoisture: undefined }),
      ALL_TYPES_CONFIG,
      Date.now()
    );
    expect(alerts.some((a) => a.type === "soil_moisture_low")).toBe(false);
    expect(alerts.some((a) => a.type === "soil_moisture_high")).toBe(false);
    expect(alerts.some((a) => a.type === "drought")).toBe(false);
    expect(alerts.some((a) => a.type === "flood")).toBe(false);
  });

  test("high UV index produces a high_uv alert", () => {
    const alerts = evaluateWeatherAlerts(
      makeSnapshot({ uvIndex: 9 }),
      ALL_TYPES_CONFIG,
      Date.now()
    );
    expect(alerts.some((a) => a.type === "high_uv")).toBe(true);
  });

  test("strong wind produces a strong_wind alert", () => {
    const alerts = evaluateWeatherAlerts(
      makeSnapshot({ windSpeed: 45 }),
      ALL_TYPES_CONFIG,
      Date.now()
    );
    expect(alerts.some((a) => a.type === "strong_wind")).toBe(true);
  });

  test("disabled alert types are not generated", () => {
    const day = 24 * 60 * 60 * 1000;
    const today = Date.now();
    const snapshot = makeSnapshot({
      forecast: [
        { date: today + day, tempHigh: 22, tempLow: 15, precipitation: 35, windSpeed: 10 },
        ...makeSnapshot().forecast.slice(1),
      ],
    });
    const alerts = evaluateWeatherAlerts(
      snapshot,
      { ...ALL_TYPES_CONFIG, types: ["frost"] },
      today
    );
    expect(alerts.some((a) => a.type === "heavy_rain")).toBe(false);
  });

  test("severity threshold filters out low-severity alerts", () => {
    const day = 24 * 60 * 60 * 1000;
    const today = Date.now();
    // Optimal planting is a low-severity opportunity alert
    const snapshot = makeSnapshot({
      forecast: [
        { date: today + day, tempHigh: 24, tempLow: 15, precipitation: 10, windSpeed: 8 },
        ...makeSnapshot().forecast.slice(1),
      ],
    });
    const strict = evaluateWeatherAlerts(
      snapshot,
      { ...ALL_TYPES_CONFIG, severityThreshold: "high" },
      today
    );
    expect(strict.some((a) => a.type === "optimal_planting")).toBe(false);

    const lenient = evaluateWeatherAlerts(
      snapshot,
      { ...ALL_TYPES_CONFIG, severityThreshold: "low" },
      today
    );
    expect(lenient.some((a) => a.type === "optimal_planting")).toBe(true);
  });

  test("every alert has recommendations and an expiry", () => {
    const day = 24 * 60 * 60 * 1000;
    const today = Date.now();
    const snapshot = makeSnapshot({
      soilMoisture: 0.1,
      uvIndex: 10,
      forecast: [
        { date: today + day, tempHigh: 22, tempLow: 15, precipitation: 35, windSpeed: 10 },
        ...makeSnapshot().forecast.slice(1),
      ],
    });
    const alerts = evaluateWeatherAlerts(snapshot, ALL_TYPES_CONFIG, today);
    expect(alerts.length).toBeGreaterThan(0);
    for (const a of alerts) {
      expect(a.recommendations.length).toBeGreaterThan(0);
      expect(a.expiresAt).toBeGreaterThan(today);
      expect(WEATHER_ALERT_TYPES).toContain(a.type);
      expect(SEVERITY_RANK[a.severity]).toBeGreaterThanOrEqual(0);
    }
  });
});

// ============================================================
// Cooldown / deduplication
// ============================================================
describe("shouldGenerateAlert — duplicate prevention", () => {
  test("generates when never triggered", () => {
    expect(shouldGenerateAlert(undefined, "heavy_rain", Date.now())).toBe(true);
  });

  test("suppresses when the cooldown has not elapsed", () => {
    const now = Date.now();
    expect(shouldGenerateAlert(now - 60 * 60 * 1000, "heavy_rain", now)).toBe(false);
  });

  test("allows when the cooldown has elapsed", () => {
    const now = Date.now();
    const cooldown = ALERT_COOLDOWNS.heavy_rain;
    expect(shouldGenerateAlert(now - cooldown - 1000, "heavy_rain", now)).toBe(true);
  });

  test("cooldowns differ per type", () => {
    expect(ALERT_COOLDOWNS.drought).toBeGreaterThan(ALERT_COOLDOWNS.heavy_rain);
  });

  test("each alert type has a defined cooldown", () => {
    for (const t of WEATHER_ALERT_TYPES) {
      expect(ALERT_COOLDOWNS[t]).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// Notification ownership — cross-user access denial
// ============================================================
describe("verifyNotificationOwnership", () => {
  test("returns the notification when the user owns it", async () => {
    const ctx = makeCtx({
      notif_1: { _id: "notif_1", userId, title: "Frost Warning", isRead: false },
    });
    const notification = await verifyNotificationOwnership(ctx, "notif_1", userId);
    expect(String(notification._id)).toBe("notif_1");
    expect(String(notification.userId)).toBe(userId);
  });

  test("throws when the notification does not exist", async () => {
    const ctx = makeCtx({});
    await expect(
      verifyNotificationOwnership(ctx, "missing", userId)
    ).rejects.toThrow(/not found/);
  });

  test("throws when another user owns the notification", async () => {
    const ctx = makeCtx({
      notif_1: { _id: "notif_1", userId: "user_intruder", title: "Frost Warning" },
    });
    await expect(
      verifyNotificationOwnership(ctx, "notif_1", userId)
    ).rejects.toThrow(/do not own/);
  });
});
