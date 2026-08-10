import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { shouldActivateCheckoutSession } from "../convex/stripeWebhook";

// ============================================================
// Phase 7 — Production-readiness security audit regression tests
//
// Fixes under test:
//   1. Stripe checkout must verify payment_status === "paid" before
//      granting Pro (no Pro on completed-but-unpaid sessions).
//   2. Satellite analytics reads must be Pro-gated server-side.
//   3. Weather fetch/cache actions must require auth or be internal.
//   4. Unauthenticated engagement counters (shares/views) must be closed.
//   5. Weekly-report history reads must be Pro-gated.
//   6. Indexed lookups replace full-table filters on hot paths.
//
// Convex auth gates are enforced at runtime inside Convex; like the
// Phase 6 suite, the guarantees below are locked as source-level guards
// that fail loudly if a privileged handler is re-opened or un-guarded.
//
// NOTE: this file intentionally contains NO backslash escapes (plain
// string searches and split-counts instead of regex literals) so the
// assertions cannot be mangled by tool escaping.
// ============================================================

const readConvex = (file: string): string =>
  readFileSync(new URL(`../convex/${file}`, import.meta.url), "utf8");

/** Extract the Convex builder kind for an exported function, or null. */
function defKind(source: string, name: string): string | null {
  const marker = `export const ${name} = `;
  const start = source.indexOf(marker);
  if (start < 0) return null;
  const rest = source.slice(start + marker.length);
  const end = rest.indexOf("(");
  return end < 0 ? null : rest.slice(0, end).trim();
}

/** Count non-overlapping occurrences of a plain substring. */
const occurrences = (source: string, needle: string): number =>
  source.split(needle).length - 1;

// ============================================================
// 1 — Stripe checkout: Pro is only granted on PAID sessions
// ============================================================

describe("shouldActivateCheckoutSession — Pro requires payment settled", () => {
  test("a paid card checkout activates Pro", () => {
    expect(shouldActivateCheckoutSession({ payment_status: "paid" })).toBe(true);
  });

  test("a completed-but-unpaid session (async method / hold) never activates", () => {
    expect(shouldActivateCheckoutSession({ payment_status: "unpaid" })).toBe(false);
  });

  test("missing payment_status never activates", () => {
    expect(shouldActivateCheckoutSession({})).toBe(false);
    expect(shouldActivateCheckoutSession({ payment_status: undefined })).toBe(false);
  });

  test("explicit no_payment / processing states never activate", () => {
    expect(shouldActivateCheckoutSession({ payment_status: "no_payment_required" })).toBe(false);
    expect(shouldActivateCheckoutSession({ payment_status: "processing" })).toBe(false);
  });
});

describe("Stripe webhook enforces the paid check before any grant", () => {
  const webhookSrc = readConvex("stripeWebhook.ts");

  test("handleCheckoutCompleted calls shouldActivateCheckoutSession before activating", () => {
    const idx = webhookSrc.indexOf("async function handleCheckoutCompleted");
    const body = webhookSrc.slice(idx, idx + 2600);
    const activateIdx = body.indexOf("internal.stripe.activateSubscription");
    const checkIdx = body.indexOf("shouldActivateCheckoutSession(session)");
    expect(checkIdx).toBeGreaterThanOrEqual(0);
    expect(activateIdx).toBeGreaterThanOrEqual(0);
    // The payment check must run BEFORE the grant path is reached.
    expect(checkIdx).toBeLessThan(activateIdx);
  });

  test("unpaid sessions are rejected with a log, not a silent grant", () => {
    expect(webhookSrc).toContain("Pro NOT activated");
    expect(webhookSrc).toContain("session.payment_status");
  });

  test("signature verification still guards the whole handler", () => {
    expect(webhookSrc).toContain("verifyStripeSignature");
    expect(webhookSrc).toContain("stripe-signature");
  });
});

