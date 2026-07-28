import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// ============================================================
// FarmBond Scheduled Jobs
// ============================================================

/**
 * Expire free trials every 24 hours.
 * Checks all users with expired trial end dates and downgrades
 * them from Pro back to Free tier.
 */
crons.interval(
  "expire_trials",
  { hours: 24 },
  api.trials.expireTrials
);

/**
 * Send trial expiry warning emails daily.
 * Warns users 2 days before their trial expires.
 */
crons.interval(
  "trial_expiry_warnings",
  { hours: 24 },
  api.trials.sendTrialExpiryWarnings
);

/**
 * Send subscription expiry warning emails daily.
 * Warns paid users 3 days before their subscription renews/expires.
 */
crons.interval(
  "subscription_expiry_warnings",
  { hours: 24 },
  api.subscriptions.sendSubscriptionExpiryWarnings
);

/**
 * Expire paid subscriptions every 24 hours.
 * Downgrades users whose subscriptions have lapsed and sends notification.
 */
crons.interval(
  "expire_subscriptions",
  { hours: 24 },
  api.subscriptions.expireSubscriptions
);

export default crons;
