import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";

// ============================================================
// Phase 9 — Production launch-readiness regression tests
//
// Locks (source-level, matching the repository's established
// convention for Convex runtime gates):
//   1. NDVI honesty — getNDVIHistory charts missing measurements as
//      null, never as a fabricated 0; detectCropStress refuses to
//      diagnose a record that has no NDVI/NDWI measurement; the
//      analysis trend series only ever contains real measurements.
//   2. Payment invariants (re-locked after Phase 6/8) — subscription
//      state mutations are internal-only, consultation settlement is
//      internal-only and reached through the verified webhook path,
//      and mobile-money webhooks verify a signature and fail closed.
// ============================================================

const readConvex = (file: string): string =>
  readFileSync(new URL(`../convex/${file}`, import.meta.url), "utf8");

function occurrences(src: string, needle: string): number {
  let count = 0;
  let idx = src.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = src.indexOf(needle, idx + needle.length);
  }
  return count;
}

function sliceFrom(src: string, marker: string, length: number): string {
  const idx = src.indexOf(marker);
  return idx === -1 ? "" : src.slice(idx, idx + length);
}

describe("Phase 9 — NDVI data honesty", () => {
  const satSrc = readConvex("satellite.ts");

  test("getNDVIHistory maps missing NDVI/NDWI to null, never 0", () => {
    const body = sliceFrom(satSrc, "export const getNDVIHistory", 900);
    expect(body).toContain("ndvi: d.ndvi ?? null");
    expect(body).toContain("ndwi: d.ndwi ?? null");
    expect(body).not.toContain("ndvi: d.ndvi ?? 0");
  });

  test("detectCropStress refuses to diagnose records without measurements", () => {
    const body = sliceFrom(satSrc, "export const detectCropStress", 1000);
    expect(body).toContain(
      "if (satelliteData.ndvi == null || satelliteData.ndwi == null) return null;"
    );
    // The fabricated 0-based diagnosis path is gone.
    expect(body).not.toContain("satelliteData.ndvi ?? 0");
  });

  test("getSatelliteAnalysis trend contains only real measurements", () => {
    const body = sliceFrom(satSrc, "export const getSatelliteAnalysis", 1800);
    expect(body).toContain(".filter((d) => d.ndvi != null)");
    expect(body).toContain("currentNDVI = satelliteData?.ndvi ?? null");
  });
});

describe("Phase 9 — payment/webhook invariants (re-lock)", () => {
  const stripeSrc = readConvex("stripe.ts");
  const mmSrc = readConvex("mobileMoney.ts");
  const mmWebhook = readConvex("mobileMoneyWebhook.ts");

  test("stripe.ts exposes NO public subscription-state mutation", () => {
    expect(occurrences(stripeSrc, "= mutation({")).toBe(0);
    for (const name of [
      "activateSubscription",
      "renewSubscription",
      "handlePaymentFailure",
      "updateSubscriptionStatus",
      "cancelSubscriptionMutation",
    ]) {
      const idx = stripeSrc.indexOf(`export const ${name} = internalMutation({`);
      expect(idx).toBeGreaterThanOrEqual(0);
    }
  });

  test("consultation settlement is internal-only and webhook-dispatched", () => {
    expect(mmSrc).toContain("export const settleConsultationPayment = internalMutation({");
    expect(mmSrc).toContain("export const updateTransactionStatus = internalMutation({");
    const dispatch = sliceFrom(
      mmSrc,
      "settleConsultationPayment, {",
      400
    );
    // Settlement is invoked from within the internal transaction-update path,
    // which is reachable only from the signature-verified webhook handler.
    expect(dispatch.length).toBeGreaterThan(0);
  });

  test("mobile-money webhook verifies a signature and fails closed", () => {
    expect(mmWebhook).toContain("verifyWebhookSignature");
    expect(mmWebhook).toContain("Invalid signature");
    expect(mmWebhook).toContain("x-farmbond-signature");
    // No secret configured -> endpoint refuses to process (fail closed).
    expect(mmWebhook).toContain("503");
  });

  test("stripe webhook verifies the signature and rejects invalid ones", () => {
    const webhook = readConvex("stripeWebhook.ts");
    expect(webhook).toContain("verifyStripeSignature");
    expect(webhook).toContain("Invalid signature");
    expect(webhook).toContain("stripe-signature");
  });
});

describe("Phase 9 — crop/livestock health-score honesty", () => {
  const cropsSrc = readConvex("crops.ts");
  const liveSrc = readConvex("livestock.ts");
  const farmsSrc = readConvex("farms.ts");

  const readPage = (path: string): string =>
    readFileSync(new URL(`../pages/${path}`, import.meta.url), "utf8");

  test("createCrop no longer fabricates a 100 health score", () => {
    expect(occurrences(cropsSrc, "healthScore: 100")).toBe(0);
  });

  test("createLivestock no longer fabricates a 100 health score", () => {
    expect(occurrences(liveSrc, "healthScore: 100")).toBe(0);
  });

  test("farm crop-health metric averages only scored crops (never 0)", () => {
    expect(farmsSrc).toContain('activeCrops.filter((c) => typeof c.healthScore === "number")');
    // Averages over unscored crops must not be treated as 0.
    expect(occurrences(farmsSrc, "c.healthScore || 0")).toBe(0);
  });

  test("Livestock page never displays a fabricated default health score", () => {
    const page = readPage("Livestock.tsx");
    expect(occurrences(page, "healthScore ?? 100")).toBe(0);
    expect(page).toContain("No score yet");
  });

  test("Crops page never displays 0% for an unscored crop", () => {
    const page = readPage("Crops.tsx");
    expect(occurrences(page, "healthScore || 0")).toBe(0);
    expect(page).toContain("No score yet");
  });

  test("Analytics page never displays 0% for an unscored crop", () => {
    const page = readPage("Analytics.tsx");
    expect(occurrences(page, "healthScore || 0")).toBe(0);
    expect(page).toContain("No score yet");
  });
});