// ============================================================
// 2 — Satellite analytics reads are Pro-gated server-side
// (a free/expired user cannot bypass the UI and read cached NDVI)
// ============================================================

describe("Satellite read queries are Pro-gated", () => {
  const satSrc = readConvex("satellite.ts");

  const reads = [
    "getSatelliteAnalysis",
    "getNDVIHistory",
    "getFieldBoundaries",
    "compareSeasonalVegetation",
    "detectCropStress",
  ];

  for (const name of reads) {
    test(`${name} resolves access via requireSatelliteAccess`, () => {
      const idx = satSrc.indexOf(`export const ${name}`);
      const body = satSrc.slice(idx, idx + 900);
      expect(body).toContain("requireSatelliteAccess(ctx)");
    });
  }

  test("requireSatelliteAccess enforces requireActiveSubscription (admin-exempt)", () => {
    expect(satSrc).toContain("requireActiveSubscription(ctx)");
    expect(satSrc).toContain("hasRole(user.role, ROLES.ADMIN)");
  });

  test("the generation action keeps its own Pro gate", () => {
    const idx = satSrc.indexOf("export const analyzeFarmSatellite");
    const body = satSrc.slice(idx, idx + 1400);
    expect(body).toContain("isSubscriptionActive(user)");
    expect(body).toContain("subscriptionTier !==");
  });

  test("getFieldBoundaries no longer fabricates crop zones", () => {
    const idx = satSrc.indexOf("export const getFieldBoundaries");
    const body = satSrc.slice(idx, idx + 1600);
    expect(body).not.toContain("cropZones");
  });
});

// ============================================================
// 3 — Weather actions: auth on fetch, internal for the cron
// ============================================================

describe("Weather action hardening", () => {
  const weatherSrc = readConvex("weather.ts");

  test("fetchAndCacheWeather requires an authenticated session", () => {
    const idx = weatherSrc.indexOf("export const fetchAndCacheWeather");
    const body = weatherSrc.slice(idx, idx + 1200);
    expect(body).toContain("getAuthUserId(ctx)");
    expect(body).toContain("Authentication required");
  });

  test("prefetchAllFarmWeather is an internalAction (cron-only)", () => {
    expect(defKind(weatherSrc, "prefetchAllFarmWeather")).toBe("internalAction");
  });

  test("the cron registry calls the prefetch job through internal.weather", () => {
    const cronSrc = readConvex("cron.ts");
    expect(cronSrc).toContain("internal.weather.prefetchAllFarmWeather");
    expect(occurrences(cronSrc, "api.weather.prefetchAllFarmWeather")).toBe(0);
  });
});

// ============================================================
// 4 — Unauthenticated engagement counters are closed
// ============================================================

describe("Engagement counters require authentication", () => {
  const communitySrc = readConvex("community.ts");
  const knowledgeSrc = readConvex("knowledgeArticles.ts");

  test("incrementShareCount calls requireAuth before mutating", () => {
    const idx = communitySrc.indexOf("export const incrementShareCount");
    const body = communitySrc.slice(idx, idx + 600);
    const authIdx = body.indexOf("await requireAuth(ctx)");
    const getIdx = body.indexOf("ctx.db.get(args.postId)");
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(authIdx).toBeLessThan(getIdx);
  });

  test("incrementViews calls requireAuth before mutating", () => {
    const idx = knowledgeSrc.indexOf("export const incrementViews");
    const body = knowledgeSrc.slice(idx, idx + 600);
    const authIdx = body.indexOf("await requireAuth(ctx)");
    const getIdx = body.indexOf("ctx.db.get(args.articleId)");
    expect(authIdx).toBeGreaterThanOrEqual(0);
    expect(authIdx).toBeLessThan(getIdx);
  });

  test("listPosts paginates the by_created index instead of collecting the table", () => {
    const idx = communitySrc.indexOf("export const listPosts");
    const body = communitySrc.slice(idx, idx + 2600);
    expect(body).toContain(".paginate(");
    // No unbounded full-table collect inside listPosts.
    expect(body).not.toContain(".collect()");
  });
});

