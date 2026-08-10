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

describe("Phase 9 — intelligence/detection/chart honesty", () => {
  const intelSrc = readConvex("intelligence.ts");
  const schemaSrc = readConvex("schema.ts");
  const detSrc = readConvex("detectionResults.ts");

  const readPage = (path: string): string =>
    readFileSync(new URL(`../pages/${path}`, import.meta.url), "utf8");

  test("intelligence never treats a missing NDVI measurement as vegetation stress", () => {
    const body = sliceFrom(intelSrc, "Cross-reference: Satellite + Crops", 800);
    expect(body).toContain("satelliteData.ndvi != null");
    expect(body).not.toContain("satelliteData.ndvi ?? 0");
  });

  test("disease detection stores no fabricated confidence (75 fallback removed)", () => {
    const page = readPage("DiseaseDetection.tsx");
    expect(page).toContain('confidence: typeof parsed.confidence === "number"');
    expect(occurrences(page, "parsed.confidence || 75")).toBe(0);
    expect(page).toContain("confidence: number | null");
    // The AI prompt returns textual confidence (High/Medium/Low), so numeric
    // renders must be guarded — a string must never render as "High%".
    expect(page).toContain("result.confidence !== null");
  });

  test("detection confidence is optional in schema and save validator", () => {
    const schemaBody = sliceFrom(schemaSrc, "detectionResults: defineTable", 500);
    expect(schemaBody).toContain("confidence: v.optional(v.number())");
    const saveBody = sliceFrom(detSrc, "export const saveDetection", 500);
    expect(saveBody).toContain("confidence: v.optional(v.number())");
  });

  test("FarmComparison charts never plot a fabricated 0 for missing soil/NDVI", () => {
    const page = readPage("FarmComparison.tsx");
    // MetricBar accepts null and renders an honest "No data" row.
    expect(page).toContain("value: number | null");
    expect(page).toContain("No data");
    const ndviBar = sliceFrom(page, 'label="Vegetation Index (NDVI)"', 400);
    expect(ndviBar).not.toContain("?? 0");
    const soilBar = sliceFrom(page, 'label="Soil Health (from pH)"', 400);
    expect(soilBar).not.toContain("?? 0");
  });
});

describe("Phase 9 — final adversarial audit locks", () => {
  const readPage = (path: string): string =>
    readFileSync(new URL(`../pages/${path}`, import.meta.url), "utf8");
  const readHook = (path: string): string =>
    readFileSync(new URL(`../hooks/${path}`, import.meta.url), "utf8");

  test("disease detection never invents a severity (medium fallback removed)", () => {
    const page = readPage("DiseaseDetection.tsx");
    expect(occurrences(page, 'parsed.severity || "medium"')).toBe(0);
    expect(page).toContain('severity: "low" | "medium" | "high" | "critical" | null');
    expect(page).toContain("Not Assessed");
    // Missing severity is persisted as absent, never as a fabricated value.
    expect(page).toContain("severity: detectionResult.severity ?? undefined");
  });

  test("detection severity is optional in schema and save validator", () => {
    const schemaBody = sliceFrom(readConvex("schema.ts"), "detectionResults: defineTable", 1400);
    expect(schemaBody).toContain("severity: v.optional(v.union(");
    const saveBody = sliceFrom(readConvex("detectionResults.ts"), "export const saveDetection", 1200);
    expect(saveBody).toContain("severity: v.optional(");
  });

  test("AI disease prompt returns strict JSON, not markdown (runtime contract)", () => {
    const body = sliceFrom(readConvex("aiAssistant.ts"), "export const detectDisease", 4000);
    expect(body).toContain("Respond with ONLY a single valid JSON object");
    expect(body).toContain('responseMimeType: "application/json"');
    expect(body).toContain("severity must be one of the lowercase values");
  });

  test("yield prediction never invents a 70% weather impact or a 1.1x target", () => {
    const page = readPage("YieldPrediction.tsx");
    expect(occurrences(page, "p.weatherImpact || 70")).toBe(0);
    expect(occurrences(page, "p.predictedYield * 1.1")).toBe(0);
    expect(page).toContain('typeof p.weatherImpact === "number"');
    expect(page).toContain('typeof crop?.expectedYield === "number"');
    expect(page).toContain("weatherImpact: number | null");
    expect(page).toContain("targetYield: number | null");
  });

  test("yield weather impact is normalized to the 0-100 display scale", () => {
    const page = readPage("YieldPrediction.tsx");
    expect(page).toContain("(p.weatherImpact + 100) / 2");
  });

  test("weather page labels the default region honestly and supports geolocation opt-in", () => {
    const hook = readHook("use-weather.ts");
    expect(hook).toContain("isDefaultLocation");
    const page = readPage("Weather.tsx");
    expect(page).toContain("Default region — enable location for your area");
    expect(page).toContain("Use my location");
  });
});
