import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import {
  requireAuth,
  verifyLivestockOwnership,
  verifyFarmOwnership,
  createAuditLog,
  validateString,
  validateNumber,
  sanitizeInput,
} from "./authHelpers";

// Vaccine type intervals (days between vaccinations)
const VACCINE_INTERVALS: Record<string, number> = {
  "FMD": 180,                    // Foot and Mouth Disease - every 6 months
  "Anthrax": 365,               // Anthrax - annually
  "Brucellosis": 365,           // Brucellosis - annually
  "Rift Valley Fever": 365,     // RVF - annually
  "Newcastle Disease": 120,      // Newcastle - every 4 months
  "Gumboro": 90,                // Gumboro (IBD) - every 3 months
  "Rabies": 365,                // Rabies - annually
  "Blackleg": 365,              // Blackleg - annually
  "PPR": 365,                   // PPR - annually
  "CBPP": 365,                  // CBPP - annually
  "Pasteurellosis": 180,        // Pasteurellosis - every 6 months
  "Trypanosomiasis": 180,       // Trypanosomiasis - every 6 months
};

const DEFAULT_VACCINE_INTERVAL = 90; // 3 months for unknown vaccines

// ============================================================
// Livestock Queries
// ============================================================

/** Get all livestock for the current user. Optional pagination. */
export const listUserLivestock = query({
  args: {
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const base = ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc");

    if (args.paginationOpts) {
      return await base.paginate(args.paginationOpts);
    }

    const items = await base.collect();
    return { page: items, isDone: true, continueCursor: null };
  },
});

