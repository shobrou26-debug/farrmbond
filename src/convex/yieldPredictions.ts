import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  requireAuth,
  verifyFarmOwnership,
  createAuditLog,
  sanitizeInput,
} from "./authHelpers";

// ============================================================
// Yield Prediction Queries
// ============================================================

/** Get all yield predictions for the current user. Optional pagination. */
export const listUserPredictions = query({
  args: {
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const base = ctx.db
      .query("yieldPredictions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc");

    if (args.paginationOpts) {
      return await base.paginate(args.paginationOpts);
    }

    const items = await base.collect();
    return { page: items, isDone: true, continueCursor: null };
  },
});

/** Get yield predictions for a specific crop (with ownership check). Optional pagination. */
export const listCropPredictions = query({
  args: {
    cropId: v.id("crops"),
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    // Verify the user owns this crop before returning predictions
    const crop = await ctx.db.get(args.cropId);
    if (!crop || crop.userId !== userId) {
      throw new Error("Crop not found or unauthorized");
    }

    const base = ctx.db
      .query("yieldPredictions")
      .withIndex("by_crop", (q) => q.eq("cropId", args.cropId))
      .order("desc");

    if (args.paginationOpts) {
      return await base.paginate(args.paginationOpts);
    }

    const items = await base.collect();
    return { page: items, isDone: true, continueCursor: null };
  },
});

/** Get yield predictions for a specific farm. Optional pagination. */
export const listFarmPredictions = query({
  args: {
    farmId: v.id("farms"),
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyFarmOwnership(ctx, args.farmId, userId);

    const base = ctx.db
      .query("yieldPredictions")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc");

    if (args.paginationOpts) {
      return await base.paginate(args.paginationOpts);
    }

    const items = await base.collect();
    return { page: items, isDone: true, continueCursor: null };
  },
});

// ============================================================
// Yield Prediction Mutations
// ============================================================

/** Save a new yield prediction */
export const savePrediction = mutation({
  args: {
    cropId: v.id("crops"),
    farmId: v.id("farms"),
    predictedYield: v.number(),
    unit: v.string(),
    confidence: v.number(),
    factors: v.array(
      v.object({
        name: v.string(),
        impact: v.number(),
        description: v.string(),
      })
    ),
    weatherImpact: v.optional(v.number()),
    validDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyFarmOwnership(ctx, args.farmId, userId);

    const now = Date.now();
    const validUntil = now + (args.validDays || 30) * 24 * 60 * 60 * 1000;

    const predictionId = await ctx.db.insert("yieldPredictions", {
      cropId: args.cropId,
      userId,
      farmId: args.farmId,
      predictedYield: args.predictedYield,
      unit: sanitizeInput(args.unit),
      confidence: args.confidence,
      factors: args.factors.map((f) => ({
        name: sanitizeInput(f.name),
        impact: f.impact,
        description: sanitizeInput(f.description),
      })),
      weatherImpact: args.weatherImpact,
      generatedAt: now,
      validUntil,
    });

    await createAuditLog(ctx, {
      userId,
      action: "yield_prediction_created",
      resource: "yieldPredictions",
      resourceId: predictionId,
      changes: { predictedYield: args.predictedYield, confidence: args.confidence },
    });

    return predictionId;
  },
});

// ============================================================
// Yield Prediction Model (pure, deterministic, testable)
// ============================================================

/**
 * Reference baseline yields in kg per hectare for common crops.
 * Deterministic regional reference values — NOT live external data.
 * Used by the prediction model as the starting point before applying
 * the farm's health/soil/weather adjustments.
 */
export const CROP_YIELD_BASELINES_KG_PER_HA: Record<string, number> = {
  maize: 2200,
  corn: 2200,
  beans: 1100,
  "common bean": 1100,
  wheat: 2100,
  rice: 2800,
  sorghum: 1300,
  millet: 1200,
  tomato: 25000,
  potato: 18000,
  "sweet potato": 12000,
  cassava: 11000,
  coffee: 900,
  tea: 1600,
  cabbage: 24000,
  kale: 18000,
  onion: 16000,
  avocado: 9500,
  banana: 16000,
  mango: 9500,
  groundnut: 1300,
  peanut: 1300,
  soybean: 1500,
  sunflower: 1400,
  barley: 1900,
  sugarcane: 65000,
  carrot: 22000,
  pepper: 13000,
};

/** Fallback baseline for crops without a reference entry. */
export const FALLBACK_YIELD_BASELINE = 1800;

