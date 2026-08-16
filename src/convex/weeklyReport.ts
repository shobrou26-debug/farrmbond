import { v } from "convex/values";
import { query, mutation, action, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  CRON_BATCH_SIZE,
  cronBatchArgs,
  runCronBatch,
  pageFarms,
  type CronBatchResult,
} from "./cronBatch";
import {
  requireAuth,
  requireActiveSubscription,
  hasPremiumAccess,
  hasRole,
  createAuditLog,
  sanitizeInput,
  validateString,
} from "./authHelpers";
import { ROLES } from "./schema";
import { convertCurrency } from "./currency";

// ============================================================
// Weekly AI Report Generator
// ============================================================

/** Generate comprehensive weekly report for a farm */
export const generateWeeklyReport = action({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    // Reports are a Pro feature (Phase 4A) — enforced server-side.
    const user: any = await ctx.runQuery(api.users.currentUser);
    if (!user) throw new Error("Authentication required");
    const isAdmin = user.role === "admin" || user.role === "super_admin";
    if (!isAdmin && !hasPremiumAccess(user)) {
      throw new Error(
        "Weekly reports are a Pro feature. Upgrade at Settings > Subscription — expired subscriptions are treated as Free."
      );
    }

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

    // Upcoming tasks come from the farmer's REAL calendar — never invented.
    const calendarResult: any = await ctx.runQuery(api.farmCalendar.listFarmEvents, {
      farmId: args.farmId,
    });
    const upcomingTasks = buildUpcomingTasksFromCalendar(calendarResult?.page ?? [], now);

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
        overallHealth: healthScore?.overall ?? null,
        cropHealth: healthScore?.cropHealth ?? null,
        livestockHealth: healthScore?.livestockHealth ?? null,
        soilHealth: healthScore?.soilHealth ?? null,
        weatherRisk: healthScore?.weatherRisk ?? null,
      },
      crops: {
        total: crops?.length ?? 0,
        // Honest counts: only crops WITH a recorded health score are
        // classified — a crop without a score is never assumed healthy.
        healthy: crops?.filter((c: any) => typeof c.healthScore === "number" && c.healthScore >= 70).length ?? 0,
        needsAttention: crops?.filter((c: any) => typeof c.healthScore === "number" && c.healthScore < 70).length ?? 0,
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
      upcomingTasks,
      risks: deriveRisks(satellite, healthScore),
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
      // riskScore is derived from the REAL overall health score (100 - score)
      // and is null when no health score exists — never invented from the
      // number of risks.
      riskScore: report.summary?.overallHealth != null
        ? Math.max(0, 100 - report.summary.overallHealth)
        : undefined,
      ...(report.summary?.overallHealth != null
        ? { healthScore: report.summary.overallHealth }
        : {}),
      generatedAt: now,
    });

    return true;
  },
});

/** Get latest weekly report for a farm */
export const getLatestReport = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    // Weekly reports are a Pro feature — the read path is gated too
    // (admins bypass; free/expired users are treated as Free).
    if (!hasRole(user.role, ROLES.ADMIN)) {
      await requireActiveSubscription(ctx);
    }
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

/** Get report history for a farm (Pro-gated server-side) */
export const getReportHistory = query({
  args: {
    farmId: v.id("farms"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);
    // Weekly reports are a Pro feature — the history read is gated like
    // getLatestReport (admins bypass; free/expired users are treated as Free).
    if (!hasRole(user.role, ROLES.ADMIN)) {
      await requireActiveSubscription(ctx);
    }
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return [];

    const reports = await ctx.db
      .query("weeklyReports")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .collect();

    const max = args.limit ?? 20;
    return reports.slice(0, max).map((r) => ({
      id: r._id,
      generatedAt: r.generatedAt,
      // null when the report had no computable health score — never 0
      overallHealth: r.healthScore ?? null,
      status: "completed" as const,
    }));
  },
});

/**
 * Apply a report recommendation by creating a farm calendar task.
 * Ownership is verified server-side; the action is audit-logged.
 */
