import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requireAuth } from "./authHelpers";
import type { Id } from "./_generated/dataModel";

// ============================================================
// Smart Notifications Engine
// Intelligent, prioritized, deduplicated notifications
//
// Architecture note (P0 remediation):
// The generation logic lives in exported *core* functions that
// receive the target user's identity from the caller. The public
// mutations resolve the authenticated user and delegate to the
// cores. The scheduled cron (smartNotificationsCron.ts) calls the
// cores directly with each user's identity — so server-side
// generation works without weakening auth on the public API.
// ============================================================

/** Notification priority levels */
const PRIORITY_WEIGHTS = { critical: 4, high: 3, medium: 2, low: 1 };

/** Cooldown periods per notification type (ms) */
export const NOTIFICATION_COOLDOWNS: Record<string, number> = {
  weather_alert: 6 * 60 * 60 * 1000,       // 6 hours
  drought_warning: 24 * 60 * 60 * 1000,     // 24 hours
  frost_warning: 12 * 60 * 60 * 1000,       // 12 hours
  irrigation_needed: 12 * 60 * 60 * 1000,   // 12 hours
  disease_risk: 24 * 60 * 60 * 1000,        // 24 hours
  pest_outbreak: 24 * 60 * 60 * 1000,       // 24 hours
  vaccination_due: 7 * 24 * 60 * 60 * 1000, // 7 days
  market_opportunity: 48 * 60 * 60 * 1000,  // 48 hours
  crop_milestone: 24 * 60 * 60 * 1000,      // 24 hours
  subscription_warning: 7 * 24 * 60 * 60 * 1000, // 7 days
  livestock_reminder: 24 * 60 * 60 * 1000,  // 24 hours
  farm_task: 12 * 60 * 60 * 1000,           // 12 hours
};

/** Generate a notification dedup key */
function dedupKey(type: string, userId: string, farmId?: string, extra?: string) {
  return `${type}:${userId}:${farmId ?? "global"}:${extra ?? ""}`;
}

/**
 * Build the most-recent timestamp per notification type.
 * Pure helper — testable in isolation.
 */
export function getLastNotificationTimes(
  notifications: Array<{ type: string; createdAt: number }>,
  limit = 50
): Map<string, number> {
  const times = new Map<string, number>();
  for (const n of notifications.slice(0, limit)) {
    const existing = times.get(n.type) ?? 0;
    if (n.createdAt > existing) times.set(n.type, n.createdAt);
  }
  return times;
}

/**
 * Whether a notification of `type` may be emitted given the last
 * emitted timestamp, respecting the per-type cooldown window.
 * Pure helper — testable in isolation.
 */
export function canNotifyAfterCooldown(
  lastTimes: Map<string, number>,
  type: string,
  now: number,
  cooldowns: Record<string, number> = NOTIFICATION_COOLDOWNS
): boolean {
  const lastTime = lastTimes.get(type) ?? 0;
  const cooldown = cooldowns[type] ?? 12 * 60 * 60 * 1000;
  return now - lastTime > cooldown;
}

// ============================================================
// CORE — Weather notifications (server-safe, user-resolved)
// ============================================================

