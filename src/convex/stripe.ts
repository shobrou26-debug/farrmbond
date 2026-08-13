import { action, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// ============================================================
// Stripe Integration
// Checkout sessions, customer portal, subscription management
// ============================================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
// No placeholder fallback: a missing STRIPE_PRICE_ID must fail loudly at
// checkout time rather than silently sending a fake price ID to Stripe
// (which would either error or, worse, charge the wrong product).
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const APP_URL = process.env.APP_URL || "https://farmbond.com";

/**
 * Pure: return a human-readable error when Stripe is not fully configured,
 * or null when it is. Checkout refuses to start until both the secret key
 * and the real Pro price ID are set — the fake/default price id fallback
 * has been removed so it can never be used in production by accident.
 */
export function stripeConfigError(
  secretKey?: string,
  priceId?: string
): string | null {
  if (!secretKey) {
    return "Stripe is not configured: STRIPE_SECRET_KEY is missing. Add it via the Keys/API keys tab.";
  }
  if (!priceId) {
    return "Stripe is not fully configured: STRIPE_PRICE_ID is missing. Set it to your Pro monthly price ID (created in the Stripe dashboard) before enabling checkout.";
  }
  return null;
}

/**
 * Pure: does this Stripe subscription ID belong to this user?
 * The client actions accept a Stripe object ID from the browser; before
 * acting on it we require it to match the ID stored on the authenticated
 * user's own document. This prevents a user from cancelling/retrying
 * someone else's subscription by supplying their ID.
 */
export function ownsStripeSubscription(
  user: { stripeSubscriptionId?: string },
  provided: string
): boolean {
  return !!user.stripeSubscriptionId && user.stripeSubscriptionId === provided;
}

/**
 * Pure: does this Stripe customer ID belong to this user?
 * Same ownership rule for billing-portal/checkout/retry flows.
 */
export function ownsStripeCustomer(
  user: { stripeCustomerId?: string },
  provided: string
): boolean {
  return !!user.stripeCustomerId && user.stripeCustomerId === provided;
}

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

    // Fail loudly (never silently use a placeholder price) when Stripe is
    // not fully configured with a real secret key AND real price ID.
    const configError = stripeConfigError(STRIPE_SECRET_KEY, STRIPE_PRICE_ID);
    if (configError) {
      throw new Error(configError);
    }
    // Both env values are guaranteed present past this point (the guard
    // above throws otherwise) — bind the price ID for the request below.
    const priceId = STRIPE_PRICE_ID as string;

    // Check if user already has a Stripe subscription
    if (args.stripeSubscriptionId) {
      throw new Error("You already have an active subscription. Please manage it in your billing portal.");
    }

    // A client-supplied customer ID is only honored when it matches the
    // authenticated user's own Stripe customer — never someone else's.
    if (args.stripeCustomerId) {
      const user = await ctx.runQuery(internal.users.getUserById, { userId });
      if (!user || !ownsStripeCustomer(user, args.stripeCustomerId)) {
        throw new Error("Authorization denied: Stripe customer does not belong to your account.");
      }
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
        "line_items[0][price]": priceId,
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

    // The billing portal may only be opened for the caller's own customer.
    const user = await ctx.runQuery(internal.users.getUserById, { userId });
    if (!user || !ownsStripeCustomer(user, args.stripeCustomerId)) {
      throw new Error("Authorization denied: billing account does not belong to you.");
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

    // A user may only cancel their OWN subscription. The ID is derived from
    // the authenticated session's stored value — never trusted blindly.
    const user = await ctx.runQuery(internal.users.getUserById, { userId });
    if (!user || !ownsStripeSubscription(user, args.stripeSubscriptionId)) {
      throw new Error("Authorization denied: subscription does not belong to you.");
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

    // Retrying a payment is only allowed against the caller's own Stripe
    // customer AND subscription — both must match the session user's doc.
    const user = await ctx.runQuery(internal.users.getUserById, { userId });
    if (
      !user ||
      !ownsStripeCustomer(user, args.stripeCustomerId) ||
      !ownsStripeSubscription(user, args.stripeSubscriptionId)
    ) {
      throw new Error("Authorization denied: billing account does not belong to you.");
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
/**
 * Activate subscription after a VERIFIED Stripe checkout.
 * INTERNAL ONLY — called by the signature-verified Stripe webhook, never by
 * the client. Accepting a userId argument is safe here because the caller
 * (stripeWebhook) authenticates the event signature before invoking this.
 * Previously a public mutation, any signed-in client could grant themselves
 * or any other user Pro by calling it directly.
 */
export const activateSubscription = internalMutation({
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
      // A real (webhook-verified) paid subscription — marks the account as
      // paid so it can never claim a free trial after cancelling.
      hasEverPaid: true,
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
/**
 * Renew subscription after a VERIFIED invoice payment.
 * INTERNAL ONLY — reachable exclusively from the signature-verified Stripe
 * webhook. Was public: a client could extend anyone's subscription by
 * supplying their userId.
 */
export const renewSubscription = internalMutation({
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
/**
 * Record a payment failure.
 * INTERNAL ONLY — called by the signature-verified Stripe webhook. Was
 * public: a client could poison any user's payment-failure state.
 */
export const handlePaymentFailure = internalMutation({
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

export type SubscriptionStatusUpdates = {
  stripeCurrentPeriodEnd: number;
  stripePriceId: string;
  paymentFailedAt?: number;
  subscriptionTier?: "free";
  subscriptionEndDate?: undefined;
  stripeSubscriptionId?: undefined;
};

/**
 * Pure: map a Stripe subscription status into the user-document patch fields
 * that should be applied. Extracted for testability — this is the exact rule
 * the webhook path applies, so a regression here is caught by unit tests.
 */
export function buildSubscriptionStatusUpdates(input: {
  status: string;
  subscriptionEndDate: number;
  stripePriceId: string;
  now?: number;
}): SubscriptionStatusUpdates {
  const updates: SubscriptionStatusUpdates = {
    stripeCurrentPeriodEnd: input.subscriptionEndDate,
    stripePriceId: input.stripePriceId,
  };

  if (input.status === "past_due") {
    updates.paymentFailedAt = input.now ?? Date.now();
  }

  if (input.status === "canceled" || input.status === "unpaid") {
    updates.subscriptionTier = "free";
    updates.subscriptionEndDate = undefined;
    updates.stripeSubscriptionId = undefined;
  }

  return updates;
}

/**
 * Update subscription status from webhook.
 * INTERNAL ONLY — called by the signature-verified Stripe webhook. Was
 * public: a client could downgrade any user, forge past_due state, or
 * mutate subscription dates by supplying an arbitrary userId.
 */
export const updateSubscriptionStatus = internalMutation({
  args: {
    userId: v.id("users"),
    subscriptionEndDate: v.number(),
    stripePriceId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const updates = buildSubscriptionStatusUpdates({
      status: args.status,
      subscriptionEndDate: args.subscriptionEndDate,
      stripePriceId: args.stripePriceId,
    });
    await ctx.db.patch(args.userId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Cancel subscription and downgrade to Free.
 * INTERNAL ONLY — called by the signature-verified Stripe webhook on
 * customer.subscription.deleted. Was public: a client could cancel any
 * other user's subscription by supplying their userId.
 */
export const cancelSubscriptionMutation = internalMutation({
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
