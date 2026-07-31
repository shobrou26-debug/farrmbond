import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { requireAuth } from "./authHelpers";

// ============================================================
// Smart Notifications Engine
// Intelligent notification system with prioritization and deduplication
// ============================================================

// Priority levels: critical=4, high=3, medium=2, low=1
const PRIORITY_ORDER: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Generate smart notifications from all intelligence sources */
export const generateSmartNotifications = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const now = Date.now();

    // Get user's farms
    const farms = await ctx.db
      .query("farms")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (farms.length === 0) return { generated: 0, skipped: 0 };

    const notifications: Array<{
      title: string;
      message: string;
      type: string;
      priority: string;
      actionUrl?: string;
      actionLabel?: string;
    }> = [];

    for (const farm of farms) {
      // 1. Weather Alerts
      const weatherData = await ctx.db
        .query("weatherData")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .order("desc")
        .first();

      if (weatherData?.alerts && weatherData.alerts.length > 0) {
        for (const alert of weatherData.alerts) {
          if (alert.severity === "high" || alert.severity === "critical") {
            notifications.push({
              title: `⚠️ Weather Alert: ${alert.type}`,
              message: alert.message,
              type: "weather_alert",
              priority: alert.severity === "critical" ? "critical" : "high",
              actionUrl: "/weather",
              actionLabel: "View Weather",
            });
          }
        }
      }

      // 2. Crop Health Alerts
      const crops = await ctx.db
        .query("crops")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .collect();

      const unhealthyCrops = crops.filter((c) => (c.healthScore ?? 100) < 50);
      if (unhealthyCrops.length > 0) {
        notifications.push({
          title: `🌱 Crop Health Warning: ${unhealthyCrops.length} crop(s) need attention`,
          message: `${unhealthyCrops.map((c) => c.name).join(", ")} have low health scores. Immediate action recommended.`,
          type: "crop_health",
          priority: unhealthyCrops.some((c) => (c.healthScore ?? 100) < 30) ? "critical" : "high",
          actionUrl: "/crops",
          actionLabel: "View Crops",
        });
      }

      // 3. Satellite Stress Detection
      const satelliteData = await ctx.db
        .query("satelliteData")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .order("desc")
        .first();

      if (satelliteData && satelliteData.ndvi !== undefined && satelliteData.ndvi < 0.3) {
        notifications.push({
          title: `🛰️ Satellite Alert: Vegetation stress detected on ${farm.name}`,
          message: `NDVI dropped to ${(satelliteData.ndvi * 100).toFixed(0)}%. Possible drought stress, pest infestation, or nutrient deficiency.`,
          type: "satellite_alert",
          priority: "high",
          actionUrl: `/farms?farm=${farm._id}`,
          actionLabel: "View Farm",
        });
      }

      // 4. Livestock Vaccination Reminders
      const livestock = await ctx.db
        .query("livestock")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .collect();

      for (const animal of livestock) {
        if (animal.nextVaccination && animal.nextVaccination <= now + 7 * 24 * 60 * 60 * 1000) {
          const daysUntil = Math.ceil((animal.nextVaccination - now) / (24 * 60 * 60 * 1000));
          notifications.push({
            title: `💉 Vaccination Due: ${animal.name}`,
            message: `${animal.name} (${animal.type}) vaccination is due in ${daysUntil} day(s). Schedule now to prevent disease.`,
            type: "vaccination_reminder",
            priority: daysUntil <= 2 ? "high" : "medium",
            actionUrl: "/livestock",
            actionLabel: "View Livestock",
          });
        }
      }

      // 5. Low Vaccination Coverage
      const vaccinatedLivestock = livestock.filter(
        (l) => l.lastVaccination && l.lastVaccination > now - 90 * 24 * 60 * 60 * 1000
      );
      if (livestock.length > 0) {
        const coverageRate = (vaccinatedLivestock.length / livestock.length) * 100;
        if (coverageRate < 50) {
          notifications.push({
            title: `🛡️ Low Vaccination Coverage: ${coverageRate.toFixed(0)}%`,
            message: `Only ${coverageRate.toFixed(0)}% of your livestock were vaccinated in the last 90 days. Schedule catch-up vaccinations.`,
            type: "vaccination_alert",
            priority: "high",
            actionUrl: "/livestock?tab=coverage",
            actionLabel: "View Coverage",
          });
        }
      }

      // 6. Irrigation Needs (based on weather)
      if (weatherData) {
        const rain = weatherData.precipitation ?? 0;
        const humidity = weatherData.humidity ?? 50;
        const temp = weatherData.temperature ?? 25;

        if (rain < 2 && humidity < 40 && temp > 30) {
          notifications.push({
            title: `💧 Irrigation Needed: ${farm.name}`,
            message: `No rain expected, low humidity (${humidity}%), and high temperature (${temp}°C). Crops may need irrigation.`,
            type: "irrigation_needed",
            priority: "medium",
            actionUrl: "/irrigation",
            actionLabel: "Schedule Irrigation",
          });
        }
      }

      // 7. Market Price Opportunities
      const userCrops = [...new Set(crops.map((c) => c.name.toLowerCase()))];
      for (const cropName of userCrops.slice(0, 5)) {
        const marketData = await ctx.db
          .query("marketPrices")
          .withIndex("by_crop", (q) => q.eq("cropType", cropName))
          .order("desc")
          .first();

        if (marketData && marketData.trend === "up" && (marketData.changePercent ?? 0) > 10) {
          notifications.push({
            title: `📈 Price Surge: ${cropName}`,
            message: `${cropName} prices up ${marketData.changePercent?.toFixed(1)}% this week. Consider selling now for maximum profit.`,
            type: "market_alert",
            priority: "medium",
            actionUrl: "/finances",
            actionLabel: "View Market Prices",
          });
        }
      }

      // 8. Soil Issues
      const soilData = await ctx.db
        .query("soilData")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .order("desc")
        .first();

      if (soilData && soilData.recommendations && soilData.recommendations.length > 0) {
        const criticalIssues = soilData.recommendations.filter((r) => r.priority === "high");
        if (criticalIssues.length > 0) {
          notifications.push({
            title: `🌍 Soil Alert: ${farm.name}`,
            message: `${criticalIssues.length} critical soil issue(s) detected: ${criticalIssues[0].issue}. Action: ${criticalIssues[0].action}`,
            type: "soil_alert",
            priority: "high",
            actionUrl: `/farms?farm=${farm._id}`,
            actionLabel: "View Farm",
          });
        }
      }
    }

    // 9. Subscription Expiry Warning
    const user = await ctx.db.get(userId);
    if (user?.trialEndDate && user.trialEndDate <= now + 2 * 24 * 60 * 60 * 1000) {
      const daysLeft = Math.ceil((user.trialEndDate - now) / (24 * 60 * 60 * 1000));
      notifications.push({
        title: `⏰ Trial Expiring Soon`,
        message: `Your free trial expires in ${daysLeft} day(s). Upgrade to Pro to keep all features.`,
        type: "subscription",
        priority: "high",
        actionUrl: "/settings",
        actionLabel: "Upgrade Now",
      });
    }

    // Deduplication: Check recent notifications to avoid duplicates
    const recentNotifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect().then((r: any[]) => r.slice(0, 50));

    const recentTitles = new Set(recentNotifications.map((n: any) => n.title));
    const recentTimestamps = new Map(
      recentNotifications.map((n: any) => [n.title, n.createdAt])
    );

    const DEDUP_HOURS: Record<string, number> = {
      weather_alert: 4,
      crop_health: 24,
      satellite_alert: 12,
      vaccination_reminder: 48,
      vaccination_alert: 24,
      irrigation_needed: 8,
      market_alert: 24,
      soil_alert: 48,
      subscription: 24,
    };

    let generated = 0;
    let skipped = 0;

    // Sort by priority (highest first)
    notifications.sort(
      (a, b) => (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0)
    );

    // Limit to top 10 most important notifications per run
    const limited = notifications.slice(0, 10);

    for (const notif of limited) {
      // Check deduplication
      if (recentTitles.has(notif.title)) {
        const lastCreated = recentTimestamps.get(notif.title) ?? 0;
        const dedupWindow = (DEDUP_HOURS[notif.type] ?? 24) * 60 * 60 * 1000;
        if (now - (lastCreated as number) < dedupWindow) {
          skipped++;
          continue;
        }
      }

      await ctx.db.insert("notifications", {
        userId,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        actionUrl: notif.actionUrl,
        actionLabel: notif.actionLabel,
        isRead: false,
        createdAt: now,
      });
      generated++;
    }

    return { generated, skipped, total: notifications.length };
  },
});

/** Get user's smart notifications with unread count */
export const getSmartNotifications = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect().then((r: any[]) => r.slice(0, 100));

    const unreadCount = notifications.filter((n: any) => !n.isRead).length;

    // Group by type
    const grouped: Record<string, typeof notifications> = {};
    for (const notif of notifications) {
      if (!grouped[notif.type]) grouped[notif.type] = [];
      grouped[notif.type].push(notif);
    }

    return {
      notifications,
      unreadCount,
      grouped,
      totalCount: notifications.length,
    };
  },
});

/** Mark notification as read */
export const markNotificationRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const notif = await ctx.db.get(args.notificationId);
    if (!notif || notif.userId !== userId) return false;

    await ctx.db.patch(args.notificationId, { isRead: true });
    return true;
  },
});

/** Mark all notifications as read */
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const unread = notifications.filter((n: any) => !n.isRead);
    for (const notif of unread) {
      await ctx.db.patch(notif._id, { isRead: true });
    }

    return { marked: unread.length };
  },
});
