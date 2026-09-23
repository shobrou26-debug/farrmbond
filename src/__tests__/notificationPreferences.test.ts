import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  resolveNotificationPreferences,
} from "../lib/notificationPreferences";

// ============================================================
// Notification preferences — Settings persistence + generator gating
//
// Settings → Notifications was previously local-only state that reset
// on reload. These tests guard the shared resolver (defaults, partial
// rows, null rows) and verify the wiring between Settings UI, the
// Convex backend, and every notification generator.
// ============================================================

describe("notificationPreferences resolver", () => {
  test("defaults: all opted-in categories on, market/push off", () => {
    expect(DEFAULT_NOTIFICATION_PREFERENCES).toEqual({
      weatherAlerts: true,
      cropReminders: true,
      livestockAlerts: true,
      marketPrices: false,
      communityUpdates: true,
      aiInsights: true,
      systemUpdates: true,
      emailDigest: true,
      pushEnabled: false,
    });
  });

  test("missing row resolves to defaults (no behavior change for existing users)", () => {
    expect(resolveNotificationPreferences(undefined)).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
    expect(resolveNotificationPreferences(null)).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
  });

  test("empty partial row resolves to defaults", () => {
    expect(resolveNotificationPreferences({})).toEqual(
      DEFAULT_NOTIFICATION_PREFERENCES
    );
  });

  test("partial row keeps defaults for unspecified keys", () => {
    expect(
      resolveNotificationPreferences({ weatherAlerts: false })
    ).toEqual({
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      weatherAlerts: false,
    });
    expect(resolveNotificationPreferences({ emailDigest: false }).cropReminders).toBe(
      DEFAULT_NOTIFICATION_PREFERENCES.cropReminders
    );
  });

  test("full saved row is returned as-is", () => {
    const saved = {
      weatherAlerts: false,
      cropReminders: false,
      livestockAlerts: false,
      marketPrices: true,
      communityUpdates: false,
      aiInsights: false,
      systemUpdates: false,
      emailDigest: false,
      pushEnabled: true,
    };
    expect(resolveNotificationPreferences(saved)).toEqual(saved);
  });

  test("saved value wins over default for every key (each toggles independently)", () => {
    for (const key of Object.keys(
      DEFAULT_NOTIFICATION_PREFERENCES
    ) as Array<keyof typeof DEFAULT_NOTIFICATION_PREFERENCES>) {
      const flipped = !DEFAULT_NOTIFICATION_PREFERENCES[key];
      const resolved = resolveNotificationPreferences({ [key]: flipped });
      expect(resolved[key]).toBe(flipped);
    }
  });
});

describe("notificationPreferences persistence wiring (source guards)", () => {
  const read = (p: string): string =>
    readFileSync(new URL(p, import.meta.url), "utf8");

  const schema = read("../convex/schema.ts");
  const backend = read("../convex/notificationPreferences.ts");
  const settings = read("../pages/Settings.tsx");

  test("schema declares notificationPreferences table with by_user unique index", () => {
    expect(schema).toContain("notificationPreferences: defineTable({");
    expect(schema).toContain("userId: v.id(\"users\")");
    // Single row per user is enforced via the by_user index + .unique() reads.
    const tableMatch = schema.match(
      /notificationPreferences: defineTable\(\{[\s\S]*?\}\)\s*\.index\("by_user", \["userId"\]\)/
    );
    expect(tableMatch).not.toBeNull();
  });

  test("backend exposes auth-required getMine/updateMine backed by by_user unique", () => {
    expect(backend).toContain("export const getMine = query({");
    expect(backend).toContain("export const updateMine = mutation({");
    expect(backend).toContain("requireAuth(ctx)");
    expect(backend).toContain(".unique()");
  });

  test("Settings loads saved prefs from Convex, not localStorage", () => {
    expect(settings).toContain("api.notificationPreferences.getMine");
    expect(settings).toContain("api.notificationPreferences.updateMine");
    expect(settings).toContain("resolveNotificationPreferences");
  });

  test("Settings gates toggles behind the loaded state", () => {
    // Toggles stay disabled until the server value arrives — no fake defaults
    // flashed before hydration.
    expect(settings).toContain("disabled={!prefsLoaded}");
  });

  test("every notification generator category is gated by user preferences", () => {
    const smartNotifications = read("../convex/smartNotifications.ts");
    // Weather + market cores
    expect(smartNotifications).toContain('"weatherAlerts"');
    expect(smartNotifications).toContain('"marketPrices"');
    // Crop + livestock cores
    expect(smartNotifications).toContain('"cropReminders"');
    expect(smartNotifications).toContain('"livestockAlerts"');

    // Direct insert sites outside the cores
    const weatherAlerts = read("../convex/weatherAlerts.ts");
    expect(weatherAlerts).toContain('"weatherAlerts"');

    const community = read("../convex/community.ts");
    expect(community).toContain('"communityUpdates"');

    const farmCalendar = read("../convex/farmCalendar.ts");
    expect(farmCalendar).toContain('"cropReminders"');

    const farmingEvents = read("../convex/farmingEvents.ts");
    expect(farmingEvents).toContain('"systemUpdates"');

    const livestock = read("../convex/livestock.ts");
    expect(livestock).toContain('"livestockAlerts"');
  });
});
