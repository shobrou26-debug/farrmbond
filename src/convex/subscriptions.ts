import { query, mutation, internalMutation } from "./_generated/server";
import { requireAuth, createAuditLog } from "./authHelpers";
import { internal } from "./_generated/api";
import {
  CRON_BATCH_SIZE,
  cronBatchArgs,
  runCronBatch,
  pageUsers,
  type CronBatchResult,
} from "./cronBatch";

// ============================================================
// Subscription Management
// Paid subscription expiry warnings and lifecycle
// ============================================================

const SUBSCRIPTION_WARNING_DAYS = 3; // Send warning 3 days before expiry
const SUBSCRIPTION_URGENT_DAYS = 1; // Urgent warning 1 day before expiry

// Phase 5 batch sizing: the pure downgrade job is one patch + one audit
// row per user (no external calls) and pages in larger chunks; the
// warning/reminder jobs do an indexed dedup lookup + a scheduled email
// per user and stay at the default 200.
const EXPIRE_SUBSCRIPTIONS_BATCH = 500;

/**
 * Get the current user's subscription status
 */
export const getSubscriptionStatus = query({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireAuth(ctx);

    const now = Date.now();
    const tier = user.subscriptionTier || "free";
    const subscriptionEnd = user.subscriptionEndDate;
    const isPaid = tier === "pro";
    const isActive = isPaid && subscriptionEnd !== undefined && subscriptionEnd > now;
    
    let daysUntilRenewal = 0;
    let isExpiringSoon = false;
    let isUrgent = false;
    
    if (isActive && subscriptionEnd) {
      daysUntilRenewal = Math.ceil((subscriptionEnd - now) / (24 * 60 * 60 * 1000));
      isExpiringSoon = daysUntilRenewal <= SUBSCRIPTION_WARNING_DAYS;
      isUrgent = daysUntilRenewal <= SUBSCRIPTION_URGENT_DAYS;
    }

    return {
      tier,
      subscriptionStartDate: user.subscriptionStartDate,
      subscriptionEndDate: subscriptionEnd,
      isPaid,
      isActive,
      daysUntilRenewal,
      isExpiringSoon,
      isUrgent,
    };
  },
});

/**
 * Get subscription expiry statistics for admin dashboard
 */
export const getSubscriptionStats = query({
  args: {},
  handler: async (ctx) => {
    const { requireAdmin } = await import("./authHelpers");
    await requireAdmin(ctx);

    const now = Date.now();
    const users = await ctx.db.query("users").collect();

    let activePaid = 0;
    let expiringSoon = 0;
    let expired = 0;
    let free = 0;

    for (const user of users) {
      if (user.subscriptionTier === "pro" && user.subscriptionEndDate) {
        if (user.subscriptionEndDate > now) {
          activePaid++;
          const daysUntil = Math.ceil((user.subscriptionEndDate - now) / (24 * 60 * 60 * 1000));
          if (daysUntil <= SUBSCRIPTION_WARNING_DAYS) {
            expiringSoon++;
          }
        } else {
          expired++;
        }
      } else {
        free++;
      }
    }

    return {
      activePaid,
      expiringSoon,
      expired,
      free,
      total: users.length,
      mrr: activePaid * 5, // $5/month per pro user
    };
  },
});

/**
 * Send subscription expiry warning emails to users whose paid subscriptions end soon.
 * Batched cron: each invocation processes at most CRON_BATCH_SIZE users and schedules
 * the next batch when more remain. Audit-log dedup prevents duplicate warnings within
 * 24h even if a batch is retried.
 */
export const sendSubscriptionExpiryWarnings = internalMutation({
  args: cronBatchArgs,
  handler: async (ctx, args): Promise<CronBatchResult> => {
    const now = Date.now();
    let emailsSent = 0;
    let emailsSkipped = 0;

    return runCronBatch(
      ctx,
      args.cursor,
      CRON_BATCH_SIZE,
      pageUsers,
      async (ctx, user) => {
        // Skip users without paid subscriptions or without email
        if (!user.subscriptionEndDate || !user.email || user.subscriptionTier !== "pro") {
          return;
        }

        const subEnd = user.subscriptionEndDate;
        const daysRemaining = Math.ceil((subEnd - now) / (24 * 60 * 60 * 1000));

        // Skip if subscription has already expired (handled by expireSubscriptions)
        if (daysRemaining <= 0) {
          return;
        }

        // Check if subscription is within warning window (1-3 days remaining)
        if (daysRemaining <= SUBSCRIPTION_WARNING_DAYS) {
          // Check if we already sent a warning for this subscription
          // period. Phase 5: composite by_user_action index — no in-memory
          // filter over the user's whole audit history on this daily
          // all-user hot path.
          const existingLog = await ctx.db
            .query("auditLogs")
            .withIndex("by_user_action", (q) =>
              q.eq("userId", user._id).eq("action", "subscription_warning_sent")
            )
            .order("desc")
            .first();

          // Skip if we already sent a warning in the last 24 hours
          if (existingLog && existingLog.createdAt > now - 24 * 60 * 60 * 1000) {
            emailsSkipped++;
            return;
          }

          // Send the warning email
          await ctx.scheduler.runAfter(0, internal.emails.sendSubscriptionExpiryWarning, {
            userId: user._id,
            email: user.email,
            name: user.name || "there",
            daysRemaining,
            subscriptionEndDate: subEnd,
          });

          // Log that we sent the warning
          await createAuditLog(ctx, {
            userId: user._id,
            action: "subscription_warning_sent",
            resource: "users",
            resourceId: user._id,
            changes: {
              daysRemaining,
              subscriptionEndDate: subEnd,
              emailSentTo: user.email,
              urgency: daysRemaining <= SUBSCRIPTION_URGENT_DAYS ? "urgent" : "normal",
            },
          });

          emailsSent++;
        }
      },
      (ctx, cursor) =>
        ctx.scheduler.runAfter(0, internal.subscriptions.sendSubscriptionExpiryWarnings, {
          cursor,
        }),
      "sendSubscriptionExpiryWarnings",
      { jobName: "subscription_expiry_warnings", ttlMs: 6 * 60 * 60 * 1000 }
    );
  },
});

