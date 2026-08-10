import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { buildSubscriptionStatusUpdates } from "../convex/stripe";

// ============================================================
// Phase 6 — Security Remediation regression tests
//
// P0: Stripe subscription mutations must be internal-only, so a
//     normal client can never grant/extend/cancel/poison Pro state.
// P1: market price writes must be server-side only.
// P1: seed/demo content mutations must require an admin session.
//     Server email actions must be internal-only.
//
// Convex function visibility can't be introspected at runtime (the
// generated `api`/`internal` are opaque proxies), so the visibility
// guarantees below are locked as source-level guards: if someone
// re-opens a privileged function to the public API, these tests fail.
// ============================================================

const readConvex = (file: string): string =>
  readFileSync(new URL(`../convex/${file}`, import.meta.url), "utf8");

/** Extract the Convex builder kind for an exported function, or null. */
function defKind(source: string, name: string): string | null {
  const match = source.match(new RegExp(`export const ${name} = (\\w+)\\(`));
  return match ? match[1] : null;
}

const count = (source: string, re: RegExp): number =>
  (source.match(re) ?? []).length;

// ============================================================
// P0 — buildSubscriptionStatusUpdates: the webhook state rule
// ============================================================

describe("buildSubscriptionStatusUpdates — webhook state transition rule", () => {
  const end = Date.now() + 30 * 24 * 60 * 60 * 1000;

  test("active status extends the period and never fabricates a Pro grant", () => {
    const updates = buildSubscriptionStatusUpdates({
      status: "active",
      subscriptionEndDate: end,
      stripePriceId: "price_x",
    });
    expect(updates.stripeCurrentPeriodEnd).toBe(end);
    expect(updates.stripePriceId).toBe("price_x");
    // A status update is NOT a grant: it must never write subscriptionTier.
    expect(updates.subscriptionTier).toBeUndefined();
    expect(updates.subscriptionEndDate).toBeUndefined();
  });

  test("past_due records the failure but does not downgrade or grant", () => {
    const now = Date.now();
    const updates = buildSubscriptionStatusUpdates({
      status: "past_due",
      subscriptionEndDate: end,
      stripePriceId: "price_x",
      now,
    });
    expect(updates.paymentFailedAt).toBe(now);
    expect(updates.subscriptionTier).toBeUndefined();
    expect(updates.stripeSubscriptionId).toBeUndefined();
  });

  test("past_due without an explicit now uses the current time", () => {
    const before = Date.now();
    const updates = buildSubscriptionStatusUpdates({
      status: "past_due",
      subscriptionEndDate: end,
      stripePriceId: "price_x",
    });
    expect(updates.paymentFailedAt).toBeGreaterThanOrEqual(before);
  });

  test("canceled downgrades to free and clears the subscription", () => {
    const updates = buildSubscriptionStatusUpdates({
      status: "canceled",
      subscriptionEndDate: end,
      stripePriceId: "price_x",
    });
    expect(updates.subscriptionTier).toBe("free");
    expect(updates.subscriptionEndDate).toBeUndefined();
    expect(updates.stripeSubscriptionId).toBeUndefined();
    expect(updates.stripeCurrentPeriodEnd).toBe(end);
  });

  test("unpaid behaves exactly like canceled (no Pro, no dates left behind)", () => {
    const canceled = buildSubscriptionStatusUpdates({
      status: "canceled",
      subscriptionEndDate: end,
      stripePriceId: "price_x",
    });
    const unpaid = buildSubscriptionStatusUpdates({
      status: "unpaid",
      subscriptionEndDate: end,
      stripePriceId: "price_x",
    });
    expect(unpaid.subscriptionTier).toBe("free");
    expect(unpaid.subscriptionEndDate).toBeUndefined();
    expect(unpaid.stripeSubscriptionId).toBeUndefined();
    expect(unpaid).toEqual(canceled);
  });

  test("the rule is deterministic — replaying the same event is a no-op", () => {
    const input = {
      status: "active",
      subscriptionEndDate: end,
      stripePriceId: "price_x",
      now: 1234567890,
    };
    expect(buildSubscriptionStatusUpdates(input)).toEqual(
      buildSubscriptionStatusUpdates(input)
    );
  });
});

// ============================================================
// P0 — Visibility guard: the 5 subscription mutations must be
// internalMutation and stripe.ts must expose NO public mutation
// ============================================================

