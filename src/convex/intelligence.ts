import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./authHelpers";
import {
  cronBatchArgs,
  acquireCronLease,
  refreshCronLease,
  releaseCronLease,
} from "./cronBatch";
import type { Id } from "./_generated/dataModel";

// ============================================================
// Intelligence Engine - Central Brain
// ============================================================

/** Core intelligence types */
export type IntelligenceInput = {
  farmId: string;
  timestamp: number;
  source: "weather" | "satellite" | "soil" | "market" | "crop" | "livestock" | "financial" | "user";
  dataType: string;
  data: Record<string, unknown>;
  confidence: number;
};

export type Recommendation = {
  id: string;
  category: "irrigation" | "planting" | "harvesting" | "pest" | "disease" | "livestock" | "market" | "financial" | "general";
  priority: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  reasoning: string;
  dataSources: string[];
  confidence: number;
  riskLevel: "high" | "medium" | "low";
  actions: string[];
  estimatedImpact: string;
  expiresAt: number;
};

export type FarmHealthScore = {
  farmId: string;
  overall: number;
  cropHealth: number;
  livestockHealth: number;
  soilHealth: number;
  weatherRisk: number;
  financialHealth: number;
  lastUpdated: number;
};

// ============================================================
// Intelligence Queries
// ============================================================

/**
 * Pure: average of the finite numbers in a list (null when none present).
 * Never invents a value — a component is only a number when real data
 * exists to compute it from (Phase 8 data-honesty contract).
 */
export function averagePresent(values: Array<number | null | undefined>): number | null {
  const present = values.filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (present.length === 0) return null;
  return Math.round(present.reduce((a, b) => a + b, 0) / present.length);
}

/**
 * Pure: weighted average over the components that actually have data.
 * Weights are renormalized over the present subset so a farm with, say,
 * only crop data still gets an honest overall score — and a farm with no
 * data at all gets null, never a fabricated number.
 */
export function computeWeightedHealth(
  components: Array<{ value: number | null | undefined; weight: number }>
): number | null {
  let weightSum = 0;
  let valueSum = 0;
  for (const c of components) {
    if (typeof c.value === "number" && Number.isFinite(c.value)) {
      weightSum += c.weight;
      valueSum += c.value * c.weight;
    }
  }
  if (weightSum === 0) return null;
  return Math.round(valueSum / weightSum);
}

/** Get farm health score aggregating all data sources */
export const getFarmHealthScore = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Get crops
    const crops = await ctx.db
      .query("crops")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .collect();

    // Get livestock
    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .collect();

    // Crop health: average of crops WITH a recorded health score. A crop
    // without a healthScore contributes nothing; with no scored crops the
    // component is null (insufficient data), never a default 80.
    const cropHealth = averagePresent(crops.map((c) => c.healthScore));

    // Livestock health: same rule (no default 100).
    const livestockHealth = averagePresent(livestock.map((l) => l.healthScore));

    // Vaccination coverage: only defined when there is livestock.
    const vaccinatedLivestock = livestock.filter((l) => l.lastVaccination && l.lastVaccination > thirtyDaysAgo).length;
    const vaccinationRate = livestock.length > 0
      ? Math.round((vaccinatedLivestock / livestock.length) * 100)
      : null;

    // Weather risk: null when no cached weather record exists.
    const weatherData = await ctx.db
      .query("weatherData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .first();

    let weatherRisk: number | null = null;
    if (weatherData) {
      const temp = weatherData.temperature ?? 25;
      const rain = weatherData.precipitation ?? 0;
      // Simple risk calculation
      if (temp > 35 || temp < 10 || rain < 5) weatherRisk = 80;
      else if (temp > 30 || temp < 15 || rain < 20) weatherRisk = 60;
      else weatherRisk = 30;
    }

    // Soil health: derived from satellite NDVI when present, else null.
    const satelliteData = await ctx.db
      .query("satelliteData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .first();

    const soilHealth = satelliteData?.ndvi != null
      ? Math.round(Math.max(0, Math.min(100, satelliteData.ndvi * 100)))
      : null;

    // Financial health: only when there is income to compute a margin from.
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const recentTransactions = transactions.filter((t) => t.date > thirtyDaysAgo);
    const income = recentTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + (t.amount || 0), 0);
    const expenses = recentTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + (t.amount || 0), 0);
    const financialHealth = income > 0
      ? Math.round(Math.max(0, Math.min(100, ((income - expenses) / income) * 100)))
      : null;

    // Overall: renormalized weighted average of the components with data.
    const overall = computeWeightedHealth([
      { value: cropHealth, weight: 0.25 },
      { value: livestockHealth, weight: 0.15 },
      { value: vaccinationRate, weight: 0.1 },
      { value: soilHealth, weight: 0.2 },
      { value: weatherRisk != null ? 100 - weatherRisk : null, weight: 0.15 },
      { value: financialHealth, weight: 0.15 },
    ]);

    return {
      farmId: args.farmId,
      overall,
      cropHealth,
      livestockHealth,
      soilHealth,
      weatherRisk,
      financialHealth,
      vaccinationRate,
      lastUpdated: now,
    };
  },
});

