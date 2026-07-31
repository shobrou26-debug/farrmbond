import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth } from "./authHelpers";

/**
 * Run smart notifications for ALL farms across ALL users.
 * Called by the cron job every 2 hours.
 * Iterates over all farms and triggers notification generation for each.
 */
export const runAllNotificationsForAllFarms = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let totalCreated = 0;

    // Get all users
    const users = await ctx.db.query("users").collect();

    for (const user of users) {
      // Skip users with no email (guest accounts)
      if (!user.email) continue;

      // Get user's farms
      const farms = await ctx.db
        .query("farms")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect();

      for (const farm of farms) {
        // Run weather notifications
        try {
          const weatherResult = await ctx.runMutation(
            "smartNotifications:generateWeatherNotifications" as any,
            { farmId: farm._id }
          );
          totalCreated += weatherResult?.created ?? 0;
        } catch {
          // Skip if mutation fails (e.g., auth issues in cron context)
        }

        // Run livestock notifications
        try {
          const livestockResult = await ctx.runMutation(
            "smartNotifications:generateLivestockNotifications" as any,
            { farmId: farm._id }
          );
          totalCreated += livestockResult?.created ?? 0;
        } catch {
          // Skip
        }

        // Run crop notifications
        try {
          const cropResult = await ctx.runMutation(
            "smartNotifications:generateCropNotifications" as any,
            { farmId: farm._id }
          );
          totalCreated += cropResult?.created ?? 0;
        } catch {
          // Skip
        }
      }

      // Run market notifications per user (no farmId needed)
      try {
        const marketResult = await ctx.runMutation(
          "smartNotifications:generateMarketNotifications" as any,
          {}
        );
        totalCreated += marketResult?.created ?? 0;
      } catch {
        // Skip
      }
    }

    return { totalCreated, usersProcessed: users.length };
  },
});

/** Get all notifications for current user (for the My Consultations page etc.) */
export const listUserNotifications = query({
  args: {
    limit: v.optional(v.number()),
    unreadOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    let q = ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc");

    let notifications = await q.collect();

    if (args.unreadOnly) {
      notifications = notifications.filter((n) => !n.isRead);
    }

    return notifications.slice(0, args.limit ?? 50);
  },
});