describe("P0 — Stripe subscription mutations are internal-only", () => {
  const stripeSrc = readConvex("stripe.ts");

  const privileged = [
    "activateSubscription",
    "renewSubscription",
    "handlePaymentFailure",
    "updateSubscriptionStatus",
    "cancelSubscriptionMutation",
    "updateStripeCustomerId",
  ];

  for (const name of privileged) {
    test(`${name} is an internalMutation (never callable by the client)`, () => {
      expect(defKind(stripeSrc, name)).toBe("internalMutation");
    });
  }

  test("stripe.ts contains NO public mutation definitions", () => {
    expect(count(stripeSrc, /export const \w+ = mutation\(/g)).toBe(0);
  });

  test("public entry points still exist for legitimate client flows", () => {
    expect(defKind(stripeSrc, "getStripeStatus")).toBe("query");
    expect(defKind(stripeSrc, "createCheckoutSession")).toBe("action");
    expect(defKind(stripeSrc, "createPortalSession")).toBe("action");
    expect(defKind(stripeSrc, "cancelSubscription")).toBe("action");
    expect(defKind(stripeSrc, "retryPayment")).toBe("action");
  });
});

// ============================================================
// P0 — Webhook authenticity: subscription state changes only
// happen after signature verification
// ============================================================

describe("P0 — Stripe webhook verifies the event signature before mutating", () => {
  const webhookSrc = readConvex("stripeWebhook.ts");

  test("the webhook verifies the stripe-signature header", () => {
    expect(webhookSrc).toContain("stripe-signature");
    expect(webhookSrc).toContain("verifyStripeSignature");
    expect(webhookSrc).toContain("STRIPE_WEBHOOK_SECRET");
  });

  test("the webhook calls every subscription mutation through internal.stripe", () => {
    for (const name of [
      "activateSubscription",
      "renewSubscription",
      "handlePaymentFailure",
      "updateSubscriptionStatus",
      "cancelSubscriptionMutation",
    ]) {
      expect(webhookSrc).toContain(`internal.stripe.${name}`);
    }
    // And never through the public api.stripe surface (the URL
    // api.stripe.com must not trip this guard — only Convex fn refs).
    expect(count(webhookSrc, /runMutation\(api\.stripe\./g)).toBe(0);
  });
});

// ============================================================
// P1 — Market price writer is internal-only
// ============================================================

describe("P1 — storeMarketPrice is server-side only", () => {
  const marketSrc = readConvex("marketIntelligence.ts");
  test("storeMarketPrice is an internalMutation", () => {
    expect(defKind(marketSrc, "storeMarketPrice")).toBe("internalMutation");
  });
});

// ============================================================
// P1 — Seed / demo content mutations are admin-gated
// ============================================================

describe("P1 — seed & destructive content mutations require an admin", () => {
  const seedSrc = readConvex("seedData.ts");

  for (const name of [
    "seedMarketplace",
    "clearMarketplace",
    "seedKnowledgeArticles",
    "seedFarmingEvents",
  ]) {
    test(`${name} remains a public mutation (Admin Dashboard flow)`, () => {
      expect(defKind(seedSrc, name)).toBe("mutation");
    });
  }

  test("every seed/destructive mutation calls requireAdmin(ctx) first", () => {
    expect(count(seedSrc, /await requireAdmin\(ctx\)/g)).toBeGreaterThanOrEqual(4);
  });
});

// ============================================================
// Regression — server email actions are internal-only;
// sendInvoiceEmail stays public but is auth + ownership guarded
// ============================================================

describe("Email actions — server-only, invoice email guarded", () => {
  const emailsSrc = readConvex("emails.ts");

  for (const name of [
    "sendTrialExpiryWarning",
    "sendSubscriptionExpiryWarning",
    "sendSubscriptionExpiredEmail",
    "sendPaymentMethodReminder",
    "sendSubscriptionActivatedEmail",
    "sendPaymentFailedEmail",
    "sendSubscriptionCancelledEmail",
    "sendVaccinationReminder",
    "sendLowCoverageAlert",
  ]) {
    test(`${name} is an internalAction (never callable by the client)`, () => {
      expect(defKind(emailsSrc, name)).toBe("internalAction");
    });
  }

  test("sendInvoiceEmail stays public for the Payment History page", () => {
    expect(defKind(emailsSrc, "sendInvoiceEmail")).toBe("action");
  });

  test("sendInvoiceEmail authenticates the caller and enforces ownership", () => {
    expect(emailsSrc).toContain("getAuthUserId(ctx)");
    expect(emailsSrc).toContain("sessionUserId !== args.userId");
  });

  test("no email function remains a public mutation", () => {
    expect(count(emailsSrc, /export const \w+ = mutation\(/g)).toBe(0);
  });
});

// ============================================================
// Regression — weather cache writes are internal-only
// ============================================================

describe("Weather cache writes — internal-only", () => {
  const weatherSrc = readConvex("weather.ts");
  test("upsertWeather is an internalMutation", () => {
    expect(defKind(weatherSrc, "upsertWeather")).toBe("internalMutation");
  });
  test("the prefetch cron calls it through internal.weather", () => {
    expect(weatherSrc).toContain("internal.weather.upsertWeather");
  });
});