/** Get AI-powered recommendations for a farm */
export const getRecommendations = query({
  args: {
    farmId: v.id("farms"),
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return [];

    const recommendations: Recommendation[] = [];
    const now = Date.now();

    // Get farm data (livestock is used by vaccination recs)
    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .collect();

    // Weather-based recommendations
    const weatherData = await ctx.db
      .query("weatherData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .first();

    if (weatherData) {
      const temp = weatherData.temperature ?? 25;
      const rain = weatherData.precipitation ?? 0;

      if (rain < 5) {
        recommendations.push({
          id: `irr-${args.farmId}-${now}`,
          category: "irrigation",
          priority: "high",
          title: "Increase Irrigation",
          description: `Rainfall is very low (${rain}mm). Increase irrigation to prevent crop stress.`,
          reasoning: "Weather data shows minimal rainfall, which can lead to drought stress in crops.",
          dataSources: ["weather", "crop"],
          confidence: 85,
          riskLevel: "high",
          actions: ["Increase irrigation frequency", "Check soil moisture", "Mulch around plants"],
          estimatedImpact: "Prevent 15-20% yield loss",
          expiresAt: now + 7 * 24 * 60 * 60 * 1000,
        });
      }

      if (temp > 35) {
        recommendations.push({
          id: `heat-${args.farmId}-${now}`,
          category: "general",
          priority: "medium",
          title: "Heat Stress Alert",
          description: `Temperature is ${temp}°C. Monitor crops for heat stress signs.`,
          reasoning: "High temperatures can cause heat stress, reduced photosynthesis, and wilting.",
          dataSources: ["weather", "crop"],
          confidence: 90,
          riskLevel: "medium",
          actions: ["Increase watering", "Provide shade for sensitive crops", "Harvest early if needed"],
          estimatedImpact: "Maintain crop health during heat wave",
          expiresAt: now + 3 * 24 * 60 * 60 * 1000,
        });
      }
    }

    // Livestock-based recommendations
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const needsVaccination = livestock.filter(
      (l) => !l.lastVaccination || l.lastVaccination < thirtyDaysAgo
    );

    if (needsVaccination.length > 0) {
      recommendations.push({
        id: `vacc-${args.farmId}-${now}`,
        category: "livestock",
        priority: "high",
        title: "Vaccination Overdue",
        description: `${needsVaccination.length} animals need vaccination update.`,
        reasoning: "Regular vaccination prevents disease outbreaks and maintains herd health.",
        dataSources: ["livestock"],
        confidence: 95,
        riskLevel: "high",
        actions: ["Schedule veterinary visit", "Update vaccination records", "Quarantine new animals"],
        estimatedImpact: "Prevent potential disease outbreak",
        expiresAt: now + 14 * 24 * 60 * 60 * 1000,
      });
    }

    // Market-based recommendations
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const recentSales = transactions.filter((t) => t.type === "income" && t.date > thirtyDaysAgo);
    if (recentSales.length > 0) {
      const avgSaleValue = recentSales.reduce((sum, t) => sum + (t.amount || 0), 0) / recentSales.length;
      
      if (avgSaleValue > 50000) {
        recommendations.push({
          id: `mkt-${args.farmId}-${now}`,
          category: "market",
          priority: "medium",
          title: "Strong Market Performance",
          description: "Your recent sales show strong market performance. Consider scaling production.",
          reasoning: "Consistent high-value sales indicate good market demand for your products.",
          dataSources: ["financial", "market"],
          confidence: 75,
          riskLevel: "low",
          actions: ["Analyze top-selling products", "Consider expanding successful crops", "Negotiate bulk contracts"],
          estimatedImpact: "Potential 20-30% revenue increase",
          expiresAt: now + 30 * 24 * 60 * 60 * 1000,
        });
      }
    }

    // Filter by category if specified
    const filtered = args.category
      ? recommendations.filter((r) => r.category === args.category)
      : recommendations;

    // Sort by priority and limit
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    filtered.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return filtered.slice(0, args.limit ?? 10);
  },
});

/** Get overall dashboard intelligence summary */
export const getDashboardIntelligence = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    // Get all user farms
    const farms = await ctx.db
      .query("farms")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (farms.length === 0) return null;

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    // Aggregate data across all farms
    let totalCrops = 0;
    let totalLivestock = 0;
    let scoredCrops = 0;
    let healthyScoredCrops = 0;
    let healthyLivestock = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    for (const farm of farms) {
      const crops = await ctx.db
        .query("crops")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .collect();

      const livestock = await ctx.db
        .query("livestock")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .collect();

      totalCrops += crops.length;
      totalLivestock += livestock.length;
      // Only crops with an ACTUAL health score count — a crop without a
      // score is never assumed healthy (no `?? 80` fabrications).
      scoredCrops += crops.filter((c) => typeof c.healthScore === "number").length;
      healthyScoredCrops += crops.filter((c) => typeof c.healthScore === "number" && c.healthScore >= 70).length;
      healthyLivestock += livestock.filter((l) => l.status === "healthy").length;
    }

    // Get financial data
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const recentTransactions = transactions.filter((t) => t.date > thirtyDaysAgo);
    totalIncome = recentTransactions.filter((t) => t.type === "income").reduce((sum, t) => sum + (t.amount || 0), 0);
    totalExpenses = recentTransactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + (t.amount || 0), 0);

    // Get notifications
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const unreadNotifications = notifications.filter((n) => !n.isRead).length;

    // Calculate overall health — nullable when no scored data exists
    const cropHealth = scoredCrops > 0 ? Math.round((healthyScoredCrops / scoredCrops) * 100) : null;
    const livestockHealth = totalLivestock > 0 ? Math.round((healthyLivestock / totalLivestock) * 100) : null;
    const overallHealth = computeWeightedHealth([
      { value: cropHealth, weight: 0.5 },
      { value: livestockHealth, weight: 0.5 },
    ]);

    return {
      farmCount: farms.length,
      totalCrops,
      totalLivestock,
      cropHealth,
      livestockHealth,
      overallHealth,
      totalIncome,
      totalExpenses,
      profit: totalIncome - totalExpenses,
      profitMargin: totalIncome > 0 ? Math.round(((totalIncome - totalExpenses) / totalIncome) * 100) : null,
      unreadNotifications,
      lastUpdated: now,
    };
  },
});