/** Smart notification generation from weather data */
export async function generateWeatherNotificationsCore(
  ctx: MutationCtx,
  input: { userId: Id<"users">; farmId: Id<"farms"> }
): Promise<{ created: number }> {
  const { userId, farmId } = input;
  const farm = await ctx.db.get(farmId);
  if (!farm || farm.userId !== userId) return { created: 0 };

  const now = Date.now();
  const weatherData = await ctx.db
    .query("weatherData")
    .withIndex("by_farm", (q) => q.eq("farmId", farmId))
    .order("desc")
    .first();

  if (!weatherData) return { created: 0 };

  const temp = weatherData.temperature;
  const rain = weatherData.precipitation;
  const windSpeed = weatherData.windSpeed;
  let created = 0;

  // Check cooldowns for recent similar notifications
  // Phase 5: only the most recent notifications matter for cooldown
  // dedup (getLastNotificationTimes reads the first 50 anyway), so the
  // per-user scan is bounded instead of walking the full history.
  const recentNotifications = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(50);

  const recentTypeTimes = getLastNotificationTimes(recentNotifications);
  const canNotify = (type: string) =>
    canNotifyAfterCooldown(recentTypeTimes, type, now);

  // Drought warning
  if (rain < 2 && canNotify("drought_warning")) {
    await ctx.db.insert("notifications", {
      userId,
      title: "Drought Warning",
      message: `Minimal rainfall (${rain}mm) detected for ${farm.name}. Consider increasing irrigation to prevent crop stress.`,
      type: "drought_warning",
      actionUrl: "/irrigation",
      actionLabel: "View Irrigation",
      isRead: false,
      createdAt: now,
    });
    created++;
  }

  // Frost warning
  if (temp < 5 && canNotify("frost_warning")) {
    await ctx.db.insert("notifications", {
      userId,
      title: "Frost Warning",
      message: `Temperature dropping to ${temp}°C near ${farm.name}. Protect sensitive crops from frost damage.`,
      type: "frost_warning",
      actionUrl: "/weather",
      actionLabel: "View Weather",
      isRead: false,
      createdAt: now,
    });
    created++;
  }

  // Heat stress
  if (temp > 38 && canNotify("weather_alert")) {
    await ctx.db.insert("notifications", {
      userId,
      title: "Extreme Heat Alert",
      message: `Temperature reaching ${temp}°C near ${farm.name}. Ensure livestock have shade and water. Consider harvesting heat-sensitive crops early.`,
      type: "weather_alert",
      actionUrl: "/weather",
      actionLabel: "View Weather",
      isRead: false,
      createdAt: now,
    });
    created++;
  }

  // Strong wind
  if (windSpeed > 50 && canNotify("weather_alert")) {
    await ctx.db.insert("notifications", {
      userId,
      title: "Strong Wind Advisory",
      message: `Wind speeds of ${windSpeed}km/h expected near ${farm.name}. Secure structures and protect young plants.`,
      type: "weather_alert",
      actionUrl: "/weather",
      actionLabel: "View Weather",
      isRead: false,
      createdAt: now,
    });
    created++;
  }

  // Heavy rain / flooding
  if (rain > 50 && canNotify("weather_alert")) {
    await ctx.db.insert("notifications", {
      userId,
      title: "Heavy Rain Alert",
      message: `Heavy rainfall (${rain}mm) expected near ${farm.name}. Check drainage and protect harvested crops.`,
      type: "weather_alert",
      actionUrl: "/weather",
      actionLabel: "View Weather",
      isRead: false,
      createdAt: now,
    });
    created++;
  }

  // Irrigation needed based on weather + soil
  if (rain < 5 && temp > 25 && canNotify("irrigation_needed")) {
    const crops = await ctx.db
      .query("crops")
      .withIndex("by_farm", (q) => q.eq("farmId", farmId))
      .collect();

    const activeCrops = crops.filter((c) =>
      c.status !== "harvested" && c.status !== "failed"
    );

    if (activeCrops.length > 0) {
      await ctx.db.insert("notifications", {
        userId,
        title: "Irrigation Recommended",
        message: `${activeCrops.length} active crop(s) on ${farm.name} may need irrigation. Low rainfall and moderate temperatures suggest soil moisture may be depleting.`,
        type: "irrigation_needed",
        actionUrl: "/irrigation",
        actionLabel: "Schedule Irrigation",
        isRead: false,
        createdAt: now,
      });
      created++;
    }
  }

  return { created };
}

/** Public (auth-guarded) weather notification generation */
export const generateWeatherNotifications = mutation({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    return generateWeatherNotificationsCore(ctx, { userId, farmId: args.farmId });
  },
});

// ============================================================
// CORE — Livestock notifications (server-safe, user-resolved)
// ============================================================