/** Get livestock for a specific farm. Optional pagination. */
export const listFarmLivestock = query({
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
      .query("livestock")
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
// Livestock Mutations
// ============================================================

/** Create a new livestock entry with optional health records, vaccination schedule, and cost tracking */
export const createLivestock = mutation({
  args: {
    farmId: v.id("farms"),
    name: v.string(),
    type: v.string(),
    breed: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    acquisitionDate: v.number(),
    // Cost tracking
    acquisitionCost: v.optional(v.number()),
    feedType: v.optional(v.string()),
    dailyFeedCost: v.optional(v.number()),
    // Production
    productionType: v.optional(v.string()),
    // Vaccination scheduling
    lastVaccination: v.optional(v.number()),
    nextVaccination: v.optional(v.number()),
    lastCheckup: v.optional(v.number()),
    // Initial health records
    initialHealthRecord: v.optional(v.object({
      description: v.string(),
      treatment: v.string(),
      cost: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    // Verify user owns the farm
    await verifyFarmOwnership(ctx, args.farmId, userId);

    // Input validation
    const name = sanitizeInput(validateString(args.name, "Livestock name", 100));
    const type = sanitizeInput(validateString(args.type, "Livestock type", 50));
    validateNumber(args.quantity, "Quantity", 1, 100000);

    const now = Date.now();

    // Build medical history from initial health record
    const medicalHistory = args.initialHealthRecord
      ? [{
          date: now,
          description: sanitizeInput(args.initialHealthRecord.description),
          treatment: sanitizeInput(args.initialHealthRecord.treatment),
          cost: args.initialHealthRecord.cost,
        }]
      : undefined;

    const livestockId = await ctx.db.insert("livestock", {
      farmId: args.farmId,
      userId,
      name,
      type,
      breed: args.breed ? sanitizeInput(args.breed) : undefined,
      quantity: args.quantity,
      unit: args.unit,
      status: "healthy",
      healthScore: 100,
      acquisitionDate: args.acquisitionDate,
      acquisitionCost: args.acquisitionCost,
      productionType: args.productionType ? sanitizeInput(args.productionType) : undefined,
      feedType: args.feedType ? sanitizeInput(args.feedType) : undefined,
      dailyFeedCost: args.dailyFeedCost,
      lastVaccination: args.lastVaccination,
      nextVaccination: args.nextVaccination,
      lastCheckup: args.lastCheckup,
      medicalHistory,
      createdAt: now,
      updatedAt: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "livestock_created",
      resource: "livestock",
      resourceId: livestockId,
      changes: { name, type, quantity: args.quantity, farmId: args.farmId },
    });

    return livestockId;
  },
});

/** Add a health record to an existing livestock entry */
export const addHealthRecord = mutation({
  args: {
    livestockId: v.id("livestock"),
    description: v.string(),
    treatment: v.string(),
    cost: v.optional(v.number()),
    vaccineType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyLivestockOwnership(ctx, args.livestockId, userId);

    const description = sanitizeInput(validateString(args.description, "Description", 200));
    const treatment = sanitizeInput(validateString(args.treatment, "Treatment", 500));

    const now = Date.now();

    // Get existing medical history and append
    const livestock = await ctx.db.get(args.livestockId);
    const existingHistory = livestock?.medicalHistory || [];

    await ctx.db.patch(args.livestockId, {
      medicalHistory: [
        ...existingHistory,
        {
          date: now,
          description,
          treatment,
          cost: args.cost,
          vaccineType: args.vaccineType,
        },
      ],
      lastCheckup: now,
      updatedAt: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "livestock_health_record_added",
      resource: "livestock",
      resourceId: args.livestockId,
      changes: { description, treatment },
    });

    return args.livestockId;
  },
});

/** Update livestock */
export const updateLivestock = mutation({
  args: {
    livestockId: v.id("livestock"),
    name: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("healthy"),
        v.literal("sick"),
        v.literal("pregnant"),
        v.literal("quarantine")
      )
    ),
    healthScore: v.optional(v.number()),
    quantity: v.optional(v.number()),
    lastVaccination: v.optional(v.number()),
    nextVaccination: v.optional(v.number()),
    lastCheckup: v.optional(v.number()),
    dailyFeedCost: v.optional(v.number()),
    feedType: v.optional(v.string()),
    productionType: v.optional(v.string()),
    acquisitionCost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyLivestockOwnership(ctx, args.livestockId, userId);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = sanitizeInput(validateString(args.name, "Livestock name", 100));
    if (args.status !== undefined) updates.status = args.status;
    if (args.healthScore !== undefined) updates.healthScore = validateNumber(args.healthScore, "Health score", 0, 100);
    if (args.quantity !== undefined) updates.quantity = validateNumber(args.quantity, "Quantity", 1, 100000);
    if (args.lastVaccination !== undefined) updates.lastVaccination = args.lastVaccination;
    if (args.nextVaccination !== undefined) updates.nextVaccination = args.nextVaccination;
    if (args.lastCheckup !== undefined) updates.lastCheckup = args.lastCheckup;
    if (args.dailyFeedCost !== undefined) updates.dailyFeedCost = args.dailyFeedCost;
    if (args.feedType !== undefined) updates.feedType = sanitizeInput(args.feedType);
    if (args.productionType !== undefined) updates.productionType = sanitizeInput(args.productionType);
    if (args.acquisitionCost !== undefined) updates.acquisitionCost = args.acquisitionCost;

    await ctx.db.patch(args.livestockId, updates);

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "livestock_updated",
      resource: "livestock",
      resourceId: args.livestockId,
      changes: { updatedFields: Object.keys(updates).filter((k) => k !== "updatedAt") },
    });

    return args.livestockId;
  },
});

/** Delete livestock */
export const deleteLivestock = mutation({
  args: { livestockId: v.id("livestock") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const livestock = await verifyLivestockOwnership(ctx, args.livestockId, userId);

    await ctx.db.delete(args.livestockId);

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "livestock_deleted",
      resource: "livestock",
      resourceId: args.livestockId,
      changes: { name: livestock.name, type: livestock.type } as Record<string, unknown>,
    });

    return true;
  },
});

// ============================================================
// Vaccination Scheduling
// ============================================================

/** Get upcoming vaccinations for all user livestock */
export const getUpcomingVaccinations = query({
  args: {
    daysAhead: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const daysAhead = args.daysAhead || 30;
    const now = Date.now();
    const cutoff = now + daysAhead * 24 * 60 * 60 * 1000;

    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get farm names
    const farmIds = [...new Set(livestock.map((l) => l.farmId))];
    const farms = await Promise.all(farmIds.map((id) => ctx.db.get(id)));
    const farmMap = new Map(farms.filter(Boolean).map((f) => [f!._id, f!.name]));

    const upcoming = livestock
      .filter((l) => l.nextVaccination && l.nextVaccination <= cutoff)
      .map((l) => ({
        ...l,
        farmName: farmMap.get(l.farmId) || "Unknown Farm",
        daysUntilDue: Math.ceil((l.nextVaccination! - now) / (24 * 60 * 60 * 1000)),
        isOverdue: l.nextVaccination! < now,
      }))
      .sort((a, b) => a.nextVaccination! - b.nextVaccination!);

    return upcoming;
  },
});