/** Get cross-module insights combining multiple data sources */
export const getCrossModuleInsights = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    const insights: Array<{
      type: string;
      title: string;
      description: string;
      severity: "info" | "warning" | "critical";
      sources: string[];
      actionRequired: boolean;
    }> = [];

    // Get all data sources
    const crops = await ctx.db
      .query("crops")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .collect();

    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .collect();

    const weatherData = await ctx.db
      .query("weatherData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .first();

    const satelliteData = await ctx.db
      .query("satelliteData")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .first();

    // Cross-reference: Weather + Crops
    if (weatherData && crops.length > 0) {
      const rain = weatherData.precipitation ?? 0;
      const temp = weatherData.temperature ?? 25;

      if (rain < 10 && crops.some((c) => c.status === "flowering" || c.status === "fruiting")) {
        insights.push({
          type: "irrigation_urgent",
          title: "Critical: Flowering Crops Need Water",
          description: "Your crops are in flowering stage but rainfall is minimal. Immediate irrigation recommended.",
          severity: "critical",
          sources: ["weather", "crops"],
          actionRequired: true,
        });
      }

      if (temp > 35 && crops.some((c) => c.type === "lettuce" || c.type === "tomato")) {
        insights.push({
          type: "heat_stress",
          title: "Heat Stress Risk for Vegetables",
          description: "High temperatures detected. Consider shade nets for heat-sensitive crops.",
          severity: "warning",
          sources: ["weather", "crops"],
          actionRequired: true,
        });
      }
    }

    // Cross-reference: Satellite + Crops
    // Data honesty: a record without an NDVI measurement is no-data, never a
    // fabricated 0 that would report "Vegetation Stress Detected".
    if (satelliteData && crops.length > 0 && satelliteData.ndvi != null) {
      if (satelliteData.ndvi < 0.3) {
        insights.push({
          type: "vegetation_stress",
          title: "Vegetation Stress Detected",
          description: "Satellite imagery shows low vegetation health. Check crops for disease or nutrient deficiency.",
          severity: "warning",
          sources: ["satellite", "crops"],
          actionRequired: true,
        });
      }
    }

    // Cross-reference: Livestock + Weather
    if (weatherData && livestock.length > 0) {
      const temp = weatherData.temperature ?? 25;
      if (temp > 30 && livestock.some((l) => l.type === "cattle" || l.type === "goat")) {
        insights.push({
          type: "livestock_heat",
          title: "Livestock Heat Management Needed",
          description: "High temperatures may stress livestock. Ensure adequate water and shade.",
          severity: "warning",
          sources: ["weather", "livestock"],
          actionRequired: true,
        });
      }
    }

    return insights;
  },
});

