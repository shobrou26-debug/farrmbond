import { mutation, internalMutation } from "./_generated/server";
import {
  generateWeatherNotificationsCore,
  generateLivestockNotificationsCore,
  generateCropNotificationsCore,
  generateMarketNotificationsCore,
} from "./smartNotifications";
import { internal } from "./_generated/api";
import {
  cronBatchArgs,
  acquireCronLease,
  refreshCronLease,
  releaseCronLease,
} from "./cronBatch";

// ============================================================
// Smart Notifications Cron
//
// P0 remediation: this cron previously string-ran auth-guarded
// public mutations ("smartNotifications:generate*") which call
// requireAuth() — a cron has no authenticated user, so every call
// threw and the errors were swallowed. It silently did nothing.
//
// Now the cron calls the server-safe core generators directly with
// each user's identity. Failures are logged and counted instead of
// silently swallowed. Users and farms are iterated in pages so the
// job scales beyond small datasets.
// ============================================================

const PAGE_SIZE = 100;

/**
 * Run smart notifications for ALL farms across ALL users.
 * Batched cron: each invocation processes ONE page of users and schedules
 * the next batch when more users remain. Farm-scoped generators stay
 * bounded per user (a user's farm list is small and page-limited).
 */
export const runAllNotificationsForAllFarms = internalMutation({
  args: cronBatchArgs,
  handler: async (ctx, args) => {
    // Overlap protection: 2-hour cron whose chain can outlive its interval
    // at 200k users. Chain-start claims the lease (exits when another chain
    // is live); continuations refresh it; the end of the chain releases it.
    const lease = { jobName: "smart_notifications", ttlMs: 6 * 60 * 60 * 1000 };
    if (args.cursor === null) {
      const acquired = await acquireCronLease(ctx, lease.jobName, lease.ttlMs);
      if (!acquired) {
        return { totalCreated: 0, failures: 0, usersProcessed: 0, isDone: true, scheduledNext: false };
      }
    } else {
      await refreshCronLease(ctx, lease.jobName, lease.ttlMs);
    }

    const now = Date.now();
    let totalCreated = 0;
    let failures = 0;
    let usersProcessed = 0;

    // One user page per invocation (chained via scheduler until done)
    const page = await ctx.db.query("users").paginate({
      numItems: PAGE_SIZE,
      cursor: args.cursor,
    });
    const users = page.page;

    for (const user of users) {
      // Skip users with no email (guest accounts)
      if (!user.email) continue;
      usersProcessed++;
      const userId = user._id;

      // Market notifications run once per user (no farm needed)
      try {
        const marketResult = await generateMarketNotificationsCore(ctx, { userId });
        totalCreated += marketResult.created;
      } catch (error) {
        failures++;
        console.error(`[SmartNotificationsCron] market notifications failed for user ${userId}:`, error);
      }

      // Farm-scoped generators (weather / livestock / crop)
      let farmCursor: string | null = null;
      let farmsDone = false;
      while (!farmsDone) {
        const farmPage = await ctx.db
          .query("farms")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .paginate({ numItems: PAGE_SIZE, cursor: farmCursor });
        const farms = farmPage.page;

        for (const farm of farms) {
          try {
            const weatherResult = await generateWeatherNotificationsCore(ctx, { userId, farmId: farm._id });
            totalCreated += weatherResult.created;
          } catch (error) {
            failures++;
            console.error(`[SmartNotificationsCron] weather notifications failed for user ${userId} farm ${farm._id}:`, error);
          }

          try {
            const livestockResult = await generateLivestockNotificationsCore(ctx, { userId, farmId: farm._id });
            totalCreated += livestockResult.created;
          } catch (error) {
            failures++;
            console.error(`[SmartNotificationsCron] livestock notifications failed for user ${userId} farm ${farm._id}:`, error);
          }

          try {
            const cropResult = await generateCropNotificationsCore(ctx, { userId, farmId: farm._id });
            totalCreated += cropResult.created;
          } catch (error) {
            failures++;
            console.error(`[SmartNotificationsCron] crop notifications failed for user ${userId} farm ${farm._id}:`, error);
          }
        }

        farmCursor = farmPage.continueCursor;
        farmsDone = farmPage.isDone;
      }
    }

    // Chain the next user page unless done or everything in this page failed
    const allFailed = users.length > 0 && totalCreated === 0 && failures >= users.length;
    const scheduledNext = !page.isDone && users.length > 0 && !allFailed;
    if (scheduledNext) {
      await ctx.scheduler.runAfter(0, internal.smartNotificationsCron.runAllNotificationsForAllFarms, {
        cursor: page.continueCursor,
      });
    } else {
      await releaseCronLease(ctx, lease.jobName);
    }

    console.log(
      `[SmartNotificationsCron] Batch: ${totalCreated} notifications, ${failures} failures, ${usersProcessed} users, done=${page.isDone}`
    );
    return { totalCreated, failures, usersProcessed, isDone: page.isDone, scheduledNext };
  },
});

/** Get all notifications for current user (for the My Consultations page etc.) */
export const listUserNotifications = mutation({
  args: {},
  handler: async (ctx) => {
    const { requireAuth } = await import("./authHelpers");
    const { userId } = await requireAuth(ctx);

    return await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(100);
  },
});