export const applyRecommendation = mutation({
  args: {
    farmId: v.id("farms"),
    title: v.string(),
    description: v.optional(v.string()),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) throw new Error("Unauthorized");

    const title = sanitizeInput(validateString(args.title, "Title", 200));
    const description = args.description
      ? sanitizeInput(validateString(args.description, "Description", 500))
      : undefined;
    const priority = args.priority ?? "medium";

    const now = Date.now();
    const eventId = await ctx.db.insert("farmCalendar", {
      userId,
      farmId: args.farmId,
      title,
      description,
      eventType: "other",
      startDate: now,
      isRecurring: false,
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "recommendation_applied",
      resource: "weeklyReports",
      resourceId: eventId,
      changes: { title, priority, farmId: args.farmId },
    });

    return true;
  },
});

// ============================================================
// Honest report content builders (pure — unit tested)
// Upcoming tasks and risks are DERIVED from real farm data. When no data
// exists the arrays are empty — nothing is invented.
// ============================================================

export function dueLabel(startDate: number, now: number): string {
  const diffDays = Math.ceil((startDate - now) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays < 7) return `In ${diffDays} days`;
  return new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Upcoming tasks straight from the farm calendar: only future, incomplete
 * events, nearest first, max 5. An empty calendar yields an empty list.
 */
interface CalendarEventLike {
  title?: string;
  startDate?: number;
  isCompleted?: boolean;
}

export function buildUpcomingTasksFromCalendar(
  events: CalendarEventLike[] | undefined,
  now: number
): Array<{ task: string; due: string; priority: string }> {
  return (events || [])
    .filter(
      (e): e is CalendarEventLike & { startDate: number } =>
        !!e &&
        !e.isCompleted &&
        typeof e.startDate === "number" &&
        e.startDate >= now
    )
    .sort((a, b) => a.startDate - b.startDate)
    .slice(0, 5)
    .map((e) => ({
      task: typeof e.title === "string" ? e.title : "Farm task",
      due: dueLabel(e.startDate, now),
      priority: "medium",
    }));
}

/**
 * Risks derived ONLY from real signals: the intelligence engine's risk
 * factors and satellite water stress. No invented pest outbreaks.
 */
interface HealthScoreLike {
  riskLevel?: string;
  riskFactors?: unknown;
}

export function deriveRisks(
  satellite: { waterStress?: boolean } | null | undefined,
  healthScore: HealthScoreLike | null | undefined
): Array<{ risk: string; level: string; mitigation: string }> {
  const risks: Array<{ risk: string; level: string; mitigation: string }> = [];
  const factors = healthScore?.riskFactors;
  if (Array.isArray(factors)) {
    for (const factor of factors) {
      if (typeof factor !== "string" || !factor.trim()) continue;
      risks.push({
        risk: factor,
        level: healthScore?.riskLevel ?? "medium",
        mitigation:
          "Addressed in your farm health assessment — review the risk factors section.",
      });
    }
  }
  if (satellite?.waterStress) {
    risks.push({
      risk: "Water stress detected on vegetation",
      level: "high",
      mitigation: "Monitor soil moisture and adjust irrigation scheduling.",
    });
  }
  const unique: typeof risks = [];
  for (const r of risks) {
    if (!unique.some((x) => x.risk === r.risk)) unique.push(r);
  }
  return unique.slice(0, 5);
}

/** Generate weekly reports for all farms. Batched cron: each invocation
 * processes at most CRON_BATCH_SIZE farms and schedules the next batch
 * when more remain. The per-farm work is bounded (indexed by_farm reads)
 * and idempotent — a farm that already has this week's report is skipped,
 * so retried batches never duplicate reports. */
export const generateWeeklyReports = internalMutation({
  args: cronBatchArgs,
  handler: async (ctx, args): Promise<CronBatchResult> => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

    return runCronBatch(
      ctx,
      args.cursor,
      CRON_BATCH_SIZE,
      pageFarms,
      async (ctx, farm) => {
        // Check if a report was already generated this week (idempotency)
        const existing = await ctx.db
          .query("weeklyReports")
          .withIndex("by_farm", (q) => q.eq("farmId", farm._id))
          .order("desc")
          .first();

        if (existing && existing.generatedAt > weekAgo) return;

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
        // Currency-safe: convert each stored amount into the owner's configured
        // display currency before summing, and label the report text with the
        // currency code so a bare number is never presented as an unlabeled sum.
        const userDoc = await ctx.db.get(farm.userId);
        const displayCurrency = userDoc?.currency ?? "KES";
        const amountOf = (t: { amount: number; currency?: string | null }) =>
          convertCurrency(t.amount, t.currency ?? "KES", displayCurrency);
        const income = recentTx
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + amountOf(t), 0);
        const expenses = recentTx
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + amountOf(t), 0);
        const completedTasks = crops.filter((c) => c.status === "harvested").length;

        const scoredCrops = crops.filter((c) => typeof c.healthScore === "number");
        const healthyCrops = scoredCrops.filter((c) => (c.healthScore as number) >= 70).length;
        const attentionCrops = scoredCrops.filter((c) => (c.healthScore as number) < 70).length;
        const unscoredCrops = crops.length - scoredCrops.length;
        const overallHealth = healthScore?.overall != null ? healthScore.overall : null;
        const riskLevel = healthScore?.riskLevel;

        await ctx.db.insert("weeklyReports", {
          farmId: farm._id,
          userId: farm.userId,
          weekStart: weekAgo,
          weekEnd: now,
          farmHealthSummary: overallHealth != null
            ? `Overall farm health score: ${overallHealth}%. Risk level: ${riskLevel ?? "unknown"}.`
            : "Insufficient data to compute an overall farm health score. Add crops, livestock, weather or financial data to unlock scoring.",
          cropProgress: scoredCrops.length > 0
            ? `${crops.length} crops tracked. ${healthyCrops} healthy, ${attentionCrops} need attention${unscoredCrops > 0 ? `, ${unscoredCrops} without a health score` : ""}.`
            : `${crops.length} crops tracked, but none have a recorded health score yet.`,
          livestockStatus: `${livestock.length} livestock managed. ${livestock.filter((l) => l.status === "healthy").length} healthy.`,
          weatherSummary: "Weather data updated via intelligence pipeline.",
          financialPerformance: `Income: ${income.toFixed(2)} ${displayCurrency}. Expenses: ${expenses.toFixed(2)} ${displayCurrency}. Net: ${(income - expenses).toFixed(2)} ${displayCurrency}.`,
          tasksCompleted: completedTasks,
          tasksUpcoming: crops.filter((c) => c.status !== "harvested" && c.status !== "failed").length,
          recommendations: healthScore?.riskFactors?.map((rf) => ({
            category: "general",
            title: rf,
            description: "Address this risk factor to improve farm health.",
            priority: "medium",
            confidence: 80,
          })) ?? [],
          riskAnalysis: healthScore
            ? `Risk factors: ${healthScore.riskFactors?.join("; ") ?? "None identified"}. Trend: ${healthScore.trend ?? "stable"}.`
            : "Insufficient data to assess risk factors.",
          riskScore: overallHealth != null ? Math.max(0, 100 - overallHealth) : undefined,
          ...(overallHealth != null ? { healthScore: overallHealth } : {}),
          generatedAt: now,
        });
      },
      (ctx, cursor) =>
        ctx.scheduler.runAfter(0, internal.weeklyReport.generateWeeklyReports, { cursor }),
      "generateWeeklyReports",
      // Overlap protection: weekly interval, so TTL only needs to cover a
      // crashed chain (self-heals within 24h) — continuation batches keep
      // the lease fresh while a long farm chain is legitimately running.
      { jobName: "weekly_reports", ttlMs: 24 * 60 * 60 * 1000 }
    );
  },
});