// ============================================================
// Intelligence Mutations
// ============================================================

/** Store intelligence data from any source */
export const storeIntelligenceData = mutation({
  args: {
    farmId: v.id("farms"),
    source: v.string(),
    dataType: v.string(),
    data: v.any(),
    confidence: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) throw new Error("Unauthorized");

    await ctx.db.insert("intelligenceData", {
      farmId: args.farmId,
      userId,
      source: args.source,
      dataType: args.dataType,
      title: args.source + " insight",
      summary: typeof args.data === "object" ? JSON.stringify(args.data) : String(args.data ?? ""),
      details: args.data,
      confidence: args.confidence,
      impact: "neutral",
      severity: "low",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
    });

    return true;
  },
});

/** Mark recommendation as acted upon */
export const markRecommendationActed = mutation({
  args: {
    recommendationId: v.string(),
    action: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    // Update existing intelligence data entry to mark it as acted upon
    const entries = await ctx.db
      .query("intelligenceData")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    
    if (entries.length > 0) {
      await ctx.db.patch(entries[0]._id, {
        actionsTriggered: [args.action],
      });
    }

    return true;
  },
});

// ============================================================
// Intelligence Pipeline - Cross-Module Automation
// ============================================================

/**
 * CORE — run the intelligence pipeline for a specific user.
 * Server-safe: the caller resolves the user identity (the public
 * mutation via requireAuth, or the scheduled cron via pagination).
 */
