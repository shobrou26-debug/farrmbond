import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  cronBatchArgs,
  CRON_BATCH_SIZE,
  runCronBatch,
  pageUsers,
  type CronBatchResult,
} from "./cronBatch";
import { isNotificationCategoryEnabled } from "./notificationPreferences";
import { createAuditLog } from "./authHelpers";
import {
  computeDigestWindow,
  selectUpcomingEvents,
  selectRecentNotifications,
  summarizeDigestFinances,
  buildDigestEmailModel,
  renderDigestEmail,
} from "../lib/emailDigest";

// ============================================================
// Weekly email digest — batched cron
//
// Every 7 days, users with Settings → Notifications → Weekly Digest
// enabled receive an email summarizing their real farm data: upcoming
// calendar events (next 7 days), finances (last 7 days, per currency,
// never merged), and recent notifications (last 7 days).
//
// Batched via runCronBatch (CRON_BATCH_SIZE users per invocation,
// cursor-chained, lease-protected) so it scales to 200k+ users.
// Dedup via the auditLogs by_user_action index: a user is emailed at
// most once per 7 days even if the chain is retried.
//
// Data honesty: every section is built only from rows that actually
// exist; an empty digest is skipped, never sent as a placeholder.
// ============================================================

/** Same-tick dedup window — one digest per user per 7 days. */
export const DIGEST_DEDUP_MS = 7 * 24 * 60 * 60 * 1000;

export const sendWeeklyDigests = internalMutation({
  args: cronBatchArgs,
  handler: async (ctx, args): Promise<CronBatchResult> => {
    const now = Date.now();
    const window = computeDigestWindow(now);
    let digestsScheduled = 0;

    return runCronBatch(
      ctx,
      args.cursor,
      CRON_BATCH_SIZE,
      pageUsers,
      async (ctx, user) => {
        // Email needs an address; anonymous users have none. (An
        // explicit check keeps the type honest without a cast.)
        const email = user.email;
        if (!email) return;

        // Respect the user's Settings → Notifications "Weekly Digest"
        // choice (persisted via notificationPreferences).
        if (!(await isNotificationCategoryEnabled(ctx, user._id, "emailDigest"))) {
          return;
        }

        // Skip suspended accounts — they should not receive email.
        if (user.isSuspended) return;

        // Weekly dedup via the by_user_action audit index (same
        // mechanism as subscription warnings / payment reminders).
        const lastDigest = await ctx.db
          .query("auditLogs")
          .withIndex("by_user_action", (q) =>
            q.eq("userId", user._id).eq("action", "weekly_digest_sent")
          )
          .order("desc")
          .first();
        if (lastDigest && lastDigest.createdAt > now - DIGEST_DEDUP_MS) {
          return;
        }

        // --- Upcoming calendar events (next 7 days) ---
        const calendarEvents = await ctx.db
          .query("farmCalendar")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
        const farmNameCache = new Map<string, string | undefined>();
        const upcomingEvents = selectUpcomingEvents(
          await Promise.all(
            calendarEvents.map(async (e) => {
              let farmName: string | undefined;
              if (e.farmId) {
                if (farmNameCache.has(e.farmId)) {
                  farmName = farmNameCache.get(e.farmId);
                } else {
                  const farm = await ctx.db.get(e.farmId);
                  farmName = farm?.name;
                  farmNameCache.set(e.farmId, farmName);
                }
              }
              return {
                title: e.title,
                eventType: e.eventType,
                startDate: e.startDate,
                farmName,
              };
            })
          ),
          window
        );

        // --- Recent notifications (last 7 days) ---
        const recentNotifications = selectRecentNotifications(
          await ctx.db
            .query("notifications")
            .withIndex("by_user", (q) => q.eq("userId", user._id))
            .collect(),
          window
        );

        // --- Finances (last 7 days, per currency) ---
        const userTransactions = await ctx.db
          .query("transactions")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
        const finances = summarizeDigestFinances(
          userTransactions.map((tx) => ({
            type: tx.type,
            amount: tx.amount,
            currency: tx.currency,
            date: tx.date,
          })),
          window
        );

        const model = buildDigestEmailModel({
          farmerName: user.name ?? undefined,
          now,
          events: upcomingEvents,
          notifications: recentNotifications,
          finances,
          dashboardUrl: `${process.env.APP_URL ?? "https://farmbond.com"}/dashboard`,
          manageUrl: `${process.env.APP_URL ?? "https://farmbond.com"}/settings?tab=notifications`,
        });

        // Data honesty: never email an empty digest.
        if (!model.hasContent) return;

        const { subject, html } = renderDigestEmail(model);

        // Transport runs in an action (Brevo fetch); the mutation
        // schedules it — mirrors the subscription warning pattern.
        await ctx.scheduler.runAfter(0, internal.emails.sendWeeklyDigest, {
          userId: user._id,
          email,
          name: user.name ?? "there",
          subject,
          html,
        });

        await createAuditLog(ctx, {
          userId: user._id,
          action: "weekly_digest_sent",
          resource: "users",
          resourceId: user._id,
          changes: {
            weekStart: now,
            eventsIncluded: upcomingEvents.length,
            notificationsIncluded: recentNotifications.length,
            currencies: Object.keys(finances),
          },
        });

        digestsScheduled++;
      },
      (ctx, cursor) =>
        ctx.scheduler.runAfter(0, internal.weeklyDigest.sendWeeklyDigests, {
          cursor,
        }),
      "sendWeeklyDigests",
      // Chain TTL generous enough to cover a full user sweep at scale.
      { jobName: "weekly_digest", ttlMs: 12 * 60 * 60 * 1000 }
    );
  },
});
