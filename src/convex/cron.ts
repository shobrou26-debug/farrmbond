import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// ============================================================
// FarmBond Scheduled Jobs
//
// Every all-user/all-record cron is a BOUNDED batch processor: the
// cron entry passes { cursor: null } and each invocation processes at
// most CRON_BATCH_SIZE records, chaining the next batch via the
// scheduler until the whole dataset is covered. No single mutation
// walks the entire table, so the jobs scale to 200k+ users.
//
// Overlap protection: every chain-start invocation claims a cronRuns
// lease (see cronBatch.ts). When another chain for the same job is
// live, the fire exits immediately; continuation batches refresh the
// lease; the chain releases it when done. Correctness never depends on
// the lease — every cron is idempotent — so a racing double-chain is
// merely wasteful, never harmful, and a crashed chain self-heals once
// the lease TTL lapses.
// ============================================================

/**
 * Expire free trials every 24 hours.
 * Batched: downgrades expired-trials users from Pro to Free in pages.
 */
crons.interval(
  "expire_trials",
  { hours: 24 },
  internal.trials.expireTrials,
  { cursor: null }
);

/**
 * Send trial expiry warning emails daily.
 * Warns users 2 days before their trial expires.
 */
crons.interval(
  "trial_expiry_warnings",
  { hours: 24 },
  internal.trials.sendTrialExpiryWarnings,
  { cursor: null }
);

/**
 * Send subscription expiry warning emails daily.
 * Warns paid users 3 days before their subscription renews/expires.
 */
crons.interval(
  "subscription_expiry_warnings",
  { hours: 24 },
  internal.subscriptions.sendSubscriptionExpiryWarnings,
  { cursor: null }
);

/**
 * Expire paid subscriptions every 24 hours.
 * Batched: downgrades lapsed subscriptions to Free in pages.
 */
crons.interval(
  "expire_subscriptions",
  { hours: 24 },
  internal.subscriptions.expireSubscriptions,
  { cursor: null }
);

/**
 * Send payment method reminder emails daily.
 * Warns users 7 days before renewal if payment method is not verified.
 */
crons.interval(
  "payment_method_reminders",
  { hours: 24 },
  internal.subscriptions.sendPaymentMethodReminders,
  { cursor: null }
);

/**
 * Pre-fetch weather for all farm locations every 30 minutes.
 * Bounded scan + batch + concurrency-limited Open-Meteo fetches.
 * Ensures weather data is always fresh when users open the app.
 * Deduplicates farm locations to minimize API calls.
 */
crons.interval(
  "prefetch_farm_weather",
  { minutes: 30 },
  api.weather.prefetchAllFarmWeather
);

/**
 * Send vaccination reminders daily.
 * Batched over livestock; per-animal dedup prevents duplicate reminders.
 */
crons.interval(
  "vaccination_reminders",
  { hours: 24 },
  internal.livestock.sendVaccinationReminders,
  { cursor: null }
);

/**
 * Send low vaccine coverage alert emails daily.
 * Batched over users; 24h dedup per user prevents alert spam.
 */
crons.interval(
  "low_coverage_alerts",
  { hours: 24 },
  internal.livestock.sendLowCoverageAlerts,
  { cursor: null }
);

/**
 * Generate smart notifications every 2 hours.
 * Batched: one user page per invocation, chained until all users are covered.
 */
crons.interval(
  "smart_notifications",
  { hours: 2 },
  internal.smartNotificationsCron.runAllNotificationsForAllFarms,
  { cursor: null }
);

/**
 * Generate weather alerts every 30 minutes for users with an enabled
 * weather-alert config. Batched over configs; per-subtype cooldowns
 * prevent duplicate alerts.
 */
crons.interval(
  "weather_alerts",
  { minutes: 30 },
  internal.weatherAlerts.generateWeatherAlertsForAllUsers,
  { cursor: null }
);

/**
 * Run the intelligence pipeline every 4 hours for all users.
 * Batched: one user page per invocation, chained until all users are covered.
 * Deduplicated insights prevent duplicate records on overlapping runs.
 */
crons.interval(
  "intelligence_pipeline",
  { hours: 4 },
  internal.intelligence.runIntelligencePipelineForAllUsers,
  { cursor: null }
);

/**
 * Generate weekly reports every Monday at 6 AM.
 * Batched over farms; per-farm week checks keep reports idempotent.
 */
crons.interval(
  "weekly_reports",
  { hours: 168 },  // Once per week
  internal.weeklyReport.generateWeeklyReports,
  { cursor: null }
);

export default crons;