/** Get vaccination schedule for a specific farm */
export const getVaccinationSchedule = query({
  args: {
    farmId: v.optional(v.id("farms")),
    daysAhead: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const daysAhead = args.daysAhead || 90;
    const now = Date.now();
    const cutoff = now + daysAhead * 24 * 60 * 60 * 1000;

    let base = ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId));

    if (args.farmId) {
      await verifyFarmOwnership(ctx, args.farmId, userId);
      base = ctx.db
        .query("livestock")
        .withIndex("by_farm", (q) => q.eq("farmId", args.farmId!));
    }

    const livestock = await base.collect();

    // Build schedule events
    const events: Array<{
      livestockId: string;
      livestockName: string;
      livestockType: string;
      farmId: string;
      farmName: string;
      nextVaccination: number;
      lastVaccination: number | undefined;
      daysUntilDue: number;
      isOverdue: boolean;
      quantity: number;
      unit: string;
    }> = [];

    for (const l of livestock) {
      if (l.nextVaccination && l.nextVaccination <= cutoff) {
        const farm = await ctx.db.get(l.farmId);
        events.push({
          livestockId: l._id,
          livestockName: l.name,
          livestockType: l.type,
          farmId: l.farmId,
          farmName: farm?.name || "Unknown Farm",
          nextVaccination: l.nextVaccination,
          lastVaccination: l.lastVaccination,
          daysUntilDue: Math.ceil((l.nextVaccination - now) / (24 * 60 * 60 * 1000)),
          isOverdue: l.nextVaccination < now,
          quantity: l.quantity,
          unit: l.unit,
        });
      }
    }

    return events.sort((a, b) => a.nextVaccination - b.nextVaccination);
  },
});

/** Schedule a vaccination for livestock */
export const scheduleVaccination = mutation({
  args: {
    livestockId: v.id("livestock"),
    scheduledDate: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyLivestockOwnership(ctx, args.livestockId, userId);

    const now = Date.now();

    await ctx.db.patch(args.livestockId, {
      nextVaccination: args.scheduledDate,
      updatedAt: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "livestock_vaccination_scheduled",
      resource: "livestock",
      resourceId: args.livestockId,
      changes: { scheduledDate: args.scheduledDate },
    });

    return args.livestockId;
  },
});

/** Mark a vaccination as completed */
export const completeVaccination = mutation({
  args: {
    livestockId: v.id("livestock"),
    notes: v.optional(v.string()),
    cost: v.optional(v.number()),
    vaccineType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyLivestockOwnership(ctx, args.livestockId, userId);

    const now = Date.now();
    const livestock = await ctx.db.get(args.livestockId);
    if (!livestock) throw new Error("Livestock not found");

    // Add health record for vaccination
    const existingHistory = livestock.medicalHistory || [];
    const vaccinationRecord = {
      date: now,
      description: args.notes || `Vaccination completed`,
      treatment: "Vaccination",
      cost: args.cost,
      vaccineType: args.vaccineType,
    };

    // Use vaccine-type-specific interval for next vaccination
    const intervalDays = args.vaccineType && VACCINE_INTERVALS[args.vaccineType]
      ? VACCINE_INTERVALS[args.vaccineType]
      : DEFAULT_VACCINE_INTERVAL;
    const nextVaccinationDate = now + intervalDays * 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.livestockId, {
      lastVaccination: now,
      nextVaccination: nextVaccinationDate,
      medicalHistory: [...existingHistory, vaccinationRecord],
      updatedAt: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "livestock_vaccination_completed",
      resource: "livestock",
      resourceId: args.livestockId,
      changes: { completedAt: now },
    });

    return args.livestockId;
  },
});

/**
 * Send vaccination reminders for upcoming/overdue vaccinations.
 * Called by cron job daily.
 */