export type YieldModelInput = {
  cropName?: string;
  healthScore?: number;
  weather?: { temperature?: number; precipitation?: number } | null;
  soil?: { ph?: number; organicMatter?: number } | null;
  areaHectares?: number;
  historicalCount?: number;
};

export type YieldModelResult = {
  predictedYield: number; // kg (total for the farm area)
  unit: string;
  confidence: number; // 0-100
  factors: Array<{ name: string; impact: number; description: string }>;
  weatherImpact: number; // -100..100
};

/**
 * Compute a yield estimate from real farm data.
 * Returns null when the available data is insufficient to produce a
 * meaningful estimate (no crop, or no valid farm area).
 */
export function estimateYieldModel(input: YieldModelInput): YieldModelResult | null {
  const { cropName, healthScore, weather, soil, areaHectares, historicalCount } = input;

  if (!cropName) return null;
  if (!areaHectares || areaHectares <= 0) return null;

  const key = cropName.toLowerCase().replace(/\s+/g, " ").trim();
  const baseline = CROP_YIELD_BASELINES_KG_PER_HA[key] ?? FALLBACK_YIELD_BASELINE;

  const factors: Array<{ name: string; impact: number; description: string }> = [];
  let confidence = 55;

  // Crop health adjustment
  let healthFactor = 1;
  if (healthScore !== undefined) {
    healthFactor = Math.min(1.1, Math.max(0.5, healthScore / 80));
    factors.push({
      name: "Crop health",
      impact: Math.round((healthFactor - 1) * 100),
      description: `Current health score ${healthScore}/100`,
    });
    confidence += 5;
  }

  // Soil adjustments (from the soil analysis record, or location estimate)
  let soilFactor = 1;
  if (soil) {
    if (soil.ph !== undefined) {
      const phFactor = soil.ph >= 5.5 && soil.ph <= 7.2 ? 1 : 0.85;
      soilFactor *= phFactor;
      factors.push({
        name: "Soil pH",
        impact: Math.round((phFactor - 1) * 100),
        description: `pH ${soil.ph}`,
      });
    }
    if (soil.organicMatter !== undefined) {
      const omFactor = soil.organicMatter >= 3 ? 1.05 : soil.organicMatter >= 2 ? 1 : 0.9;
      soilFactor *= omFactor;
      factors.push({
        name: "Soil organic matter",
        impact: Math.round((omFactor - 1) * 100),
        description: `${soil.organicMatter}% organic matter`,
      });
    }
    confidence += 15;
  }

  // Weather adjustments (from cached Open-Meteo data)
  let weatherFactor = 1;
  if (weather) {
    if (weather.temperature !== undefined) {
      const t = weather.temperature;
      const tempFactor = t >= 15 && t <= 30 ? 1 : t >= 10 && t <= 35 ? 0.9 : 0.8;
      weatherFactor *= tempFactor;
      factors.push({
        name: "Temperature",
        impact: Math.round((tempFactor - 1) * 100),
        description: `${t}°C`,
      });
    }
    if (weather.precipitation !== undefined) {
      const p = weather.precipitation;
      const rainFactor = p >= 2 && p <= 8 ? 1 : p < 1 ? 0.85 : p > 20 ? 0.85 : 0.95;
      weatherFactor *= rainFactor;
      factors.push({
        name: "Rainfall",
        impact: Math.round((rainFactor - 1) * 100),
        description: `${p}mm`,
      });
    }
    confidence += 15;
  }

  // Prior predictions for this crop boost confidence
  if (historicalCount && historicalCount > 0) confidence += 10;

  const combined = healthFactor * soilFactor * weatherFactor;
  const predictedYield = baseline * areaHectares * combined;

  return {
    predictedYield,
    unit: "kg",
    confidence: Math.min(95, Math.max(20, confidence)),
    factors,
    weatherImpact: Math.round((weatherFactor - 1) * 100),
  };
}

/**
 * Whether the user has exceeded the per-hour prediction rate limit.
 * Pure helper — testable.
 */
export function exceedsPredictionRateLimit(
  predictions: Array<{ generatedAt?: number; createdAt?: number }>,
  now: number,
  maxPerHour = 5
): boolean {
  const hourAgo = now - 60 * 60 * 1000;
  return predictions.filter((p) => (p.generatedAt ?? p.createdAt ?? 0) > hourAgo).length >= maxPerHour;
}

// ============================================================
// Yield Prediction Generation (action)
// ============================================================

