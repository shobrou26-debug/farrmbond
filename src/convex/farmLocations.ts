import { query } from "./_generated/server";

// ============================================================
// Internal Queries (no auth — used by cron actions)
// ============================================================

/** Get all unique farm locations without auth. Used by weather cron. */
export const getAllFarmLocations = query({
  args: {},
  handler: async (ctx) => {
    const farms = await ctx.db.query("farms").collect();

    const locationMap = new Map<string, { latitude: number; longitude: number }>();
    for (const farm of farms) {
      const lat = Math.round(farm.location.latitude * 100) / 100;
      const lon = Math.round(farm.location.longitude * 100) / 100;
      const key = `${lat},${lon}`;
      if (!locationMap.has(key)) {
        locationMap.set(key, { latitude: lat, longitude: lon });
      }
    }

    return Array.from(locationMap.values());
  },
});
