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

export type TrialDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

/**
 * Pure: may this user start the 7-day Pro trial?
 *
 * Rules (all enforced server-side):
 * - One trial per account, ever (hasUsedTrial or any trialEndDate history).
 * - A user who has ever paid (hasEverPaid) can never trial again after
 *   cancellation — paid customers must re-subscribe.
 * - Anonymous/guest accounts cannot trial — otherwise a script could create
 *   unlimited guest accounts to farm unlimited free Pro weeks + AI quota.
 * - Existing Pro accounts cannot trial.
 * - First-time users are unaffected.
 */
export function canStartTrial(
  user: {
    trialEndDate?: number;
    subscriptionStartDate?: number;
    subscriptionEndDate?: number;
    subscriptionTier?: string;
    hasUsedTrial?: boolean;
    hasEverPaid?: boolean;
    isAnonymous?: boolean;
  },
  now: number = Date.now()
): TrialDecision {
  if (user.isAnonymous === true) {
    return {
      allowed: false,
      reason: "Guest accounts cannot start a free trial. Create an account with your email first.",
    };
  }
  if (user.hasEverPaid === true) {
    return {
      allowed: false,
      reason: "You have already subscribed to FarmBond. The free trial is for first-time users only.",
    };
  }
  if (user.hasUsedTrial === true || user.trialEndDate !== undefined) {
    if (user.trialEndDate !== undefined && user.trialEndDate > now) {
      return { allowed: false, reason: "You already have an active trial. No need to start another one." };
    }
    return { allowed: false, reason: "You have already used your free trial. Please upgrade to Pro to continue." };
  }
  if (user.subscriptionTier === "pro") {
    return { allowed: false, reason: "You're already on the Pro plan!" };
  }
  return { allowed: true };
}

/**
 * Get the current user's trial status
 */
export const getTrialStatus = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireAuth(ctx);

    const now = Date.now();
    const trialEnd = user.trialEndDate;
    const isTrialActive = !!trialEnd && now < trialEnd;
    const trialDaysRemaining = trialEnd
      ? Math.max(0, Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000)))
      : 0;
    // hasUsedTrial: explicit flag (new) OR the legacy derivation (trial
    // started + since downgraded) so pre-migration users stay blocked.
    const hasUsedTrial =
      user.hasUsedTrial === true ||
      (trialEnd !== undefined && user.subscriptionStartDate !== undefined);

    return {
      isTrialActive,
      trialEndDate: trialEnd,
      trialDaysRemaining,
      hasUsedTrial,
      hasEverPaid: user.hasEverPaid === true,
      isAnonymous: user.isAnonymous === true,
      // Server-computed — the client uses this to decide whether to even
      // attempt startTrial; the mutation re-checks the same rule.
      canStartTrial: canStartTrial(user, now).allowed,
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

    // Single server-side rule decides whether a trial may be granted.
    // Covers: used trial, active trial, paid-before (even after cancel),
    // anonymous accounts, and existing Pro. Re-checked here — the client
    // effect only mirrors this decision.
    const decision = canStartTrial(user, now);
    if (!decision.allowed) {
      throw new Error(decision.reason);
    }

    const trialEnd = now + TRIAL_DURATION_MS;

    // Upgrade to Pro with trial period
    await ctx.db.patch(userId, {
      subscriptionTier: "pro",
      subscriptionStartDate: now,
      subscriptionEndDate: trialEnd,
      trialEndDate: trialEnd,
      hasUsedTrial: true,
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