/** Generate notifications for livestock health and vaccination reminders */
export async function generateLivestockNotificationsCore(
  ctx: MutationCtx,
  input: { userId: Id<"users">; farmId: Id<"farms"> }
): Promise<{ created: number }> {
  const { userId, farmId } = input;
  const farm = await ctx.db.get(farmId);
  if (!farm || farm.userId !== userId) return { created: 0 };

  const now = Date.now();
  let created = 0;

  // Phase 5: only the most recent notifications matter for cooldown
  // dedup (getLastNotificationTimes reads the first 50 anyway), so the
  // per-user scan is bounded instead of walking the full history.
  const recentNotifications = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(50);

  const recentTypeTimes = getLastNotificationTimes(recentNotifications);
  const canNotify = (type: string) =>
    canNotifyAfterCooldown(recentTypeTimes, type, now);

  const livestock = await ctx.db
    .query("livestock")
    .withIndex("by_farm", (q) => q.eq("farmId", farmId))
    .collect();

  if (livestock.length === 0) return { created: 0 };

  // Check for vaccination reminders
  const sevenDaysFromNow = now + 7 * 24 * 60 * 60 * 1000;
  const needsVaccination = livestock.filter(
    (l) => l.nextVaccination && l.nextVaccination <= sevenDaysFromNow && l.nextVaccination > now
  );

  if (needsVaccination.length > 0 && canNotify("vaccination_due")) {
    await ctx.db.insert("notifications", {
      userId,
      title: "Vaccination Due Soon",
      message: `${needsVaccination.length} animal(s) on ${farm.name} have vaccinations due within 7 days. Schedule a veterinary visit.`,
      type: "vaccination_due",
      actionUrl: "/livestock",
      actionLabel: "View Livestock",
      isRead: false,
      createdAt: now,
    });
    created++;
  }

  // Check for overdue vaccinations (past due)
  const overdueVaccination = livestock.filter(
    (l) => l.nextVaccination && l.nextVaccination < now
  );

  if (overdueVaccination.length > 0 && canNotify("vaccination_due")) {
    await ctx.db.insert("notifications", {
      userId,
      title: "Vaccination Overdue!",
      message: `${overdueVaccination.length} animal(s) on ${farm.name} have overdue vaccinations. This increases disease risk significantly.`,
      type: "vaccination_due",
      actionUrl: "/livestock",
      actionLabel: "View Livestock",
      isRead: false,
      createdAt: now,
    });
    created++;
  }

  // Check for sick animals
  const sickAnimals = livestock.filter((l) => l.status === "sick" || l.status === "quarantine");
  if (sickAnimals.length > 0 && canNotify("livestock_reminder")) {
    await ctx.db.insert("notifications", {
      userId,
      title: "Livestock Health Alert",
      message: `${sickAnimals.length} animal(s) on ${farm.name} are sick or in quarantine. Monitor closely and ensure proper treatment.`,
      type: "livestock_reminder",
      actionUrl: "/livestock",
      actionLabel: "View Livestock",
      isRead: false,
      createdAt: now,
    });
    created++;
  }

  return { created };
}

/** Public (auth-guarded) livestock notification generation */
export const generateLivestockNotifications = mutation({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    return generateLivestockNotificationsCore(ctx, { userId, farmId: args.farmId });
  },
});

// ============================================================
// CORE — Crop notifications (server-safe, user-resolved)
// ============================================================

/** Generate crop-related notifications (growth milestones, disease risk, harvest readiness) */
export async function generateCropNotificationsCore(
  ctx: MutationCtx,
  input: { userId: Id<"users">; farmId: Id<"farms"> }
): Promise<{ created: number }> {
  const { userId, farmId } = input;
  const farm = await ctx.db.get(farmId);
  if (!farm || farm.userId !== userId) return { created: 0 };

  const now = Date.now();
  let created = 0;

  // Phase 5: only the most recent notifications matter for cooldown
  // dedup (getLastNotificationTimes reads the first 50 anyway), so the
  // per-user scan is bounded instead of walking the full history.
  const recentNotifications = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(50);

  const recentTypeTimes = getLastNotificationTimes(recentNotifications);
  const canNotify = (type: string) =>
    canNotifyAfterCooldown(recentTypeTimes, type, now);

  const crops = await ctx.db
    .query("crops")
    .withIndex("by_farm", (q) => q.eq("farmId", farmId))
    .collect();

  if (crops.length === 0) return { created: 0 };

  // Harvest-ready notifications
  const readyToHarvest = crops.filter((c) => c.status === "harvest_ready");
  if (readyToHarvest.length > 0 && canNotify("crop_milestone")) {
    const cropNames = readyToHarvest.map((c) => c.name).slice(0, 3).join(", ");
    const extra = readyToHarvest.length > 3 ? ` and ${readyToHarvest.length - 3} more` : "";
    await ctx.db.insert("notifications", {
      userId,
      title: "Crops Ready for Harvest",
      message: `${cropNames}${extra} on ${farm.name} are ready for harvest. Plan harvesting logistics to maximize yield.`,
      type: "crop_milestone",
      actionUrl: "/crops",
      actionLabel: "View Crops",
      isRead: false,
      createdAt: now,
    });
    created++;
  }

  // Low health score alerts
  const unhealthyCrops = crops.filter(
    (c) => c.healthScore !== undefined && c.healthScore < 50 && c.status !== "harvested" && c.status !== "failed"
  );

  if (unhealthyCrops.length > 0 && canNotify("disease_risk")) {
    const cropNames = unhealthyCrops.map((c) => c.name).slice(0, 3).join(", ");
    await ctx.db.insert("notifications", {
      userId,
      title: "Crop Health Concern",
      message: `${cropNames} on ${farm.name} have low health scores. Check for disease, pests, or nutrient deficiency.`,
      type: "disease_risk",
      actionUrl: "/crops",
      actionLabel: "View Crops",
      isRead: false,
      createdAt: now,
    });
    created++;
  }

  // Planting season reminders (crops approaching expected harvest)
  const approachingHarvest = crops.filter((c) => {
    if (!c.expectedHarvestDate || c.status === "harvested" || c.status === "failed") return false;
    const daysUntil = (c.expectedHarvestDate - now) / (24 * 60 * 60 * 1000);
    return daysUntil > 0 && daysUntil <= 14;
  });

  if (approachingHarvest.length > 0 && canNotify("crop_milestone")) {
    const cropNames = approachingHarvest.map((c) => c.name).slice(0, 3).join(", ");
    await ctx.db.insert("notifications", {
      userId,
      title: "Harvest Approaching",
      message: `${cropNames} on ${farm.name} will reach expected harvest within 2 weeks. Prepare storage and market channels.`,
      type: "crop_milestone",
      actionUrl: "/crops",
      actionLabel: "View Crops",
      isRead: false,
      createdAt: now,
    });
    created++;
  }

  return { created };
}

