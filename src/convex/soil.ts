import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, validateNumber } from "./authHelpers";

// ============================================================
// Soil Intelligence Module
// ============================================================
//
// DATA HONESTY:
// - getSoilAnalysis returns null when no real soil record exists.
//   It NEVER fabricates pH / nutrient / moisture values.
// - getCropSoilRecommendations explicitly reports when soil data
//   is missing instead of comparing against invented defaults.
// - Only farmer-entered lab/field records (storeSoilData) or real
//   backend soil records produce numeric soil values.

// ============================================================
// Pure, testable soil helpers
// ============================================================

export type FertilityRating = "high" | "moderate" | "low";

/** Classify fertility from a REAL pH + organic matter record. */
export function rateFertility(ph: number, organicMatter: number): FertilityRating {
  // Extreme pH (strongly acidic or strongly alkaline) limits nutrient
  // availability regardless of organic matter, so it caps the rating.
  if (ph < 5.5 || ph > 7.5) return "low";
  if (ph >= 6 && ph <= 7 && organicMatter > 3) return "high";
  if (organicMatter > 2) return "moderate";
  return "low";
}

export type SoilRecommendation = {
  issue: string;
  action: string;
  priority: "high" | "medium" | "low";
};

/** Derive amendment recommendations from a REAL soil record only. */
export function buildSoilRecommendations(input: {
  ph: number;
  organicMatter: number;
  phosphorus: number;
  potassium: number;
}): SoilRecommendation[] {
  const recommendations: SoilRecommendation[] = [];

  if (input.ph < 5.5) {
    recommendations.push({
      issue: "Soil too acidic",
      action: "Apply agricultural lime at 2 tons/acre",
      priority: "high",
    });
  }
  if (input.ph > 7.5) {
    recommendations.push({
      issue: "Soil too alkaline",
      action: "Apply sulfur or organic matter to lower pH",
      priority: "high",
    });
  }
  if (input.organicMatter < 2) {
    recommendations.push({
      issue: "Low organic matter",
      action: "Add compost, cover crops, or manure",
      priority: "medium",
    });
  }
  if (input.phosphorus < 10) {
    recommendations.push({
      issue: "Low phosphorus",
      action: "Apply DAP or bone meal fertilizer",
      priority: "medium",
    });
  }
  if (input.potassium < 150) {
    recommendations.push({
      issue: "Low potassium",
      action: "Apply MOP or wood ash",
      priority: "low",
    });
  }

  return recommendations;
}

export type CropSoilIdeal = {
  ph: [number, number];
  organicMatter: number;
  nitrogen: number;
};

export type CropSoilIssue = {
  issue: string;
  current: string;
  ideal: string;
  action: string;
};

/** Ideal soil conditions by crop type (static agronomic reference data). */
export const CROP_SOIL_IDEALS: Record<string, CropSoilIdeal> = {
  maize: { ph: [5.8, 7.0], organicMatter: 3, nitrogen: 0.15 },
  wheat: { ph: [6.0, 7.5], organicMatter: 2.5, nitrogen: 0.12 },
  tomato: { ph: [6.0, 6.8], organicMatter: 3.5, nitrogen: 0.18 },
  coffee: { ph: [6.0, 6.5], organicMatter: 4, nitrogen: 0.2 },
  tea: { ph: [4.5, 5.5], organicMatter: 4.5, nitrogen: 0.25 },
  beans: { ph: [6.0, 7.0], organicMatter: 2.5, nitrogen: 0.1 },
  potato: { ph: [5.0, 6.0], organicMatter: 3, nitrogen: 0.15 },
};

/**
 * Compare a REAL soil record against a crop's ideal range.
 * Never called with invented values — callers guard on soil existence.
 */
export function evaluateCropSoilSuitability(
  ideal: CropSoilIdeal,
  current: { ph: number; organicMatter: number; nitrogen: number }
): CropSoilIssue[] {
  const issues: CropSoilIssue[] = [];

  if (current.ph < ideal.ph[0]) {
    issues.push({
      issue: "pH too low",
      current: current.ph.toFixed(1),
      ideal: `${ideal.ph[0]}-${ideal.ph[1]}`,
      action: "Apply lime to raise pH",
    });
  }
  if (current.ph > ideal.ph[1]) {
    issues.push({
      issue: "pH too high",
      current: current.ph.toFixed(1),
      ideal: `${ideal.ph[0]}-${ideal.ph[1]}`,
      action: "Apply sulfur or acidic organic matter",
    });
  }
  if (current.organicMatter < ideal.organicMatter) {
    issues.push({
      issue: "Organic matter low",
      current: `${current.organicMatter}%`,
      ideal: `>${ideal.organicMatter}%`,
      action: "Add compost or green manure",
    });
  }
  if (current.nitrogen < ideal.nitrogen) {
    issues.push({
      issue: "Nitrogen low",
      current: `${current.nitrogen}%`,
      ideal: `>${ideal.nitrogen}%`,
      action: "Apply nitrogen fertilizer or plant legumes",
    });
  }

  return issues;
}