export async function runIntelligencePipelineCore(
  ctx: MutationCtx,
  input: { userId: Id<"users">; farmId?: Id<"farms"> }
) {
  const { userId, farmId: farmIdArg } = input;
  const now = Date.now();

  // Get farms to process
  let farms;
  if (farmIdArg) {
    const farm = await ctx.db.get(farmIdArg);
    if (farm && farm.userId === userId) {
      farms = [farm];
    } else {
      return { processed: 0, insights: 0 };
    }
  } else {
    farms = await ctx.db
      .query("farms")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  }

    if (farms.length === 0) return { processed: 0, insights: 0 };

    let totalInsights = 0;

    for (const farm of farms) {
      // 1. Crop health: average of crops WITH a recorded health score.
      //    No scored crops → null (insufficient data), never a default 80.
      const crops = await ctx.db
        .query("crops")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .collect();
      const avgCropHealth = averagePresent(crops.map((c) => c.healthScore));

      // 2. Livestock health: same rule (no default 100).
      const livestock = await ctx.db
        .query("livestock")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .collect();
      const avgLivestockHealth = averagePresent(livestock.map((l) => l.healthScore));

      // 3. Weather risk: null when no cached weather record exists.
      const weatherData = await ctx.db
        .query("weatherData")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .order("desc")
        .first();
      let weatherRisk: number | null = null;
      if (weatherData) {
        const temp = weatherData.temperature;
        const rain = weatherData.precipitation;
        if (temp > 35 || temp < 10 || rain < 5) weatherRisk = 80;
        else if (temp > 30 || temp < 15 || rain < 20) weatherRisk = 60;
        else weatherRisk = 30;
      }

      // 4. Satellite health: only from a real NDVI measurement.
      const satelliteData = await ctx.db
        .query("satelliteData")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .order("desc")
        .first();
      const satelliteHealth = satelliteData?.ndvi != null
        ? Math.round(Math.max(0, Math.min(100, satelliteData.ndvi * 100)))
        : null;

      // 5. Soil health: only when a soil record exists.
      const soilData = await ctx.db
        .query("soilData")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .order("desc")
        .first();
      let soilHealth: number | null = null;
      if (soilData) {
        soilHealth = Math.round(
          (soilData.ph >= 6 && soilData.ph <= 7.5 ? 25 : 10) +
          (soilData.organicMatter > 3 ? 25 : soilData.organicMatter > 2 ? 15 : 5) +
          (soilData.soilMoisture > 30 && soilData.soilMoisture < 80 ? 25 : 10) +
          (soilData.fertility === "high" ? 25 : soilData.fertility === "moderate" ? 15 : 5)
        );
      }

      // 6. Financial health: only when there is income to compute a margin.
      const transactions = await ctx.db
        .query("transactions")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .collect();
      const recentTx = transactions.filter((t) => t.date > now - 30 * 24 * 60 * 60 * 1000);
      const income = recentTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expenses = recentTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const financialHealth = income > 0
        ? Math.round(Math.max(0, Math.min(100, ((income - expenses) / income) * 100 + 50)))
        : null;

      // Overall: renormalized weighted average of the components with data.
      const overall = computeWeightedHealth([
        { value: avgCropHealth, weight: 0.25 },
        { value: avgLivestockHealth, weight: 0.15 },
        { value: weatherRisk != null ? 100 - weatherRisk : null, weight: 0.15 },
        { value: satelliteHealth, weight: 0.15 },
        { value: soilHealth, weight: 0.15 },
        { value: financialHealth, weight: 0.15 },
      ]);

      // A health score row is only written when at least one component has
      // real data — an empty farm never gets a fabricated score.
      if (overall == null) continue;

      // Determine risk level
      let riskLevel = "low";
      if (overall < 40) riskLevel = "critical";
      else if (overall < 60) riskLevel = "high";
      else if (overall < 75) riskLevel = "medium";

      // Risk factors (only from components that actually have data)
      const riskFactors: string[] = [];
      if (weatherRisk != null && weatherRisk > 60) riskFactors.push("High weather risk");
      if (avgCropHealth != null && avgCropHealth < 60) riskFactors.push("Poor crop health");
      if (satelliteHealth != null && satelliteHealth < 50) riskFactors.push("Vegetation stress detected");
      if (soilHealth != null && soilHealth < 50) riskFactors.push("Soil needs attention");
      if (financialHealth != null && financialHealth < 50) riskFactors.push("Financial pressure");

      // Trend (compare with previous score)
      const previousScore = await ctx.db
        .query("farmHealthScores")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .order("desc")
        .first();
      const trend = previousScore && previousScore.overall != null
        ? overall > previousScore.overall + 3 ? "improving"
          : overall < previousScore.overall - 3 ? "declining"
          : "stable"
        : "stable";

      // Upsert health score (optional schema fields: null -> undefined)
      if (previousScore) {
        await ctx.db.patch(previousScore._id, {
          overall: overall ?? undefined,
          cropHealth: avgCropHealth ?? undefined,
          livestockHealth: avgLivestockHealth ?? undefined,
          soilHealth: soilHealth ?? undefined,
          weatherRisk: weatherRisk ?? undefined,
          financialHealth: financialHealth ?? undefined,
          satelliteHealth: satelliteHealth ?? undefined,
          riskLevel, riskFactors, trend, previousScore: previousScore.overall,
          computedAt: now,
        });
      } else {
        await ctx.db.insert("farmHealthScores", {
          farmId: farm._id, userId,
          overall: overall ?? undefined,
          cropHealth: avgCropHealth ?? undefined,
          livestockHealth: avgLivestockHealth ?? undefined,
          soilHealth: soilHealth ?? undefined,
          weatherRisk: weatherRisk ?? undefined,
          financialHealth: financialHealth ?? undefined,
          satelliteHealth: satelliteHealth ?? undefined,
          riskLevel, riskFactors, trend,
          computedAt: now,
        });
      }

      // Store intelligence data entries
      const insights: Array<{ source: string; title: string; summary: string; confidence: number; impact: string; severity: string }> = [];

      if (weatherRisk != null && weatherRisk > 70) {
        insights.push({ source: "weather", title: "High weather risk detected", summary: `Temperature and precipitation conditions pose risk to ${farm.name}`, confidence: 85, impact: "negative", severity: "high" });
      }
      if (satelliteHealth != null && satelliteHealth < 50) {
        insights.push({ source: "satellite", title: "Vegetation stress detected", summary: `NDVI indicates poor vegetation health on ${farm.name}`, confidence: 80, impact: "negative", severity: "high" });
      }
      if (avgCropHealth != null && avgCropHealth < 60) {
        const struggling = crops.filter((c) => typeof c.healthScore === "number" && c.healthScore < 60).length;
        insights.push({ source: "crop", title: "Crop health declining", summary: `${struggling} crops scored below 60% health`, confidence: 90, impact: "negative", severity: "medium" });
      }
      if (financialHealth != null && financialHealth > 70 && income > expenses) {
        insights.push({ source: "financial", title: "Strong financial performance", summary: `Net profit this month is positive with ${((income - expenses) / income * 100).toFixed(0)}% margin`, confidence: 95, impact: "positive", severity: "low" });
      }

      // Dedup: skip insights of the same source/type created within the
      // last 12 hours for this farm — prevents duplicate records on
      // every cron run.
      const recentInsights = await ctx.db
        .query("intelligenceData")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .order("desc")
        .take(100);
      const dedupWindow = now - 12 * 60 * 60 * 1000;

      for (const insight of insights) {
        const alreadyExists = recentInsights.some(
          (r) =>
            r.farmId === farm._id &&
            r.source === insight.source &&
            r.dataType === "auto_insight" &&
            r.createdAt > dedupWindow
        );
        if (alreadyExists) continue;

        await ctx.db.insert("intelligenceData", {
          userId, farmId: farm._id, source: insight.source, dataType: "auto_insight",
          title: insight.title, summary: insight.summary, confidence: insight.confidence,
          impact: insight.impact, severity: insight.severity, expiresAt: now + 7 * 24 * 60 * 60 * 1000,
          createdAt: now,
        });
        totalInsights++;
      }
    }

    return { processed: farms.length, insights: totalInsights };
}