/** Public (auth-guarded) crop notification generation */
export const generateCropNotifications = mutation({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    return generateCropNotificationsCore(ctx, { userId, farmId: args.farmId });
  },
});

// ============================================================
// CORE — Market notifications (server-safe, user-resolved)
// ============================================================

/** Generate market intelligence notifications */
export async function generateMarketNotificationsCore(
  ctx: MutationCtx,
  input: { userId: Id<"users"> }
): Promise<{ created: number }> {
  const { userId } = input;
  const now = Date.now();
  let created = 0;

  // Phase 5: only the most recent notifications matter for cooldown
  // dedup (getLastNotificationTimes reads the first 50 anyway), so the
  // per-user scan is bounded instead of walking the full history.
  const recentNotifications = await ctx.db
    .query("notifications")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .order("desc")
    .take(50);

  const recentTypeTimes = getLastNotificationTimes(recentNotifications);
  const canNotify = (type: string) =>
    canNotifyAfterCooldown(recentTypeTimes, type, now);

  // Get user's crop types from their farms
  const farms = await ctx.db
    .query("farms")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  const userCropTypes = new Set<string>();
  for (const farm of farms) {
    const crops = await ctx.db
      .query("crops")
      .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
      .collect();
    crops.forEach((c) => userCropTypes.add(c.name.toLowerCase()));
  }

  if (userCropTypes.size === 0) return { created: 0 };

  // Check market insights for relevant crops
  // Phase 5: bound the global market-insight scan. The insights table is
  // keyed per cropType×region and is refreshed on a schedule, so the
  // newest 200 rows always represent the full market surface. This stops
  // the cron from re-reading the entire table for every user.
  const marketInsights = await ctx.db
    .query("marketInsights")
    .withIndex("by_fetched", (q) => q.gte("fetchedAt", now - 7 * 24 * 60 * 60 * 1000))
    .take(200);

  for (const insight of marketInsights) {
    if (userCropTypes.has(insight.cropType.toLowerCase())) {
      // Significant price increase
      if (insight.trend === "up" && insight.changePercent > 15 && canNotify("market_opportunity")) {
        await ctx.db.insert("notifications", {
          userId,
          title: "Market Opportunity",
          message: `${insight.cropType} prices are up ${insight.changePercent.toFixed(1)}% in your region. Consider selling now for better returns.`,
          type: "market_opportunity",
          actionUrl: "/finances",
          actionLabel: "View Market Prices",
          isRead: false,
          createdAt: now,
        });
        created++;
        break; // One market notification per run
      }

      // Significant price decrease
      if (insight.trend === "down" && insight.changePercent > 15 && canNotify("market_opportunity")) {
        await ctx.db.insert("notifications", {
          userId,
          title: "Market Price Alert",
          message: `${insight.cropType} prices dropped ${insight.changePercent.toFixed(1)}%. Consider holding stock or diversifying sales channels.`,
          type: "market_opportunity",
          actionUrl: "/finances",
          actionLabel: "View Market Prices",
          isRead: false,
          createdAt: now,
        });
        created++;
        break;
      }
    }
  }

  return { created };
}

