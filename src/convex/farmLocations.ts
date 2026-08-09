import { query } from "./_generated/server";
import { v } from "convex/values";

// ============================================================
// Internal Queries (no auth — used by cron actions)
// ============================================================

/**
 * Get unique farm locations without auth. Used by the weather cron.
 * Reads farms in pages so this stays efficient as the dataset grows, and
 * stops early once `limit` unique locations have been collected — the cron
 * only refreshes a bounded batch per run (Phase 5 scale hardening).
 */
export const getAllFarmLocations = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const locationMap = new Map<string, { latitude: number; longitude: number }>();

    let cursor: string | null = null;
    let done = false;
    while (!done) {
      const page = await ctx.db.query("farms").paginate({
        numItems: 1000,
        cursor,
      });

      for (const farm of page.page) {
        if (!farm.location) continue;
        const lat = Math.round(farm.location.latitude * 100) / 100;
        const lon = Math.round(farm.location.longitude * 100) / 100;
        const key = `${lat},${lon}`;
        if (!locationMap.has(key)) {
          locationMap.set(key, { latitude: lat, longitude: lon });
        }
      }

      if (args.limit !== undefined && locationMap.size >= args.limit) break;
      cursor = page.continueCursor;
      done = page.isDone;
    }

    return Array.from(locationMap.values());
  },
});

/**
 * Cache expiries for cached weather locations, most-stale first. One
 * weatherData row exists per rounded location (upsertWeather deletes the
 * old row), so the cron can refresh the stalest locations first and skip
 * everything still fresh — without a per-location N+1 query.
 */
export const getWeatherExpiries = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("weatherData")
      .withIndex("by_expires")
      .order("asc")
      .take(args.limit ?? 2000);
    return docs.map((d) => ({
      latitude: d.latitude,
      longitude: d.longitude,
      expiresAt: d.expiresAt,
    }));
  },
});
