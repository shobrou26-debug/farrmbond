import { describe, expect, test } from "bun:test";
import {
  estimateYieldModel,
  exceedsPredictionRateLimit,
  CROP_YIELD_BASELINES_KG_PER_HA,
  FALLBACK_YIELD_BASELINE,
  type YieldModelInput,
} from "../convex/yieldPredictions";

// ============================================================
// estimateYieldModel — deterministic model, no fabricated values
// ============================================================
describe("estimateYieldModel", () => {
  test("returns null when no crop name is available (insufficient data)", () => {
    const result = estimateYieldModel({
      areaHectares: 1,
    });
    expect(result).toBeNull();
  });

  test("returns null when the farm has no valid area (insufficient data)", () => {
    expect(estimateYieldModel({ cropName: "maize" })).toBeNull();
    expect(estimateYieldModel({ cropName: "maize", areaHectares: 0 })).toBeNull();
    expect(estimateYieldModel({ cropName: "maize", areaHectares: -2 })).toBeNull();
  });

  test("uses the crop baseline for a known crop with no modifiers", () => {
    const result = estimateYieldModel({ cropName: "maize", areaHectares: 1 });
    expect(result).not.toBeNull();
    expect(result!.predictedYield).toBeCloseTo(CROP_YIELD_BASELINES_KG_PER_HA.maize, 5);
    expect(result!.unit).toBe("kg");
  });

  test("uses the fallback baseline for an unknown crop", () => {
    const result = estimateYieldModel({ cropName: "dragonfruit", areaHectares: 1 });
    expect(result!.predictedYield).toBeCloseTo(FALLBACK_YIELD_BASELINE, 5);
  });

  test("scales yield by farm area", () => {
    const oneHa = estimateYieldModel({ cropName: "maize", areaHectares: 1 })!;
    const threeHa = estimateYieldModel({ cropName: "maize", areaHectares: 3 })!;
    expect(threeHa.predictedYield).toBeCloseTo(oneHa.predictedYield * 3, 5);
  });

  test("healthy crop health boosts the estimate", () => {
    const base = estimateYieldModel({ cropName: "maize", areaHectares: 1 })!;
    const healthy = estimateYieldModel({
      cropName: "maize",
      areaHectares: 1,
      healthScore: 95,
    })!;
    expect(healthy.predictedYield).toBeGreaterThan(base.predictedYield);
    // healthScore 95 → factor min(1.1, 95/80) = 1.1
    expect(healthy.predictedYield).toBeCloseTo(base.predictedYield * 1.1, 5);
  });

  test("poor crop health reduces the estimate", () => {
    const base = estimateYieldModel({ cropName: "maize", areaHectares: 1 })!;
    const poor = estimateYieldModel({
      cropName: "maize",
      areaHectares: 1,
      healthScore: 40,
    })!;
    expect(poor.predictedYield).toBeLessThan(base.predictedYield);
  });

  test("unfavorable soil pH reduces the estimate", () => {
    const base = estimateYieldModel({ cropName: "maize", areaHectares: 1 })!;
    const acidic = estimateYieldModel({
      cropName: "maize",
      areaHectares: 1,
      soil: { ph: 4.5, organicMatter: 2 },
    })!;
    expect(acidic.predictedYield).toBeLessThan(base.predictedYield);
  });

  test("unfavorable weather reduces the estimate", () => {
    const base = estimateYieldModel({ cropName: "maize", areaHectares: 1 })!;
    const hot = estimateYieldModel({
      cropName: "maize",
      areaHectares: 1,
      weather: { temperature: 42, precipitation: 0 },
    })!;
    expect(hot.predictedYield).toBeLessThan(base.predictedYield);
    expect(hot.weatherImpact).toBeLessThan(0);
  });

  test("factors describe the data that drove the estimate", () => {
    const result = estimateYieldModel({
      cropName: "maize",
      areaHectares: 1,
      healthScore: 90,
      soil: { ph: 6.5, organicMatter: 4 },
      weather: { temperature: 24, precipitation: 5 },
    })!;
    expect(result.factors.length).toBeGreaterThanOrEqual(3);
    const names = result.factors.map((f) => f.name);
    expect(names).toContain("Crop health");
    expect(names).toContain("Soil pH");
    expect(names).toContain("Temperature");
    for (const f of result.factors) {
      expect(f.description).toBeTruthy();
      expect(typeof f.impact).toBe("number");
    }
  });

  test("confidence stays within [20, 95] and rises with richer data", () => {
    const bare = estimateYieldModel({ cropName: "maize", areaHectares: 1 })!;
    const rich = estimateYieldModel({
      cropName: "maize",
      areaHectares: 1,
      healthScore: 90,
      soil: { ph: 6.5, organicMatter: 4 },
      weather: { temperature: 24, precipitation: 5 },
      historicalCount: 3,
    })!;
    expect(bare.confidence).toBeGreaterThanOrEqual(20);
    expect(rich.confidence).toBeLessThanOrEqual(95);
    expect(rich.confidence).toBeGreaterThan(bare.confidence);
  });

  test("is deterministic for identical inputs", () => {
    const input: YieldModelInput = {
      cropName: "maize",
      areaHectares: 2.5,
      healthScore: 82,
      soil: { ph: 6.2, organicMatter: 3.5 },
      weather: { temperature: 26, precipitation: 4 },
      historicalCount: 2,
    };
    const a = estimateYieldModel(input)!;
    const b = estimateYieldModel(input)!;
    expect(a.predictedYield).toBe(b.predictedYield);
    expect(a.factors).toEqual(b.factors);
    expect(a.confidence).toBe(b.confidence);
  });
});

// ============================================================
// exceedsPredictionRateLimit — per-hour generation cap
// ============================================================
describe("exceedsPredictionRateLimit", () => {
  const now = Date.now();
  const hour = 60 * 60 * 1000;

  test("allows generation when nothing has been generated", () => {
    expect(exceedsPredictionRateLimit([], now)).toBe(false);
  });

  test("allows generation below the hourly cap", () => {
    const predictions = [1, 2, 3, 4].map((i) => ({ generatedAt: now - i * 1000 }));
    expect(exceedsPredictionRateLimit(predictions, now)).toBe(false);
  });

  test("blocks generation at the hourly cap", () => {
    const predictions = [1, 2, 3, 4, 5].map((i) => ({ generatedAt: now - i * 1000 }));
    expect(exceedsPredictionRateLimit(predictions, now)).toBe(true);
  });

  test("ignores predictions older than one hour", () => {
    const recent = [1, 2, 3].map((i) => ({ generatedAt: now - i * 1000 }));
    const old = [1, 2, 3, 4].map((i) => ({ generatedAt: now - (i + 3) * hour }));
    expect(exceedsPredictionRateLimit([...recent, ...old], now)).toBe(false);
  });

  test("supports a custom cap", () => {
    const predictions = [1, 2].map((i) => ({ generatedAt: now - i * 1000 }));
    expect(exceedsPredictionRateLimit(predictions, now, 2)).toBe(true);
    expect(exceedsPredictionRateLimit(predictions, now, 3)).toBe(false);
  });
});