export const sendVaccinationReminders = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const reminderWindow = 3 * 24 * 60 * 60 * 1000; // 3 days
    const cutoff = now + reminderWindow;

    // Get all livestock with upcoming vaccinations
    const allLivestock = await ctx.db.query("livestock").collect();
    const dueSoon = allLivestock.filter(
      (l) => l.nextVaccination && l.nextVaccination <= cutoff
    );

    if (dueSoon.length === 0) return { sent: 0 };

    let sent = 0;
    for (const animal of dueSoon) {
      // Get user info
      const user = await ctx.db.get(animal.userId);
      if (!user || !user.email) continue;

      // Get farm info
      const farm = await ctx.db.get(animal.farmId);
      const daysUntilDue = Math.ceil(
        (animal.nextVaccination! - now) / (24 * 60 * 60 * 1000)
      );

      // Determine vaccine type from medical history
      const history = animal.medicalHistory || [];
      const lastVaccine = history
        .filter((h) => h.vaccineType && h.treatment.toLowerCase().includes("vaccin"))
        .sort((a, b) => b.date - a.date)[0];
      const vaccineType = lastVaccine?.vaccineType || "unknown";

      // Send reminder email via scheduler
      await ctx.scheduler.runAfter(0, api.emails.sendVaccinationReminder, {
        userId: animal.userId,
        email: user.email,
        name: user.name || "there",
        livestockName: animal.name,
        livestockType: animal.type,
        farmName: farm?.name || "Unknown Farm",
        daysUntilDue,
        scheduledDate: animal.nextVaccination!,
        vaccineType,
      });

      sent++;
    }

    return { sent };
  },
});

// ============================================================
// Vaccination History
// ============================================================

/** Get vaccination history for all user livestock */
export const getVaccinationHistory = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    animalType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get farm names
    const farmIds = [...new Set(livestock.map((l) => l.farmId))];
    const farms = await Promise.all(farmIds.map((id) => ctx.db.get(id)));
    const farmMap = new Map(farms.filter(Boolean).map((f) => [f!._id, f!.name]));

    // Extract vaccination records from medicalHistory
    const vaccinationRecords: Array<{
      livestockId: string;
      livestockName: string;
      livestockType: string;
      farmId: string;
      farmName: string;
      date: number;
      description: string;
      treatment: string;
      cost?: number;
      vaccineType?: string;
    }> = [];

    for (const animal of livestock) {
      if (args.animalType && animal.type.toLowerCase() !== args.animalType.toLowerCase()) continue;

      const history = animal.medicalHistory || [];
      for (const record of history) {
        // Filter to vaccination-related records
        const isVaccination =
          record.treatment.toLowerCase().includes("vaccin") ||
          record.description.toLowerCase().includes("vaccin");

        if (!isVaccination) continue;

        // Date range filter
        if (args.startDate && record.date < args.startDate) continue;
        if (args.endDate && record.date > args.endDate) continue;

        vaccinationRecords.push({
          livestockId: animal._id,
          livestockName: animal.name,
          livestockType: animal.type,
          farmId: animal.farmId,
          farmName: farmMap.get(animal.farmId) || "Unknown Farm",
          date: record.date,
          description: record.description,
          treatment: record.treatment,
          cost: record.cost,
          vaccineType: record.vaccineType,
        });
      }

      // Also add lastVaccination as a record if present
      if (animal.lastVaccination) {
        if (args.startDate && animal.lastVaccination < args.startDate) continue;
        if (args.endDate && animal.lastVaccination > args.endDate) continue;

        // Check if we already have a record for this date
        const exists = vaccinationRecords.some(
          (r) => r.livestockId === animal._id && Math.abs(r.date - animal.lastVaccination!) < 86400000
        );
        if (!exists) {
          vaccinationRecords.push({
            livestockId: animal._id,
            livestockName: animal.name,
            livestockType: animal.type,
            farmId: animal.farmId,
            farmName: farmMap.get(animal.farmId) || "Unknown Farm",
            date: animal.lastVaccination,
            description: "Vaccination completed",
            treatment: "Vaccination",
            vaccineType: undefined,
          });
        }
      }
    }

    // Sort by date descending (most recent first)
    return vaccinationRecords.sort((a, b) => b.date - a.date);
  },
});

// ============================================================
// Vaccination Cost Analytics
// ============================================================

