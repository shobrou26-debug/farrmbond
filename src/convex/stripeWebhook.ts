import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { ConvexError } from "convex/values";

// ============================================================
// Stripe Webhook Handler
// Handles payment events: success, failure, subscription updates
// ============================================================

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Stripe webhook endpoint
 * Handles checkout.session.completed, invoice.payment_failed,
 * customer.subscription.updated, and customer.subscription.deleted
 */
export const stripeWebhook = httpAction(async (ctx, request) => {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("STRIPE_WEBHOOK_SECRET not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  if (!signature) {
    return new Response("No signature provided", { status: 400 });
  }

  // Verify webhook signature using crypto
  let event;
  try {
    event = await verifyStripeSignature(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  console.log("Stripe webhook received:", event.type);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(ctx, event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handlePaymentSucceeded(ctx, event.data.object);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(ctx, event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(ctx, event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(ctx, event.data.object);
        break;

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response("Webhook processed", { status: 200 });
  } catch (err) {
    console.error("Error processing webhook:", err);
    return new Response("Webhook processing error", { status: 500 });
  }
});

/**
 * Handle successful checkout session completion
 * Activates Pro subscription for the user
 */
async function handleCheckoutCompleted(ctx: any, session: any) {
  const userId = session.metadata?.userId;
  const stripeCustomerId = session.customer;
  const stripeSubscriptionId = session.subscription;

  if (!userId) {
    console.error("No userId in checkout session metadata");
    return;
  }

  // Get subscription details from Stripe
  const subscription = await retrieveSubscription(stripeSubscriptionId);
  if (!subscription) {
    console.error("Could not retrieve subscription:", stripeSubscriptionId);
    return;
  }

  const now = Date.now();
  const periodEnd = subscription.current_period_end * 1000;

  // Update user in Convex
  await ctx.runMutation(api.stripe.activateSubscription, {
    userId,
    stripeCustomerId,
    stripeSubscriptionId,
    stripePriceId: subscription.items.data[0]?.price?.id || "",
    subscriptionEndDate: periodEnd,
    paymentMethodVerified: true,
  });

  // Send welcome email
  const user = await ctx.runQuery(internal.users.getUserById, { userId });
  if (user?.email) {
    await ctx.scheduler.runAfter(0, api.emails.sendSubscriptionActivatedEmail, {
      userId,
      email: user.email,
      name: user.name || "there",
      subscriptionEndDate: periodEnd,
    });
  }

  console.log("Subscription activated for user:", userId);
}

/**
 * Handle successful payment
 * Extends subscription end date and resets failure count
 */
async function handlePaymentSucceeded(ctx: any, invoice: any) {
  const stripeCustomerId = invoice.customer;
  const stripeSubscriptionId = invoice.subscription;

  // Find user by Stripe customer ID
  const user = await ctx.runQuery(internal.users.getUserByStripeCustomer, {
    stripeCustomerId,
  });

  if (!user) {
    console.error("No user found for Stripe customer:", stripeCustomerId);
    return;
  }

  // Get updated subscription details
  const subscription = await retrieveSubscription(stripeSubscriptionId);
  if (!subscription) return;

  const periodEnd = subscription.current_period_end * 1000;

  // Update subscription end date and reset failure count
  await ctx.runMutation(api.stripe.renewSubscription, {
    userId: user._id,
    subscriptionEndDate: periodEnd,
    paymentFailureCount: 0,
  });

  console.log("Payment succeeded for user:", user._id, "new period end:", periodEnd);
}

/**
 * Handle failed payment
 * Increments failure count, sends notification, and manages grace period
 */
async function handlePaymentFailed(ctx: any, invoice: any) {
  const stripeCustomerId = invoice.customer;
  const stripeSubscriptionId = invoice.subscription;

  // Find user by Stripe customer ID
  const user = await ctx.runQuery(internal.users.getUserByStripeCustomer, {
    stripeCustomerId,
  });

  if (!user) {
    console.error("No user found for Stripe customer:", stripeCustomerId);
    return;
  }

  const failureCount = (user.paymentFailureCount || 0) + 1;
  const now = Date.now();

  // Update user with failure info
  await ctx.runMutation(api.stripe.handlePaymentFailure, {
    userId: user._id,
    failureCount,
    failedAt: now,
  });

  // Send payment failure email with retry instructions
  if (user.email) {
    await ctx.scheduler.runAfter(0, api.emails.sendPaymentFailedEmail, {
      userId: user._id,
      email: user.email,
      name: user.name || "there",
      failureCount,
      subscriptionEndDate: user.subscriptionEndDate || now,
    });
  }

  console.log("Payment failed for user:", user._id, "failure count:", failureCount);
}

/**
 * Handle subscription updates (plan changes, renewals)
 */
async function handleSubscriptionUpdated(ctx: any, subscription: any) {
  const stripeCustomerId = subscription.customer;

  const user = await ctx.runQuery(internal.users.getUserByStripeCustomer, {
    stripeCustomerId,
  });

  if (!user) return;

  const periodEnd = subscription.current_period_end * 1000;
  const status = subscription.status;

  // Update subscription details
  await ctx.runMutation(api.stripe.updateSubscriptionStatus, {
    userId: user._id,
    subscriptionEndDate: periodEnd,
    stripePriceId: subscription.items.data[0]?.price?.id || "",
    status, // "active", "past_due", "canceled", etc.
  });
}

/**
 * Handle subscription cancellation/deletion
 */
async function handleSubscriptionDeleted(ctx: any, subscription: any) {
  const stripeCustomerId = subscription.customer;

  const user = await ctx.runQuery(internal.users.getUserByStripeCustomer, {
    stripeCustomerId,
  });

  if (!user) return;

  // Downgrade to Free
  await ctx.runMutation(api.stripe.cancelSubscriptionMutation, {
    userId: user._id,
  });

  // Send cancellation email
  if (user.email) {
    await ctx.scheduler.runAfter(0, api.emails.sendSubscriptionCancelledEmail, {
      userId: user._id,
      email: user.email,
      name: user.name || "there",
    });
  }

  console.log("Subscription cancelled for user:", user._id);
}

/**
 * Verify Stripe webhook signature using Web Crypto API
 */
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<any> {
  const elements = signature.split(",").reduce((acc: any, part: string) => {
    const [key, value] = part.split("=");
    acc[key.trim()] = value;
    return acc;
  }, {});

  const timestamp = elements["t"];
  const signedPayload = `${timestamp}.${payload}`;
  const expectedSig = elements["v1"];

  // Convert secret to key bytes
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  // Sign the payload
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  // Convert to hex
  const computedSig = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computedSig !== expectedSig) {
    throw new Error("Invalid signature");
  }

  // Check timestamp (5 minute tolerance)
  const currentTime = Math.floor(Date.now() / 1000);
  if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
    throw new Error("Timestamp too old");
  }

  return JSON.parse(payload);
}

/**
 * Retrieve a subscription from Stripe
 */
async function retrieveSubscription(subscriptionId: string): Promise<any> {
  if (!STRIPE_SECRET_KEY) return null;

  try {
    const response = await fetch(
      `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        },
      }
    );

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error("Failed to retrieve subscription:", error);
    return null;
  }
}
