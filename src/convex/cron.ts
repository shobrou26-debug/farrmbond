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

export default crons;
