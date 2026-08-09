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

/**
 * Send payment method reminder emails daily.
 * Warns users 7 days before renewal if payment method is not verified.
 */
crons.interval(
  "payment_method_reminders",
  { hours: 24 },
  api.subscriptions.sendPaymentMethodReminders
);

/**
 * Pre-fetch weather for all farm locations every 30 minutes.
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
 * Checks all livestock with upcoming vaccinations and sends email reminders.
 */
crons.interval(
  "vaccination_reminders",
  { hours: 24 },
  api.livestock.sendVaccinationReminders
);
/**
 * Send low vaccine coverage alert emails daily.
 * Checks all users with vaccines below 50% coverage and sends
 * proactive email alerts with recommendations.
 */
crons.interval(
  "low_coverage_alerts",
  { hours: 24 },
  api.livestock.sendLowCoverageAlerts
);

/**
 * Run intelligence pipeline for all users every 4 hours.
 * Collects data from weather, satellite, soil, market, crop, livestock,
 * and financial modules to generate health scores and insights.
 */
// Intelligence pipeline runs via the smart_notifications cron below

/**
 * Generate smart notifications every 2 hours.
 * Checks all modules for alerts, warnings, and opportunities.
 */
crons.interval(
  "smart_notifications",
  { hours: 2 },
  api.smartNotificationsCron.runAllNotificationsForAllFarms
);

/**
 * Generate weather alerts every 30 minutes for users with an enabled
 * weather-alert config. Per-subtype cooldowns prevent duplicate alerts.
 */
crons.interval(
  "weather_alerts",
  { minutes: 30 },
  api.weatherAlerts.generateWeatherAlertsForAllUsers
);

/**
 * Run the intelligence pipeline every 4 hours for all users.
 * Collects farm/crop/livestock/weather/satellite/soil/financial data,
 * computes farm health scores, and stores deduplicated insights that
 * feed the Dashboard's AI insights widget.
 */
crons.interval(
  "intelligence_pipeline",
  { hours: 4 },
  api.intelligence.runIntelligencePipelineForAllUsers
);

/**
 * Generate weekly reports every Monday at 6 AM.
 */
crons.interval(
  "weekly_reports",
  { hours: 168 },  // Once per week
  api.weeklyReport.generateWeeklyReports
);

export default crons;
