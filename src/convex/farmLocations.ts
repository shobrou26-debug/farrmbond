import { query } from "./_generated/server";

// ============================================================
// Internal Queries (no auth — used by cron actions)
// ============================================================

/**
 * Get all unique farm locations without auth. Used by weather cron.
 * Farms are read in pages so this stays efficient as the dataset grows
 * toward 10k+ farms (deduplication happens in memory per page batch).
 */
export const getAllFarmLocations = query({
  args: {},
  handler: async (ctx) => {
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

      cursor = page.continueCursor;
      done = page.isDone;
    }

    return Array.from(locationMap.values());
  },
});