/** Public (auth-guarded) — run the pipeline for the current user. */
export const runIntelligencePipeline = mutation({
  args: {
    farmId: v.optional(v.id("farms")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    return runIntelligencePipelineCore(ctx, { userId, farmId: args.farmId });
  },
});

/**
 * Server-safe core: run the intelligence pipeline for ONE bounded batch
 * of users. No auth — resolves each user from the database. Failures are
 * logged and counted, not swallowed, and never abort the rest of the batch.
 * The mutation wrapper chains batches via the scheduler until isDone.
 */
export async function runIntelligencePipelineForAllUsersCore(
  ctx: MutationCtx,
  cursor: string | null,
  batchSize: number = 100
) {
  let processed = 0;
  let insights = 0;
  let failures = 0;

  const page = await ctx.db.query("users").paginate({
    numItems: batchSize,
    cursor,
  });

  for (const user of page.page) {
    try {
      const result = await runIntelligencePipelineCore(ctx, { userId: user._id });
      processed += result.processed;
      insights += result.insights;
    } catch (error) {
      failures++;
      console.error(`[IntelligenceCron] pipeline failed for user ${user._id}:`, error);
    }
  }

  return {
    processed,
    insights,
    failures,
    isDone: page.isDone,
    continueCursor: page.continueCursor,
  };
}

/**
 * Run the intelligence pipeline for ALL users. Batched cron: each
 * invocation processes one bounded batch and schedules the next when
 * more users remain, so no single mutation walks the whole user table.
 *
 * Overlap protection: the chain-start invocation (cursor null) claims a
 * job lease and exits immediately when another chain is live; every
 * continuation batch refreshes the lease so a long AI-heavy chain is
 * never doubled; the chain releases the lease when it ends. Correctness
 * never depends on the lease — insight generation is deduplicated.
 */
export const runIntelligencePipelineForAllUsers = internalMutation({
  args: cronBatchArgs,
  handler: async (ctx, args) => {
    const lease = { jobName: "intelligence_pipeline", ttlMs: 12 * 60 * 60 * 1000 };

    if (args.cursor === null) {
      const acquired = await acquireCronLease(ctx, lease.jobName, lease.ttlMs);
      if (!acquired) {
        return {
          processed: 0,
          insights: 0,
          failures: 0,
          isDone: true,
          scheduledNext: false,
        };
      }
    } else {
      await refreshCronLease(ctx, lease.jobName, lease.ttlMs);
    }

    const result = await runIntelligencePipelineForAllUsersCore(ctx, args.cursor);

    // Chain the next batch only when some progress was made — if every
    // user in this batch failed, stop so a systemic error doesn't spin
    // through the whole table (the cron retries on its next fire).
    const allFailed = result.processed === 0 && result.failures > 0;
    if (!result.isDone && !allFailed) {
      await ctx.scheduler.runAfter(0, internal.intelligence.runIntelligencePipelineForAllUsers, {
        cursor: result.continueCursor,
      });
    } else {
      await releaseCronLease(ctx, lease.jobName);
    }

    console.log(
      `[IntelligenceCron] Batch: ${result.processed} farms processed, ${result.insights} insights, ${result.failures} failures, done=${result.isDone}`
    );
    return { ...result, scheduledNext: !result.isDone && !allFailed };
  },
});

/** Get latest intelligence insights for the dashboard */
export const getLatestInsights = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const now = Date.now();

    const allInsights = await ctx.db
      .query("intelligenceData")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const insights = allInsights.slice(0, args.limit ?? 10);

    // Filter out expired insights
    return insights.filter((i) => i.expiresAt > now);
  },
});
