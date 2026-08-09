import { action, query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// ============================================================
// Stripe Integration
// Checkout sessions, customer portal, subscription management
// ============================================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID || "price_farmbond_pro_monthly";
const APP_URL = process.env.APP_URL || "https://farmbond.com";

/**
 * Get current user's Stripe subscription status
 */
export const getStripeStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      stripeCurrentPeriodEnd: user.stripeCurrentPeriodEnd,
      paymentFailedAt: user.paymentFailedAt,
      paymentFailureCount: user.paymentFailureCount || 0,
      hasPaymentMethod: !!user.paymentMethodVerified,
    };
  },
});

/**
 * Create a Stripe Checkout Session for upgrading to Pro
 * Takes user info as arguments to avoid circular references
 */
export const createCheckoutSession = action({
  args: {
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    if (!STRIPE_SECRET_KEY) {
      throw new Error("Stripe is not configured. Please contact support.");
    }

    // Check if user already has a Stripe subscription
    if (args.stripeSubscriptionId) {
      throw new Error("You already have an active subscription. Please manage it in your billing portal.");
    }

    // Create or retrieve Stripe customer
    let customerId = args.stripeCustomerId;

    if (!customerId) {
      const customerResponse = await fetch("https://api.stripe.com/v1/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        },
        body: new URLSearchParams({
          email: args.email || "",
          name: args.name || "",
          "metadata[userId]": userId,
        }).toString(),
      });

      if (!customerResponse.ok) {
        const error = await customerResponse.text();
        console.error("Failed to create Stripe customer:", error);
        throw new Error("Failed to create customer account. Please try again.");
      }

      const customer = await customerResponse.json();
      customerId = customer.id;

      // Update user with Stripe customer ID via internal mutation
      await ctx.runMutation(internal.stripe.updateStripeCustomerId, {
        userId: userId as any,
        stripeCustomerId: customerId as string,
      });
    }

    // Create Checkout Session
    const sessionResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      },
      body: new URLSearchParams({
        customer: customerId || "",
        "line_items[0][price]": STRIPE_PRICE_ID,
        "line_items[0][quantity]": "1",
        mode: "subscription",
        success_url: `${APP_URL}/settings?tab=subscription&payment=success`,
        cancel_url: `${APP_URL}/settings?tab=subscription&payment=cancelled`,
        "metadata[userId]": userId,
        "subscription_data[metadata][userId]": userId,
        "subscription_data[trial_period_days]": "0",
        "payment_method_types[0]": "card",
        billing_address_collection: "auto",
      }).toString(),
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.text();
      console.error("Failed to create checkout session:", error);
      throw new Error("Failed to create checkout session. Please try again.");
    }

    const session = await sessionResponse.json();

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  },
});

/**
 * Create a Stripe Customer Portal session
 */
export const createPortalSession = action({
  args: {
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    if (!STRIPE_SECRET_KEY) {
      throw new Error("Stripe is not configured. Please contact support.");
    }

    if (!args.stripeCustomerId) {
      throw new Error("No billing account found. Please subscribe first.");
    }

    const sessionResponse = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      },
      body: new URLSearchParams({
        customer: args.stripeCustomerId,
        return_url: `${APP_URL}/settings?tab=subscription`,
      }).toString(),
    });

    if (!sessionResponse.ok) {
      const error = await sessionResponse.text();
      console.error("Failed to create portal session:", error);
      throw new Error("Failed to open billing portal. Please try again.");
    }

    const session = await sessionResponse.json();

    return {
      portalUrl: session.url,
    };
  },
});

/**
 * Cancel subscription at period end
 */
export const cancelSubscription = action({
  args: {
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    if (!STRIPE_SECRET_KEY) {
      throw new Error("Stripe is not configured.");
    }

    if (!args.stripeSubscriptionId) {
      throw new Error("No active subscription to cancel.");
    }

    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${args.stripeSubscriptionId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        },
        body: new URLSearchParams({
          cancel_at_period_end: "true",
        }).toString(),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Failed to cancel subscription:", error);
      throw new Error("Failed to cancel subscription. Please try again.");
    }

    return { success: true, message: "Subscription will cancel at end of billing period." };
  },
});

/**
 * Retry failed payment
 */