/**
 * Generate a yield prediction for a crop using real farm data:
 * crop record, farm size, cached weather, soil analysis, and any
 * prior predictions. The estimate is produced by the deterministic
 * FarmBond yield model (see estimateYieldModel) and persisted via
 * savePrediction. Returns an explicit insufficient-data result when
 * the required inputs are missing — no fabricated values.
 *
 * The handler return type is annotated explicitly to keep the
 * generated API typings non-circular (action calls functions in its
 * own module).
 */
export const generateYieldPrediction = action({
  args: {
    // Plain strings: ownership is enforced server-side via getCrop/getFarm,
    // never trusted from the client.
    cropId: v.string(),
    farmId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ ok: true; predictionId: string } | { ok: false; reason: string }> => {
    // Resolve identity from the authenticated session (never trust
    // a frontend-supplied userId).
    const user = (await ctx.runQuery(api.users.currentUser)) as {
      _id: string;
    } | null;
    if (!user) throw new Error("Unauthorized");
    const userId = user._id;

    // Ownership + existence checks (server-side)
    const crop = (await ctx.runQuery(api.crops.getCrop, {
      cropId: args.cropId as Id<"crops">,
    })) as { name: string; farmId: string; healthScore?: number } | null;
    const farm = (await ctx.runQuery(api.farms.getFarm, {
      farmId: args.farmId as Id<"farms">,
    })) as {
      size: number;
      sizeUnit?: string;
      location?: { latitude: number; longitude: number } | null;
    } | null;
    if (!crop || !farm) {
      return { ok: false, reason: "Crop or farm not found, or you don't have access to it." };
    }
    if (crop.farmId !== args.farmId) {
      return { ok: false, reason: "The selected crop does not belong to the selected farm." };
    }

    // Rate limit: max 5 generations per hour per user
    const existing = (await ctx.runQuery(
      api.yieldPredictions.listUserPredictions,
      {}
    )) as unknown as { page: Array<{ generatedAt: number }> };
    const existingRows = existing.page ?? [];
    if (exceedsPredictionRateLimit(existingRows, Date.now())) {
      throw new Error("Rate limit reached — maximum 5 yield predictions per hour. Please try again later.");
    }

    // Historical predictions for this crop (confidence boost)
    const history = (await ctx.runQuery(api.yieldPredictions.listCropPredictions, {
      cropId: args.cropId as Id<"crops">,
    })) as unknown as { page: Array<unknown> };
    const historicalCount = history.page?.length ?? 0;

    // Cached weather for the farm location
    let weather: { temperature?: number; precipitation?: number } | null = null;
    if (farm.location) {
      try {
        const cached = (await ctx.runQuery(api.weather.getCachedWeather, {
          latitude: farm.location.latitude,
          longitude: farm.location.longitude,
        })) as { temperature?: number; precipitation?: number } | null;
        if (cached) {
          weather = {
            temperature: cached.temperature,
            precipitation: cached.precipitation,
          };
        }
      } catch {
        weather = null; // Weather is optional — model still runs
      }
    }

    // Soil analysis
    let soil: { ph?: number; organicMatter?: number } | null = null;
    try {
      const analysis = (await ctx.runQuery(api.soil.getSoilAnalysis, {
        farmId: args.farmId as Id<"farms">,
      })) as { ph?: number; organicMatter?: number } | null;
      if (analysis) {
        soil = {
          ph: analysis.ph,
          organicMatter: analysis.organicMatter,
        };
      }
    } catch {
      soil = null;
    }

    const areaHectares =
      farm.sizeUnit === "acres" ? farm.size * 0.404686 : farm.size;

    const estimate = estimateYieldModel({
      cropName: crop.name,
      healthScore: crop.healthScore,
      weather,
      soil,
      areaHectares,
      historicalCount,
    });

    if (!estimate) {
      return {
        ok: false,
        reason:
          "Not enough data to generate a prediction. Make sure the crop has a name and the farm has a valid size (hectares or acres).",
      };
    }

    // Validate the model result before persisting
    if (!(estimate.predictedYield > 0) || estimate.confidence < 0 || estimate.confidence > 100) {
      return { ok: false, reason: "The prediction model returned an invalid result. Please try again." };
    }

    const predictionId = (await ctx.runMutation(api.yieldPredictions.savePrediction, {
      cropId: args.cropId as Id<"crops">,
      farmId: args.farmId as Id<"farms">,
      predictedYield: Math.round(estimate.predictedYield * 100) / 100,
      unit: estimate.unit,
      confidence: Math.round(estimate.confidence),
      factors: estimate.factors,
      weatherImpact: estimate.weatherImpact,
      validDays: 30,
    })) as string;

    return { ok: true, predictionId };
  },
});
