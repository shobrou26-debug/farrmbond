import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { requireAuth } from "./authHelpers";

// ============================================================
// Soil Intelligence Module
// ============================================================

/** Get soil analysis for a farm */
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

    if (!soilData) {
      // Generate default soil data based on location
      const lat = farm.location?.latitude ?? -1.2921;
      const lon = farm.location?.longitude ?? 36.8219;

      // Simulate SoilGrids data based on region
      const isHighland = lat > -1.5 && lat < 0;
      return {
        farmId: args.farmId,
        ph: isHighland ? 6.2 : 5.8,
        organicMatter: isHighland ? 3.5 : 2.8,
        nitrogen: isHighland ? 0.18 : 0.12,
        phosphorus: isHighland ? 15 : 8,
        potassium: isHighland ? 180 : 120,
        soilMoisture: 45,
        drainage: "moderate",
        texture: "loam",
        fertility: isHighland ? "high" : "moderate",
        lastUpdated: null,
        recommendations: [],
      };
    }

    // Calculate fertility rating
    let fertility = "low";
    if (soilData.ph >= 6 && soilData.ph <= 7 && soilData.organicMatter > 3) {
      fertility = "high";
    } else if (soilData.ph >= 5.5 && soilData.organicMatter > 2) {
      fertility = "moderate";
    }

    // Generate recommendations
    const recommendations: Array<{ issue: string; action: string; priority: string }> = [];

    if (soilData.ph < 5.5) {
      recommendations.push({
        issue: "Soil too acidic",
        action: "Apply agricultural lime at 2 tons/acre",
        priority: "high",
      });
    }
    if (soilData.ph > 7.5) {
      recommendations.push({
        issue: "Soil too alkaline",
        action: "Apply sulfur or organic matter to lower pH",
        priority: "high",
      });
    }
    if (soilData.organicMatter < 2) {
      recommendations.push({
        issue: "Low organic matter",
        action: "Add compost, cover crops, or manure",
        priority: "medium",
      });
    }
    if (soilData.phosphorus < 10) {
      recommendations.push({
        issue: "Low phosphorus",
        action: "Apply DAP or bone meal fertilizer",
        priority: "medium",
      });
    }
    if (soilData.potassium < 150) {
      recommendations.push({
        issue: "Low potassium",
        action: "Apply MOP or wood ash",
        priority: "low",
      });
    }

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
      fertility,
      lastUpdated: soilData.fetchedAt,
      recommendations,
    };
  },
});

/** Get crop-specific soil recommendations */
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

    // Ideal soil conditions by crop type
    const idealConditions: Record<string, { ph: [number, number]; organicMatter: number; nitrogen: number }> = {
      maize: { ph: [5.8, 7.0], organicMatter: 3, nitrogen: 0.15 },
      wheat: { ph: [6.0, 7.5], organicMatter: 2.5, nitrogen: 0.12 },
      tomato: { ph: [6.0, 6.8], organicMatter: 3.5, nitrogen: 0.18 },
      coffee: { ph: [6.0, 6.5], organicMatter: 4, nitrogen: 0.2 },
      tea: { ph: [4.5, 5.5], organicMatter: 4.5, nitrogen: 0.25 },
      beans: { ph: [6.0, 7.0], organicMatter: 2.5, nitrogen: 0.1 },
      potato: { ph: [5.0, 6.0], organicMatter: 3, nitrogen: 0.15 },
    };

    const ideal = idealConditions[args.cropType.toLowerCase()] || idealConditions.maize;
    const current = soilData || { ph: 6.0, organicMatter: 3, nitrogen: 0.15, phosphorus: 12, potassium: 150 };

    const issues: Array<{ issue: string; current: string; ideal: string; action: string }> = [];

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

    return {
      cropType: args.cropType,
      idealConditions: ideal,
      currentConditions: current,
      issues,
      isSuitable: issues.length === 0,
    };
  },
});

/** Store soil data */
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

    await ctx.db.insert("soilData", {
      farmId: args.farmId,
      userId,
      ph: args.ph,
      organicMatter: args.organicMatter,
      nitrogen: args.nitrogen,
      phosphorus: args.phosphorus,
      potassium: args.potassium,
      soilMoisture: args.soilMoisture,
      drainage: args.drainage,
      texture: args.texture,
      fetchedAt: Date.now(),
      source: "soilgrids",
      fertility: "moderate",
    });

    return true;
  },
});
