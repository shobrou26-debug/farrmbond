import { query, mutation } from "./_generated/server";
import { requireAuth, createAuditLog } from "./authHelpers";
import { api } from "./_generated/api";

// ============================================================
// Subscription Management
// Paid subscription expiry warnings and lifecycle
// ============================================================

const SUBSCRIPTION_WARNING_DAYS = 3; // Send warning 3 days before expiry
const SUBSCRIPTION_URGENT_DAYS = 1; // Urgent warning 1 day before expiry

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
 * Send subscription expiry warning emails to users whose paid subscriptions end soon
 * Called by the cron job to proactively warn users before renewal/expiration
 */
export const sendSubscriptionExpiryWarnings = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let emailsSent = 0;
    let emailsSkipped = 0;
    const errors: string[] = [];

    // Find all users with paid subscriptions
    const users = await ctx.db.query("users").collect();

    for (const user of users) {
      // Skip users without paid subscriptions or without email
      if (!user.subscriptionEndDate || !user.email || user.subscriptionTier !== "pro") {
        continue;
      }

      const subEnd = user.subscriptionEndDate;
      const daysRemaining = Math.ceil((subEnd - now) / (24 * 60 * 60 * 1000));

      // Skip if subscription has already expired (handled by expireSubscriptions)
      if (daysRemaining <= 0) {
        continue;
      }

      // Check if subscription is within warning window (1-3 days remaining)
      if (daysRemaining <= SUBSCRIPTION_WARNING_DAYS) {
        // Check if we already sent a warning for this subscription period
        const existingLog = await ctx.db
          .query("auditLogs")
          .filter((q) =>
            q.and(
              q.eq(q.field("userId"), user._id),
              q.eq(q.field("action"), "subscription_warning_sent")
            )
          )
          .order("desc")
          .first();

        // Skip if we already sent a warning in the last 24 hours
        if (existingLog && existingLog.createdAt > now - 24 * 60 * 60 * 1000) {
          emailsSkipped++;
          continue;
        }

        // Send the warning email
        try {
          await ctx.scheduler.runAfter(0, api.emails.sendSubscriptionExpiryWarning, {
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
        } catch (error) {
          console.error(`Failed to send subscription warning to ${user.email}:`, error);
          errors.push(`${user.email}: ${String(error)}`);
        }
      }
    }

    return {
      success: true,
      emailsSent,
      emailsSkipped,
      errors,
    };
  },
});

/**
 * Expire subscriptions for users whose paid subscriptions have ended
 * Downgrades them to Free tier and sends notification email
 */
export const expireSubscriptions = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    let expiredCount = 0;

    // Find all users with paid subscriptions that have ended
    const users = await ctx.db.query("users").collect();

    for (const user of users) {
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
          try {
            await ctx.scheduler.runAfter(0, api.emails.sendSubscriptionExpiredEmail, {
              userId: user._id,
              email: user.email,
              name: user.name || "there",
            });
          } catch (error) {
            console.error(`Failed to send subscription expired email to ${user.email}:`, error);
          }
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

        expiredCount++;
      }
    }

    return { success: true, expiredCount };
  },
});
