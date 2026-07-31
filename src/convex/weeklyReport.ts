import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { requireAuth } from "./authHelpers";

// ============================================================
// Weekly AI Report Generator
// ============================================================

/** Generate comprehensive weekly report for a farm */
export const generateWeeklyReport = action({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const farm: any = await ctx.runQuery(api.farms.getFarm, { farmId: args.farmId });
    if (!farm) throw new Error("Farm not found");

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Gather data from all modules
    const crops: any = await ctx.runQuery(api.crops.listFarmCrops, { farmId: args.farmId });
    const livestock: any = await ctx.runQuery(api.livestock.listFarmLivestock, { farmId: args.farmId });
    const healthScore: any = await ctx.runQuery(api.intelligence.getFarmHealthScore, { farmId: args.farmId });
    const recommendations: any = await ctx.runQuery(api.intelligence.getRecommendations, { farmId: args.farmId, limit: 5 });
    const satellite: any = await ctx.runQuery(api.satellite.getSatelliteAnalysis, { farmId: args.farmId });
    const soil: any = await ctx.runQuery(api.soil.getSoilAnalysis, { farmId: args.farmId });

    // Build report
    const report: any = {
      farmId: args.farmId,
      farmName: farm.name,
      generatedAt: now,
      weekRange: {
        start: weekAgo,
        end: now,
        label: `${new Date(weekAgo).toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${new Date(now).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`,
      },
      summary: {
        overallHealth: healthScore?.overall ?? 75,
        cropHealth: healthScore?.cropHealth ?? 80,
        livestockHealth: healthScore?.livestockHealth ?? 90,
        soilHealth: healthScore?.soilHealth ?? 70,
        weatherRisk: healthScore?.weatherRisk ?? 40,
      },
      crops: {
        total: crops?.length ?? 0,
        healthy: crops?.filter((c: any) => (c.healthScore ?? 80) >= 70).length ?? 0,
        needsAttention: crops?.filter((c: any) => (c.healthScore ?? 80) < 70).length ?? 0,
      },
      livestock: {
        total: livestock?.length ?? 0,
        healthy: livestock?.filter((l: any) => l.status === "healthy").length ?? 0,
        needsVaccination: livestock?.filter((l: any) => {
          const lastVax = l.lastVaccination ?? 0;
          return lastVax < weekAgo;
        }).length ?? 0,
      },
      satellite: satellite ? {
        ndvi: satellite.currentNDVI,
        healthStatus: satellite.healthStatus,
        stressAreas: satellite.stressAreas,
      } : null,
      soil: soil ? {
        ph: soil.ph,
        fertility: soil.fertility,
        recommendations: soil.recommendations.slice(0, 3),
      } : null,
      recommendations: recommendations.map((r: any) => ({
        title: r.title,
        description: r.description,
        priority: r.priority,
        confidence: r.confidence,
      })),
      upcomingTasks: [
        { task: "Check irrigation systems", due: "Tomorrow", priority: "medium" },
        { task: "Harvest Zone A tomatoes", due: "In 3 days", priority: "high" },
        { task: "Schedule veterinary visit", due: "This week", priority: "medium" },
      ],
      risks: [
        { risk: "Drought stress", level: satellite?.waterStress ? "high" : "low", mitigation: "Monitor soil moisture" },
        { risk: "Pest outbreak", level: "medium", mitigation: "Regular field inspection" },
      ],
    };

    // Store the report
    await ctx.runMutation(api.weeklyReport.storeReport, {
      farmId: args.farmId,
      report,
    });

    return report;
  },
});

/** Store weekly report */
export const storeReport = mutation({
  args: {
    farmId: v.id("farms"),
    report: v.object({
      summary: v.any(),
      crops: v.any(),
      livestock: v.any(),
      satellite: v.any(),
      soil: v.any(),
      recommendations: v.any(),
      upcomingTasks: v.any(),
      risks: v.any(),
      weekRange: v.any(),
    }),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) throw new Error("Unauthorized");

    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const report = args.report;

    await ctx.db.insert("weeklyReports", {
      farmId: args.farmId,
      userId,
      weekStart: report.weekRange?.start ?? weekAgo,
      weekEnd: report.weekRange?.end ?? now,
      farmHealthSummary: typeof report.summary === "object" ? JSON.stringify(report.summary) : String(report.summary ?? ""),
      cropProgress: typeof report.crops === "object" ? JSON.stringify(report.crops) : String(report.crops ?? ""),
      livestockStatus: typeof report.livestock === "object" ? JSON.stringify(report.livestock) : String(report.livestock ?? ""),
      weatherSummary: "",
      soilInsights: report.soil ? JSON.stringify(report.soil) : undefined,
      satelliteObservations: report.satellite ? JSON.stringify(report.satellite) : undefined,
      financialPerformance: "",
      tasksCompleted: 0,
      tasksUpcoming: report.upcomingTasks?.length ?? 0,
      recommendations: Array.isArray(report.recommendations)
        ? report.recommendations.map((r: any) => ({
            category: "general",
            title: r.title ?? "Recommendation",
            description: r.description ?? "",
            priority: r.priority ?? "medium",
            confidence: r.confidence ?? 50,
          }))
        : [],
      riskAnalysis: JSON.stringify(report.risks ?? []),
      riskScore: 50,
      healthScore: report.summary?.overallHealth ?? 75,
      generatedAt: now,
    });

    return true;
  },
});