// ============================================================
// 5 — Weekly report history is Pro-gated like the other report reads
// ============================================================

describe("getReportHistory is Pro-gated", () => {
  const reportSrc = readConvex("weeklyReport.ts");
  test("getReportHistory enforces requireActiveSubscription (admin-exempt)", () => {
    const idx = reportSrc.indexOf("export const getReportHistory");
    const body = reportSrc.slice(idx, idx + 900);
    expect(body).toContain("requireActiveSubscription(ctx)");
    expect(body).toContain("hasRole(user.role, ROLES.ADMIN)");
  });
});

// ============================================================
// 6 — Indexed lookups replace full-table filters on hot paths
// ============================================================

describe("Phase 7 scale — indexed lookups", () => {
  test("schema defines users.by_stripe_customer", () => {
    const schemaSrc = readConvex("schema.ts");
    expect(schemaSrc).toContain(
      '.index("by_stripe_customer", ["stripeCustomerId"])'
    );
  });

  test("getUserByStripeCustomer uses the by_stripe_customer index", () => {
    const usersSrc = readConvex("users.ts");
    const idx = usersSrc.indexOf("export const getUserByStripeCustomer");
    const body = usersSrc.slice(idx, idx + 700);
    expect(body).toContain('withIndex("by_stripe_customer"');
    expect(body).not.toContain(".filter(");
  });

  test("getUserTransactions uses the by_user index (no full-table filter)", () => {
    const momoSrc = readConvex("mobileMoney.ts");
    const idx = momoSrc.indexOf("export const getUserTransactions");
    const body = momoSrc.slice(idx, idx + 700);
    expect(body).toContain('withIndex("by_user"');
    expect(body).not.toContain(".filter(");
  });

  test("getMobileMoneyStats queries by_user index, not a table filter", () => {
    const momoSrc = readConvex("mobileMoney.ts");
    const idx = momoSrc.indexOf("export const getMobileMoneyStats");
    const body = momoSrc.slice(idx, idx + 700);
    // The DB query itself must use the index (in-memory filters on the
    // returned array for stats grouping are legitimate and expected).
    const queryStart = body.indexOf('.query("mobileMoneyTransactions")');
    expect(queryStart).toBeGreaterThanOrEqual(0);
    const queryBlock = body.slice(queryStart, queryStart + 140);
    expect(queryBlock).toContain('withIndex("by_user"');
    expect(queryBlock).not.toContain(".filter(");
  });

  test("getAiUsageCount narrows with by_user_action before the time filter", () => {
    const aiSrc = readConvex("aiAssistant.ts");
    const idx = aiSrc.indexOf("export const getAiUsageCount");
    const body = aiSrc.slice(idx, idx + 800);
    expect(body).toContain('withIndex("by_user_action"');
  });
});

// ============================================================
// Regression — previous Phase 6 guarantees still hold
// ============================================================

describe("Phase 6 guarantees remain intact", () => {
  const stripeSrc = readConvex("stripe.ts");

  test("stripe.ts still exposes NO public mutation", () => {
    // A public mutation would be declared as "= mutation({" (the
    // internal ones are "internalMutation({"), so this must be 0.
    expect(occurrences(stripeSrc, "= mutation({")).toBe(0);
  });

  test("the webhook still dispatches only through internal.stripe", () => {
    const webhookSrc = readConvex("stripeWebhook.ts");
    expect(occurrences(webhookSrc, "runMutation(api.stripe.")).toBe(0);
  });

  test("seed mutations still require an admin", () => {
    const seedSrc = readConvex("seedData.ts");
    expect(occurrences(seedSrc, "await requireAdmin(ctx)")).toBeGreaterThanOrEqual(4);
  });
});