// ============================================================
// Soil Queries
// ============================================================

/**
 * Get soil analysis for a farm.
 *
 * Returns null when no real soil record exists for the farm. No
 * fabricated/estimated values are ever produced — the UI is expected
 * to show an explicit "no soil analysis" state instead of invented
 * pH or moisture readings.
 */
export const getSoilAnalysis = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    const soilData = await ctx.db
      .query("soilData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .first();

    if (!soilData) return null; // No record → no analysis (honest)

    const isEstimated =
      soilData.source === "estimated" || soilData.source === "soilgrids";

    return {
      farmId: args.farmId,
      ph: soilData.ph,
      organicMatter: soilData.organicMatter,
      nitrogen: soilData.nitrogen,
      phosphorus: soilData.phosphorus,
      potassium: soilData.potassium,
      soilMoisture: soilData.soilMoisture,
      drainage: soilData.drainage,
      texture: soilData.texture,
      fertility: rateFertility(soilData.ph, soilData.organicMatter),
      source: soilData.source ?? "user_entered",
      isEstimated,
      lastUpdated: soilData.fetchedAt,
      recommendations: buildSoilRecommendations(soilData),
    };
  },
});

/**
 * Get crop-specific soil recommendations.
 *
 * When no real soil record exists the result explicitly reports
 * `hasSoilData: false` with `isSuitable: null` — suitability is never
 * evaluated against invented default soil values.
 */
export const getCropSoilRecommendations = query({
  args: {
    farmId: v.id("farms"),
    cropType: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    const soilData = await ctx.db
      .query("soilData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .first();

    const ideal =
      CROP_SOIL_IDEALS[args.cropType.toLowerCase()] || CROP_SOIL_IDEALS.maize;

    if (!soilData) {
      return {
        cropType: args.cropType,
        hasSoilData: false,
        idealConditions: ideal,
        currentConditions: null,
        issues: [],
        isSuitable: null,
      };
    }

    const current = {
      ph: soilData.ph,
      organicMatter: soilData.organicMatter,
      nitrogen: soilData.nitrogen,
    };

    const issues = evaluateCropSoilSuitability(ideal, current);

    return {
      cropType: args.cropType,
      hasSoilData: true,
      idealConditions: ideal,
      currentConditions: current,
      issues,
      isSuitable: issues.length === 0,
    };
  },
});

// ============================================================
// Soil Mutations
// ============================================================

/**
 * Store farmer-entered lab/field soil data.
 * Validates every numeric input server-side (never trusts the client)
 * and computes the fertility rating from the actual values.
 */
export const storeSoilData = mutation({
  args: {
    farmId: v.id("farms"),
    ph: v.number(),
    organicMatter: v.number(),
    nitrogen: v.number(),
    phosphorus: v.number(),
    potassium: v.number(),
    soilMoisture: v.number(),
    drainage: v.string(),
    texture: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) throw new Error("Unauthorized");

    // Server-side input validation
    validateNumber(args.ph, "Soil pH", 0, 14);
    validateNumber(args.organicMatter, "Organic matter", 0, 50);
    validateNumber(args.nitrogen, "Nitrogen", 0, 5);
    validateNumber(args.phosphorus, "Phosphorus", 0, 500);
    validateNumber(args.potassium, "Potassium", 0, 2000);
    validateNumber(args.soilMoisture, "Soil moisture", 0, 100);
    if (!args.drainage.trim() || !args.texture.trim()) {
      throw new Error("Drainage and texture are required");
    }

    await ctx.db.insert("soilData", {
      farmId: args.farmId,
      userId,
      ph: args.ph,
      organicMatter: args.organicMatter,
      nitrogen: args.nitrogen,
      phosphorus: args.phosphorus,
      potassium: args.potassium,
      soilMoisture: args.soilMoisture,
      drainage: args.drainage.trim(),
      texture: args.texture.trim(),
      fetchedAt: Date.now(),
      source: "user_entered", // Lab/field data entered by the farmer
      fertility: rateFertility(args.ph, args.organicMatter),
    });

    return true;
  },
});
