import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, createAuditLog } from "./authHelpers";
import { Doc, Id } from "./_generated/dataModel";

// ============================================================
// Trial Management
// Free 7-day Pro trial that auto-downgrades to Free
// ============================================================

const TRIAL_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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
 * Check and expire trials for all users
 * This can be called periodically (e.g., daily) to clean up expired trials
 * Also usable as a Convex internal function
 */
export const expireTrials = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let expiredCount = 0;

    // Find all users with a trial end date that has passed
    const users = await ctx.db.query("users").collect();

    for (const user of users) {
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

        expiredCount++;
      }
    }

    return { success: true, expiredCount };
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

    for (const user of users) {
      if (user.trialEndDate === undefined) {
        neverTrialed++;
      } else if (user.trialEndDate > now) {
        activeTrials++;
      } else {
        expiredTrials++;
      }
    }

    return { activeTrials, expiredTrials, neverTrialed, total: users.length };
  },
});