export const retryPayment = action({
  args: {
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    if (!STRIPE_SECRET_KEY) {
      throw new Error("Stripe is not configured.");
    }

    if (!args.stripeSubscriptionId) {
      throw new Error("No subscription found.");
    }

    const invoicesResponse = await fetch(
      `https://api.stripe.com/v1/invoices?customer=${args.stripeCustomerId}&status=open&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        },
      }
    );

    if (!invoicesResponse.ok) {
      throw new Error("Failed to retrieve invoices.");
    }

    const invoices = await invoicesResponse.json();
    const unpaidInvoice = invoices.data?.[0];

    if (!unpaidInvoice) {
      throw new Error("No unpaid invoice found.");
    }

    const payResponse = await fetch(
      `https://api.stripe.com/v1/invoices/${unpaidInvoice.id}/pay`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        },
      }
    );

    if (!payResponse.ok) {
      const error = await payResponse.text();
      console.error("Failed to retry payment:", error);
      throw new Error("Payment retry failed. Please update your payment method.");
    }

    return { success: true, message: "Payment retry initiated." };
  },
});

// ============================================================
// Internal Mutations (called by webhook handler and actions)
// ============================================================

/**
 * Update Stripe customer ID for a user.
 * INTERNAL ONLY — the userId is resolved from the authenticated
 * createCheckoutSession action, never from a client-supplied argument.
 * Previously an unauthenticated mutation, it could be called directly by
 * any signed-in client to overwrite another user's stripeCustomerId.
 */
export const updateStripeCustomerId = internalMutation({
  args: {
    userId: v.id("users"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Activate subscription after successful checkout
 */
export const activateSubscription = mutation({
  args: {
    userId: v.id("users"),
    stripeCustomerId: v.string(),
    stripeSubscriptionId: v.string(),
    stripePriceId: v.string(),
    subscriptionEndDate: v.number(),
    paymentMethodVerified: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    await ctx.db.patch(args.userId, {
      subscriptionTier: "pro",
      subscriptionStartDate: now,
      subscriptionEndDate: args.subscriptionEndDate,
      stripeCustomerId: args.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId,
      stripePriceId: args.stripePriceId,
      stripeCurrentPeriodEnd: args.subscriptionEndDate,
      paymentMethodVerified: args.paymentMethodVerified,
      paymentFailedAt: undefined,
      paymentFailureCount: 0,
      trialEndDate: undefined,
      updatedAt: now,
    });

    const { createAuditLog } = await import("./authHelpers");
    await createAuditLog(ctx, {
      userId: args.userId,
      action: "subscription_activated",
      resource: "users",
      resourceId: args.userId,
      changes: {
        subscriptionTier: "pro",
        stripeSubscriptionId: args.stripeSubscriptionId,
        subscriptionEndDate: args.subscriptionEndDate,
      },
    });
  },
});

/**
 * Renew subscription after successful payment
 */
export const renewSubscription = mutation({
  args: {
    userId: v.id("users"),
    subscriptionEndDate: v.number(),
    paymentFailureCount: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      subscriptionEndDate: args.subscriptionEndDate,
      stripeCurrentPeriodEnd: args.subscriptionEndDate,
      paymentFailedAt: undefined,
      paymentFailureCount: args.paymentFailureCount,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Handle payment failure
 */
export const handlePaymentFailure = mutation({
  args: {
    userId: v.id("users"),
    failureCount: v.number(),
    failedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      paymentFailedAt: args.failedAt,
      paymentFailureCount: args.failureCount,
      updatedAt: Date.now(),
    });

    const { createAuditLog } = await import("./authHelpers");
    await createAuditLog(ctx, {
      userId: args.userId,
      action: "payment_failed",
      resource: "users",
      resourceId: args.userId,
      changes: {
        failureCount: args.failureCount,
        failedAt: args.failedAt,
      },
    });
  },
});

/**
 * Update subscription status from webhook
 */
export const updateSubscriptionStatus = mutation({
  args: {
    userId: v.id("users"),
    subscriptionEndDate: v.number(),
    stripePriceId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const updates: Record<string, any> = {
      stripeCurrentPeriodEnd: args.subscriptionEndDate,
      stripePriceId: args.stripePriceId,
      updatedAt: Date.now(),
    };

    if (args.status === "past_due") {
      updates.paymentFailedAt = Date.now();
    }

    if (args.status === "canceled" || args.status === "unpaid") {
      updates.subscriptionTier = "free";
      updates.subscriptionEndDate = undefined;
      updates.stripeSubscriptionId = undefined;
    }

    await ctx.db.patch(args.userId, updates);
  },
});

/**
 * Cancel subscription and downgrade to Free
 */
export const cancelSubscriptionMutation = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      subscriptionTier: "free",
      subscriptionEndDate: undefined,
      stripeSubscriptionId: undefined,
      updatedAt: Date.now(),
    });

    const { createAuditLog } = await import("./authHelpers");
    await createAuditLog(ctx, {
      userId: args.userId,
      action: "subscription_cancelled",
      resource: "users",
      resourceId: args.userId,
      changes: {
        previousTier: "pro",
        newTier: "free",
      },
    });
  },
});