/** Public (auth-guarded) market notification generation */
export const generateMarketNotifications = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    return generateMarketNotificationsCore(ctx, { userId });
  },
});

// ============================================================
// Run all generators for a farm (public, auth-guarded)
// ============================================================

/** Run all smart notification generators for a farm */
export const runAllNotifications = mutation({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return { total: 0 };

    let total = 0;

    const weatherResult = await generateWeatherNotificationsCore(ctx, { userId, farmId: args.farmId });
    total += weatherResult.created;

    const livestockResult = await generateLivestockNotificationsCore(ctx, { userId, farmId: args.farmId });
    total += livestockResult.created;

    const cropResult = await generateCropNotificationsCore(ctx, { userId, farmId: args.farmId });
    total += cropResult.created;

    const marketResult = await generateMarketNotificationsCore(ctx, { userId });
    total += marketResult.created;

    return { total };
  },
});

// ============================================================
// Notification queries + mark-read (unchanged behavior)
// ============================================================

/** Get prioritized notifications for a user */
export const getPrioritizedNotifications = query({
  args: {
    limit: v.optional(v.number()),
    unreadOnly: v.optional(v.boolean()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    let q = ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId));

    let notifications = await q.order("desc").collect();

    // Filter by read status
    if (args.unreadOnly) {
      notifications = notifications.filter((n) => !n.isRead);
    }

    // Filter by type
    if (args.type) {
      notifications = notifications.filter((n) => n.type === args.type);
    }

    // Sort by priority (severity of notification type)
    const priorityMap: Record<string, number> = {
      drought_warning: 5,
      frost_warning: 5,
      weather_alert: 4,
      disease_risk: 4,
      vaccination_due: 3,
      livestock_reminder: 3,
      irrigation_needed: 3,
      market_opportunity: 2,
      crop_milestone: 2,
      farm_task: 2,
      subscription_warning: 1,
      system: 0,
    };

    notifications.sort((a, b) => {
      const pa = priorityMap[a.type] ?? 0;
      const pb = priorityMap[b.type] ?? 0;
      if (pa !== pb) return pb - pa;
      return b.createdAt - a.createdAt;
    });

    return notifications.slice(0, args.limit ?? 50);
  },
});

/** Get notification summary counts */
export const getNotificationSummary = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    const last24h = now - 24 * 60 * 60 * 1000;
    const last7d = now - 7 * 24 * 60 * 60 * 1000;

    const unread = notifications.filter((n) => !n.isRead);
    const recent = notifications.filter((n) => n.createdAt > last24h);
    const weekly = notifications.filter((n) => n.createdAt > last7d);

    // Count by type
    const byType: Record<string, number> = {};
    for (const n of unread) {
      byType[n.type] = (byType[n.type] ?? 0) + 1;
    }

    // Count critical unread
    const criticalTypes = ["drought_warning", "frost_warning", "weather_alert", "disease_risk"];
    const critical = unread.filter((n) => criticalTypes.includes(n.type)).length;

    return {
      total: notifications.length,
      unread: unread.length,
      recent: recent.length,
      weekly: weekly.length,
      critical,
      byType,
    };
  },
});

/** Mark notifications as read */
export const markNotificationsRead = mutation({
  args: {
    notificationIds: v.optional(v.array(v.id("notifications"))),
    markAll: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    if (args.markAll) {
      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      const unread = notifications.filter((n) => !n.isRead);
      for (const n of unread) {
        await ctx.db.patch(n._id, { isRead: true });
      }
      return { marked: unread.length };
    }

    if (args.notificationIds) {
      let marked = 0;
      for (const id of args.notificationIds) {
        // Only mark notifications owned by the current user
        const notification = await ctx.db.get(id);
        if (notification && notification.userId === userId && !notification.isRead) {
          await ctx.db.patch(id, { isRead: true });
          marked++;
        }
      }
      return { marked };
    }

    return { marked: 0 };
  },
});