/**
 * Send payment method reminder emails to users before subscription renewal.
 * Batched cron: each invocation processes at most CRON_BATCH_SIZE users and schedules
 * the next batch when more remain. Audit-log dedup prevents duplicate reminders within
 * 24h even if a batch is retried.
 */
export const sendPaymentMethodReminders = internalMutation({
  args: cronBatchArgs,
  handler: async (ctx, args): Promise<CronBatchResult> => {
    const now = Date.now();
    let emailsSent = 0;
    let emailsSkipped = 0;

    return runCronBatch(
      ctx,
      args.cursor,
      CRON_BATCH_SIZE,
      pageUsers,
      async (ctx, user) => {
        // Skip users without paid subscriptions or without email
        if (!user.subscriptionEndDate || !user.email || user.subscriptionTier !== "pro") {
          return;
        }

        const subEnd = user.subscriptionEndDate;
        const daysUntilRenewal = Math.ceil((subEnd - now) / (24 * 60 * 60 * 1000));

        // Skip if subscription has already expired
        if (daysUntilRenewal <= 0) {
          return;
        }

        // Send reminder 7 days before renewal if payment method is not verified
        const shouldRemind = !user.paymentMethodVerified && daysUntilRenewal <= 7;

        if (shouldRemind) {
          // Check if we already sent a reminder for this subscription
          // period. Phase 5: composite by_user_action index — no in-memory
          // filter over the user's whole audit history.
          const existingLog = await ctx.db
            .query("auditLogs")
            .withIndex("by_user_action", (q) =>
              q.eq("userId", user._id).eq("action", "payment_method_reminder_sent")
            )
            .order("desc")
            .first();

          // Skip if we already sent a reminder in the last 24 hours
          if (existingLog && existingLog.createdAt > now - 24 * 60 * 60 * 1000) {
            emailsSkipped++;
            return;
          }

          // Send the reminder email
          await ctx.scheduler.runAfter(0, internal.emails.sendPaymentMethodReminder, {
            userId: user._id,
            email: user.email,
            name: user.name || "there",
            daysUntilRenewal,
            subscriptionEndDate: subEnd,
          });

          // Log that we sent the reminder
          await createAuditLog(ctx, {
            userId: user._id,
            action: "payment_method_reminder_sent",
            resource: "users",
            resourceId: user._id,
            changes: {
              daysUntilRenewal,
              subscriptionEndDate: subEnd,
              emailSentTo: user.email,
            },
          });

          emailsSent++;
        }
      },
      (ctx, cursor) =>
        ctx.scheduler.runAfter(0, internal.subscriptions.sendPaymentMethodReminders, {
          cursor,
        }),
      "sendPaymentMethodReminders",
      { jobName: "payment_method_reminders", ttlMs: 6 * 60 * 60 * 1000 }
    );
  },
});

/**
 * Mark payment method as verified for a user
 */
export const verifyPaymentMethod = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const now = Date.now();

    await ctx.db.patch(userId, {
      paymentMethodVerified: true,
      lastPaymentMethodReminder: undefined, // Clear reminder since verified
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "payment_method_verified",
      resource: "users",
      resourceId: userId,
      changes: { paymentMethodVerified: true },
    });

    return { success: true };
  },
});

/**
 * Expire subscriptions for users whose paid subscriptions have ended.
 * Batched cron: each invocation downgrades at most CRON_BATCH_SIZE users and schedules
 * the next batch when more remain. Idempotent by state — once downgraded to "free",
 * a retried batch skips them, so retries never double-downgrade or duplicate emails.
 */
export const expireSubscriptions = internalMutation({
  args: cronBatchArgs,
  handler: async (ctx, args): Promise<CronBatchResult> => {
    const now = Date.now();

    return runCronBatch(
      ctx,
      args.cursor,
      EXPIRE_SUBSCRIPTIONS_BATCH,
      pageUsers,
      async (ctx, user) => {
        if (
          user.subscriptionEndDate !== undefined &&
          user.subscriptionEndDate < now &&
          user.subscriptionTier === "pro"
        ) {
          // Subscription expired - downgrade to Free
          await ctx.db.patch(user._id, {
            subscriptionTier: "free",
            subscriptionEndDate: undefined,
            updatedAt: now,
          });

          // Send subscription expired email
          if (user.email) {
            await ctx.scheduler.runAfter(0, internal.emails.sendSubscriptionExpiredEmail, {
              userId: user._id,
              email: user.email,
              name: user.name || "there",
            });
          }

          // Create audit log
          await createAuditLog(ctx, {
            userId: user._id,
            action: "subscription_expired",
            resource: "users",
            resourceId: user._id,
            changes: {
              previousTier: "pro",
              newTier: "free",
              subscriptionEndDate: user.subscriptionEndDate,
            },
          });
        }
      },
      (ctx, cursor) =>
        ctx.scheduler.runAfter(0, internal.subscriptions.expireSubscriptions, { cursor }),
      "expireSubscriptions",
      { jobName: "expire_subscriptions", ttlMs: 6 * 60 * 60 * 1000 }
    );
  },
});