/** Get vaccination cost analytics broken down by animal type and farm */
export const getVaccinationCostAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get farm names
    const farmIds = [...new Set(livestock.map((l) => l.farmId))];
    const farms = await Promise.all(farmIds.map((id) => ctx.db.get(id)));
    const farmMap = new Map(farms.filter(Boolean).map((f) => [f!._id, f!.name]));

    // Collect all vaccination cost records
    const records: Array<{
      livestockType: string;
      farmId: string;
      farmName: string;
      date: number;
      cost: number;
    }> = [];

    for (const animal of livestock) {
      const history = animal.medicalHistory || [];
      for (const record of history) {
        const isVaccination =
          record.treatment.toLowerCase().includes("vaccin") ||
          record.description.toLowerCase().includes("vaccin");
        if (!isVaccination || !record.cost || record.cost <= 0) continue;

        records.push({
          livestockType: animal.type,
          farmId: animal.farmId,
          farmName: farmMap.get(animal.farmId) || "Unknown Farm",
          date: record.date,
          cost: record.cost,
        });
      }
    }

    // Total cost
    const totalCost = records.reduce((sum, r) => sum + r.cost, 0);

    // Cost by animal type
    const costByType: Record<string, number> = {};
    for (const r of records) {
      costByType[r.livestockType] = (costByType[r.livestockType] || 0) + r.cost;
    }
    const byType = Object.entries(costByType)
      .map(([type, cost]) => ({ type, cost }))
      .sort((a, b) => b.cost - a.cost);

    // Cost by farm
    const costByFarm: Record<string, number> = {};
    for (const r of records) {
      costByFarm[r.farmName] = (costByFarm[r.farmName] || 0) + r.cost;
    }
    const byFarm = Object.entries(costByFarm)
      .map(([farm, cost]) => ({ farm, cost }))
      .sort((a, b) => b.cost - a.cost);

    // Monthly spending trend (last 12 months)
    const now = Date.now();
    const monthlySpending: Array<{ month: string; cost: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).getTime();
      const monthCost = records
        .filter((r) => r.date >= monthStart && r.date <= monthEnd)
        .reduce((sum, r) => sum + r.cost, 0);
      monthlySpending.push({ month: monthLabel, cost: monthCost });
    }

    return {
      totalCost,
      recordCount: records.length,
      byType,
      byFarm,
      monthlySpending,
    };
  },
});

// ============================================================
// Vaccine Coverage Rates
// ============================================================

/** Get vaccine coverage rates per herd/animal type */
export const getVaccineCoverage = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

    // Common vaccine types to track
    const vaccineTypes = [
      "FMD", "Anthrax", "Brucellosis", "Rift Valley Fever",
      "Newcastle Disease", "Gumboro", "Rabies", "Blackleg",
      "PPR", "CBPP", "Pasteurellosis", "Trypanosomiasis",
    ];

    // Group animals by type
    const animalsByType: Record<string, typeof livestock> = {};
    for (const animal of livestock) {
      if (animal.status === "quarantine") continue;
      if (!animalsByType[animal.type]) animalsByType[animal.type] = [];
      animalsByType[animal.type].push(animal);
    }

    // Calculate coverage for each animal type
    const coverage = Object.entries(animalsByType).map(([type, animals]) => {
      const totalAnimals = animals.reduce((sum, a) => sum + a.quantity, 0);

      // Track which vaccine types have been given recently
      const vaccineCoverage: Record<string, { vaccinated: number; total: number; lastDate?: number }> = {};
      for (const vax of vaccineTypes) {
        vaccineCoverage[vax] = { vaccinated: 0, total: totalAnimals };
      }

      for (const animal of animals) {
        const history = animal.medicalHistory || [];
        for (const record of history) {
          if (record.date < ninetyDaysAgo) continue;
          const isVaccine = record.vaccineType && vaccineTypes.includes(record.vaccineType);
          if (isVaccine && record.vaccineType) {
            const entry = vaccineCoverage[record.vaccineType];
            if (entry) {
              entry.vaccinated += animal.quantity;
              if (!entry.lastDate || record.date > entry.lastDate) {
                entry.lastDate = record.date;
              }
            }
          }
        }
      }

      // Calculate percentages
      const coverageData = Object.entries(vaccineCoverage)
        .map(([name, data]) => ({
          name,
          vaccinated: Math.min(data.vaccinated, totalAnimals),
          total: totalAnimals,
          percentage: totalAnimals > 0
            ? Math.min(100, Math.round((data.vaccinated / totalAnimals) * 100))
            : 0,
          lastDate: data.lastDate,
        }))
        .sort((a, b) => b.percentage - a.percentage);

      return {
        animalType: type,
        totalAnimals,
        coverage: coverageData,
      };
    });

    return coverage;
  },
});
