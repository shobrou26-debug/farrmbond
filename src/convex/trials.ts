import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
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
// Trial Management
// Free 7-day Pro trial that auto-downgrades to Free
// ============================================================

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const WARNING_DAYS = 2; // Send warning 2 days before expiry

// Phase 5 batch sizing: the pure downgrade job costs one patch + one
// audit row per user (no external calls), so it safely pages in larger
// chunks; the email-warning job does an indexed dedup lookup + a
// scheduled email per user and stays at the default 200.
const EXPIRE_TRIALS_BATCH = 500;

/**
 * Get the current user's trial status
 */
export const getTrialStatus = query({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireAuth(ctx);

    const now = Date.now();
    const trialEnd = user.trialEndDate;
    const isTrialActive = !!trialEnd && now < trialEnd;
    const trialDaysRemaining = trialEnd
      ? Math.max(0, Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000)))
      : 0;
    const hasUsedTrial = user.subscriptionStartDate !== undefined && 
      user.subscriptionTier === "free" && 
      trialEnd !== undefined;

    return {
      isTrialActive,
      trialEndDate: trialEnd,
      trialDaysRemaining,
      hasUsedTrial,
      subscriptionTier: user.subscriptionTier || "free",
    };
  },
});

/**
 * Start a free 7-day Pro trial
 * Users can only use the trial once
 */
export const startTrial = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireAuth(ctx);

    const now = Date.now();

    // Check if user already used or is in a trial
    if (user.trialEndDate !== undefined) {
      // If trial is still active, don't allow restart
      if (user.trialEndDate > now) {
        throw new Error("You already have an active trial. No need to start another one.");
      }
      // If trial expired, check if they've ever been on a paid plan
      if (user.subscriptionStartDate !== undefined) {
        throw new Error("You have already used your free trial. Please upgrade to Pro to continue.");
      }
    }

    // Check if they're already on Pro
    if (user.subscriptionTier === "pro") {
      throw new Error("You're already on the Pro plan!");
    }

    const trialEnd = now + TRIAL_DURATION_MS;

    // Upgrade to Pro with trial period
    await ctx.db.patch(userId, {
      subscriptionTier: "pro",
      subscriptionStartDate: now,
      subscriptionEndDate: trialEnd,
      trialEndDate: trialEnd,
      updatedAt: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "trial_started",
      resource: "users",
      resourceId: userId,
      changes: {
        trialEndDate: trialEnd,
        duration: "7 days",
        subscriptionTier: "pro",
      },
    });

    return {
      success: true,
      trialEndDate: trialEnd,
      trialDaysRemaining: 7,
    };
  },
});

/**
 * Check and expire trials for all users.
 * Batched cron: each invocation processes at most CRON_BATCH_SIZE users
 * and schedules the next batch when more remain. Idempotent by state —
 * once a user is downgraded to "free", a retried batch skips them, so
 * retries never double-downgrade or duplicate audit entries.
 */
export const expireTrials = internalMutation({
  args: cronBatchArgs,
  handler: async (ctx, args): Promise<CronBatchResult> => {
    const now = Date.now();

    return runCronBatch(
      ctx,
      args.cursor,
      EXPIRE_TRIALS_BATCH,
      pageUsers,
      async (ctx, user) => {
        if (
          user.trialEndDate !== undefined &&
          user.trialEndDate < now &&
          user.subscriptionTier === "pro"
        ) {
          // Trial expired - downgrade to Free
          await ctx.db.patch(user._id, {
            subscriptionTier: "free",
            subscriptionEndDate: undefined,
            trialEndDate: user.trialEndDate, // Keep the trial end date for history
            updatedAt: now,
          });

          // Create audit log
          await createAuditLog(ctx, {
            userId: user._id,
            action: "trial_expired",
            resource: "users",
            resourceId: user._id,
            changes: {
              previousTier: "pro",
              newTier: "free",
              trialEndDate: user.trialEndDate,
            },
          });
        }
      },
      (ctx, cursor) =>
        ctx.scheduler.runAfter(0, internal.trials.expireTrials, { cursor }),
      "expireTrials",
      // Overlap protection: the 24h interval is far longer than the chain
      // for any realistic dataset, but the lease makes a duplicate chain
      // (e.g. after a deploy restart) a no-op instead of extra work.
      { jobName: "expire_trials", ttlMs: 6 * 60 * 60 * 1000 }
    );
  },
});

/**
 * Send trial expiry warning emails to users whose trials end in 2 days.
 * Batched cron: each invocation processes at most CRON_BATCH_SIZE users
 * and schedules the next batch when more remain. Audit-log dedup keeps
 * retried batches from sending duplicate warnings within 24h.
 */
export const sendTrialExpiryWarnings = internalMutation({
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
        // Skip users without trials or without email
        if (!user.trialEndDate || !user.email) {
          return;
        }

        const trialEnd = user.trialEndDate;
        const daysRemaining = Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000));

        // Check if trial is within warning window (1-2 days remaining)
        if (daysRemaining <= WARNING_DAYS && daysRemaining > 0 && user.subscriptionTier === "pro") {
          // Check if we already sent a warning for this trial. Phase 5:
          // composite by_user_action index — no in-memory filter over the
          // user's whole audit history on this daily all-user hot path.
          const existingLog = await ctx.db
            .query("auditLogs")
            .withIndex("by_user_action", (q) =>
              q.eq("userId", user._id).eq("action", "trial_warning_sent")
            )
            .order("desc")
            .first();

          // Skip if we already sent a warning in the last 24 hours
          if (existingLog && existingLog.createdAt > now - 24 * 60 * 60 * 1000) {
            emailsSkipped++;
            return;
          }

          // Send the warning email
          await ctx.scheduler.runAfter(0, internal.emails.sendTrialExpiryWarning, {
            userId: user._id,
            email: user.email,
            name: user.name || "there",
            daysRemaining,
            trialEndDate: trialEnd,
          });

          // Log that we sent the warning
          await createAuditLog(ctx, {
            userId: user._id,
            action: "trial_warning_sent",
            resource: "users",
            resourceId: user._id,
            changes: {
              daysRemaining,
              trialEndDate: trialEnd,
              emailSentTo: user.email,
            },
          });

          emailsSent++;
        }
      },
      (ctx, cursor) =>
        ctx.scheduler.runAfter(0, internal.trials.sendTrialExpiryWarnings, { cursor }),
      "sendTrialExpiryWarnings",
      { jobName: "trial_expiry_warnings", ttlMs: 6 * 60 * 60 * 1000 }
    );
  },
});

/**
 * Get trial statistics for admin dashboard
 */
export const getTrialStats = query({
  args: {},
  handler: async (ctx) => {
    const { requireAdmin } = await import("./authHelpers");
    await requireAdmin(ctx);

    const now = Date.now();
    const users = await ctx.db.query("users").collect();

    let activeTrials = 0;
    let expiredTrials = 0;
    let neverTrialed = 0;
    let trialsExpiringSoon = 0;

    for (const user of users) {
      if (user.trialEndDate === undefined) {
        neverTrialed++;
      } else if (user.trialEndDate > now) {
        activeTrials++;
        // Check if trial expires within 2 days
        const daysRemaining = Math.ceil((user.trialEndDate - now) / (24 * 60 * 60 * 1000));
        if (daysRemaining <= WARNING_DAYS) {
          trialsExpiringSoon++;
        }
      } else {
        expiredTrials++;
      }
    }

    return { activeTrials, expiredTrials, neverTrialed, trialsExpiringSoon, total: users.length };
  },
});