/** Get latest weekly report for a farm */
export const getLatestReport = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    const report = await ctx.db
      .query("weeklyReports")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .first();

    if (!report) return null;
    return {
      summary: report.farmHealthSummary,
      crops: report.cropProgress,
      livestock: report.livestockStatus,
      weather: report.weatherSummary,
      soil: report.soilInsights,
      satellite: report.satelliteObservations,
      financial: report.financialPerformance,
      recommendations: report.recommendations,
      healthScore: report.healthScore,
      riskAnalysis: report.riskAnalysis,
      generatedAt: report.generatedAt,
    };
  },
});

/** Get report history for a farm */
export const getReportHistory = query({
  args: {
    farmId: v.id("farms"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return [];

    const reports = await ctx.db
      .query("weeklyReports")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .collect();

    return reports.map((r: any) => ({
      id: r._id,
      generatedAt: r.generatedAt,
      overallHealth: r.report?.summary?.overallHealth ?? 0,
      status: r.status,
    }));
  },
});

/** Generate weekly reports for all farms (called by cron) */
export const generateWeeklyReports = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    // Get all farms
    const farms = await ctx.db.query("farms").collect();
    let generated = 0;
    
    for (const farm of farms) {
      // Check if a report was already generated this week
      const existing = await ctx.db
        .query("weeklyReports")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .order("desc")
        .first();
      
      if (existing && existing.generatedAt > weekAgo) continue;
      
      // Gather data
      const crops = await ctx.db
        .query("crops")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .collect();
      const livestock = await ctx.db
        .query("livestock")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .collect();
      const healthScore = await ctx.db
        .query("farmHealthScores")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .order("desc")
        .first();
      const transactions = await ctx.db
        .query("transactions")
        .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
        .collect();
      const recentTx = transactions.filter((t) => t.date > weekAgo);
      const income = recentTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expenses = recentTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
      const completedTasks = crops.filter((c) => c.status === "harvested").length;
      
      await ctx.db.insert("weeklyReports", {
        farmId: farm._id,
        userId: farm.userId,
        weekStart: weekAgo,
        weekEnd: now,
        farmHealthSummary: `Overall farm health score: ${healthScore?.overall ?? 75}%. Risk level: ${healthScore?.riskLevel ?? "medium"}.`,
        cropProgress: `${crops.length} crops tracked. ${crops.filter((c) => (c.healthScore ?? 80) >= 70).length} healthy, ${crops.filter((c) => (c.healthScore ?? 80) < 70).length} need attention.`,
        livestockStatus: `${livestock.length} livestock managed. ${livestock.filter((l) => l.status === "healthy").length} healthy.`,
        weatherSummary: "Weather data updated via intelligence pipeline.",
        financialPerformance: `Income: ${income.toFixed(2)}. Expenses: ${expenses.toFixed(2)}. Net: ${(income - expenses).toFixed(2)}.`,
        tasksCompleted: completedTasks,
        tasksUpcoming: crops.filter((c) => c.status !== "harvested" && c.status !== "failed").length,
        recommendations: healthScore?.riskFactors?.map((rf) => ({
          category: "general",
          title: rf,
          description: "Address this risk factor to improve farm health.",
          priority: "medium",
          confidence: 80,
        })) ?? [],
        riskAnalysis: `Risk factors: ${healthScore?.riskFactors?.join("; ") ?? "None identified"}. Trend: ${healthScore?.trend ?? "stable"}.`,
        riskScore: healthScore ? (100 - healthScore.overall) : 25,
        healthScore: healthScore?.overall ?? 75,
        generatedAt: now,
      });
      generated++;
    }
    
    return { generated };
  },
});
