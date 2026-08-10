import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  CRON_BATCH_SIZE,
  cronBatchArgs,
  runCronBatch,
  pageLivestock,
  pageUsers,
  type CronBatchResult,
} from "./cronBatch";
import {
  requireAuth,
  verifyLivestockOwnership,
  verifyFarmOwnership,
  createAuditLog,
  validateString,
  validateNumber,
  sanitizeInput,
  isProActive,
  hasRole,
} from "./authHelpers";
import { ROLES, type Role, type SubscriptionTier } from "./schema";

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
// Free-tier limit (P2-4)
// Free users are limited to FREE_LIVESTOCK_LIMIT livestock entries;
// Pro (paid or in-trial) and platform admins are unlimited. Enforced
// server-side in createLivestock — the UI is never the security boundary.
// ============================================================

export const FREE_LIVESTOCK_LIMIT = 5;

/**
 * Pure: decide whether a livestock-create request hits the free-tier cap.
 * Mirrors the crops free limit (5) and the platform convention that
 * active Pro (paid or in-trial) and admins bypass tier resource limits.
 * Expired Pro is treated as Free — the tier field alone never unlocks
 * the cap (see isProActive in authHelpers).
 */
export function livestockLimitReached(
  currentCount: number,
  user: {
    subscriptionTier?: SubscriptionTier;
    subscriptionEndDate?: number;
    role?: Role;
  }
): boolean {
  if (isProActive(user)) return false;
  if (hasRole(user.role, ROLES.ADMIN)) return false;
  return currentCount >= FREE_LIVESTOCK_LIMIT;
}

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
    const { userId, user } = await requireAuth(ctx);

    // Verify user owns the farm
    await verifyFarmOwnership(ctx, args.farmId, userId);

    // Free tier is limited to FREE_LIVESTOCK_LIMIT entries — enforced
    // server-side, not just in the UI. Pro (paid or in-trial) and
    // platform admins are unlimited. A malicious client calling this
    // mutation directly cannot bypass the cap.
    if (!isProActive(user) && !hasRole(user.role, ROLES.ADMIN)) {
      const existing = await ctx.db
        .query("livestock")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      if (livestockLimitReached(existing.length, user)) {
        throw new Error(
          `Free plan includes ${FREE_LIVESTOCK_LIMIT} livestock entries. Upgrade to FarmBond Pro for unlimited livestock.`
        );
      }
    }

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

    // Filter by farm if specified
    const farmIds = [...new Set(livestock.map((l) => l.farmId))];
    const farms = await Promise.all(farmIds.map((id) => ctx.db.get(id)));
    const farmMap = new Map<string, string>(farms.filter(Boolean).map((f) => [f!._id as string, f!.name]));

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
 * Batched cron: each invocation processes at most CRON_BATCH_SIZE livestock and
 * schedules the next batch when more remain. A `details` marker (livestockId +
 * nextVaccination) makes the notification idempotent — retried batches never
 * create duplicate reminders for the same animal within the window.
 */
export const sendVaccinationReminders = internalMutation({
  args: cronBatchArgs,
  handler: async (ctx, args): Promise<CronBatchResult> => {
    const now = Date.now();
    const reminderWindow = 3 * 24 * 60 * 60 * 1000; // 3 days
    const cutoff = now + reminderWindow;

    return runCronBatch(
      ctx,
      args.cursor,
      CRON_BATCH_SIZE,
      pageLivestock,
      async (ctx, animal) => {
        if (!animal.nextVaccination || animal.nextVaccination > cutoff) {
          return;
        }

        // Get user info
        const user = await ctx.db.get(animal.userId);
        if (!user || !user.email) return;

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

        // Idempotency: skip if this exact reminder was already created in the
        // last 24h (retry-safe — no duplicate notifications per animal/day).
        const recent = await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", animal.userId))
          .order("desc")
          .take(50);
        if (hasRecentVaccinationReminder(recent, animal._id, now, 24 * 60 * 60 * 1000)) {
          return;
        }

        // Create in-app notification
        const isOverdue = daysUntilDue < 0;
        const urgencyText = isOverdue
          ? `${Math.abs(daysUntilDue)} days overdue`
          : `in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`;

        await ctx.db.insert("notifications", {
          userId: animal.userId,
          title: isOverdue ? `⚠️ Vaccination Overdue: ${animal.name}` : `💉 Vaccination Due: ${animal.name}`,
          message: `${animal.name} (${animal.type}) needs ${vaccineType !== 'unknown' ? vaccineType : 'a'} vaccination ${urgencyText}. Farm: ${farm?.name || 'Unknown Farm'}.`,
          type: isOverdue ? "vaccination_overdue" : "vaccination_reminder",
          actionUrl: "/livestock",
          actionLabel: "View Livestock",
          details: JSON.stringify({
            livestockId: animal._id,
            nextVaccination: animal.nextVaccination,
          }),
          isRead: false,
          createdAt: now,
        });

        // Send reminder email via scheduler
        await ctx.scheduler.runAfter(0, internal.emails.sendVaccinationReminder, {
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
      },
      (ctx, cursor) =>
        ctx.scheduler.runAfter(0, internal.livestock.sendVaccinationReminders, { cursor }),
      "sendVaccinationReminders",
      // Overlap protection: daily job with a short chain, but the lease
      // makes a duplicate chain (e.g. after a deploy restart) a no-op.
      { jobName: "vaccination_reminders", ttlMs: 6 * 60 * 60 * 1000 }
    );
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
    const farmMap = new Map<string, string>(farms.filter(Boolean).map((f) => [f!._id as string, f!.name]));

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
    const farmMap = new Map<string, string>(farms.filter(Boolean).map((f) => [f!._id as string, f!.name]));

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
  args: {
    farmId: v.optional(v.string()),
    daysBack: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter by farm if specified
    const filteredLivestock = args.farmId
      ? livestock.filter((l) => l.farmId === args.farmId)
      : livestock;

    const now = Date.now();
    const cutoffDays = args.daysBack || 90;
    const cutoffDate = now - cutoffDays * 24 * 60 * 60 * 1000;

    // Common vaccine types to track
    const vaccineTypes = [
      "FMD", "Anthrax", "Brucellosis", "Rift Valley Fever",
      "Newcastle Disease", "Gumboro", "Rabies", "Blackleg",
      "PPR", "CBPP", "Pasteurellosis", "Trypanosomiasis",
    ];

    // Group animals by type
    const animalsByType: Record<string, typeof filteredLivestock> = {};
    for (const animal of filteredLivestock) {
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
          if (record.date < cutoffDate) continue;
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

// ============================================================
// Vaccine Coverage Alerts
// ============================================================

const COVERAGE_RECOMMENDATIONS: Record<string, { urgency: string; recommendation: string; interval: string }> = {
  "FMD": { urgency: "critical", recommendation: "Schedule immediate FMD vaccination campaign. Quarantine new animals and report suspected cases to local veterinary authorities.", interval: "Every 6 months" },
  "Anthrax": { urgency: "high", recommendation: "Prioritize Anthrax vaccination for all susceptible animals. Contact your county veterinarian for vaccine supply.", interval: "Annually" },
  "Brucellosis": { urgency: "high", recommendation: "Vaccinate all female calves before first breeding. Test and cull positive animals to control spread.", interval: "Annually" },
  "Rift Valley Fever": { urgency: "medium", recommendation: "Vaccinate before the rainy season when mosquito vectors are most active. Protect pregnant animals especially.", interval: "Annually" },
  "Newcastle Disease": { urgency: "critical", recommendation: "Immediately vaccinate all poultry flocks. Isolate sick birds and disinfect coops.", interval: "Every 4 months" },
  "Gumboro": { urgency: "high", recommendation: "Vaccinate chicks at the recommended age. Ensure cold chain storage for vaccines.", interval: "Every 3 months" },
  "Rabies": { urgency: "critical", recommendation: "Vaccinate all dogs and at-risk livestock immediately. Report any suspected rabies cases.", interval: "Annually" },
  "Blackleg": { urgency: "medium", recommendation: "Vaccinate young cattle before the wet season. Avoid grazing on damp, marshy pastures.", interval: "Annually" },
  "PPR": { urgency: "high", recommendation: "Vaccinate all goats and sheep. Maintain flock isolation during outbreaks.", interval: "Annually" },
  "CBPP": { urgency: "medium", recommendation: "Vaccinate cattle in endemic areas. Isolate infected animals and treat with antibiotics.", interval: "Annually" },
  "Pasteurellosis": { urgency: "medium", recommendation: "Vaccinate before transport or periods of stress. Ensure adequate ventilation in housing.", interval: "Every 6 months" },
  "Trypanosomiasis": { urgency: "medium", recommendation: "Implement tsetse fly control measures. Vaccinate in endemic areas and treat affected animals.", interval: "Every 6 months" },
};

/** Get proactive alerts for vaccines below 50% coverage */
export const getCoverageAlerts = query({
  args: {
    farmId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter by farm if specified
    const filteredLivestock = args.farmId
      ? livestock.filter((l) => l.farmId === args.farmId)
      : livestock;

    if (filteredLivestock.length === 0) return { alerts: [], summary: { total: 0, critical: 0, high: 0, medium: 0 } };

    const now = Date.now();
    const cutoffDays = 90;
    const cutoffDate = now - cutoffDays * 24 * 60 * 60 * 1000;

    const vaccineTypes = [
      "FMD", "Anthrax", "Brucellosis", "Rift Valley Fever",
      "Newcastle Disease", "Gumboro", "Rabies", "Blackleg",
      "PPR", "CBPP", "Pasteurellosis", "Trypanosomiasis",
    ];

    // Group animals by type
    const animalsByType: Record<string, typeof filteredLivestock> = {};
    for (const animal of filteredLivestock) {
      if (animal.status === "quarantine") continue;
      if (!animalsByType[animal.type]) animalsByType[animal.type] = [];
      animalsByType[animal.type].push(animal);
    }

    const alerts: Array<{
      vaccineName: string;
      animalType: string;
      percentage: number;
      vaccinated: number;
      total: number;
      urgency: string;
      recommendation: string;
      interval: string;
      severity: "critical" | "warning" | "info";
    }> = [];

    for (const [type, animals] of Object.entries(animalsByType)) {
      const totalAnimals = animals.reduce((sum, a) => sum + a.quantity, 0);
      const vaccineCoverage: Record<string, { vaccinated: number; total: number }> = {};
      for (const vax of vaccineTypes) {
        vaccineCoverage[vax] = { vaccinated: 0, total: totalAnimals };
      }
      for (const animal of animals) {
        const history = animal.medicalHistory || [];
        for (const record of history) {
          if (record.date < cutoffDate) continue;
          if (record.vaccineType && vaccineTypes.includes(record.vaccineType)) {
            const entry = vaccineCoverage[record.vaccineType];
            if (entry) entry.vaccinated += animal.quantity;
          }
        }
      }

      for (const [vaxName, data] of Object.entries(vaccineCoverage)) {
        const pct = totalAnimals > 0
          ? Math.min(100, Math.round((data.vaccinated / totalAnimals) * 100))
          : 0;
        if (pct < 50) {
          const rec = COVERAGE_RECOMMENDATIONS[vaxName];
          alerts.push({
            vaccineName: vaxName,
            animalType: type,
            percentage: pct,
            vaccinated: Math.min(data.vaccinated, totalAnimals),
            total: totalAnimals,
            urgency: rec?.urgency || "medium",
            recommendation: rec?.recommendation || "Schedule vaccination as soon as possible.",
            interval: rec?.interval || "As recommended by veterinarian",
            severity: pct === 0 ? "critical" : pct < 25 ? "critical" : "warning",
          });
        }
      }
    }

    // Sort by severity then percentage
    alerts.sort((a, b) => {
      const sevOrder = { critical: 0, warning: 1, info: 2 };
      return (sevOrder[a.severity] - sevOrder[b.severity]) || (a.percentage - b.percentage);
    });

    const summary = {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === "critical").length,
      high: alerts.filter((a) => a.urgency === "high").length,
      medium: alerts.filter((a) => a.urgency === "medium").length,
    };

    return { alerts, summary };
  },
});

// ============================================================
// Reminder/Alert dedup helpers (pure — unit tested)
// ============================================================

/**
 * Pure: has a vaccination reminder for this exact livestock been created
 * within `windowMs`? The notification carries a `details` marker with the
 * livestockId, which is what makes the daily cron retry-safe.
 */
export function hasRecentVaccinationReminder(
  recent: Array<{ type?: string; details?: string; createdAt?: number }>,
  livestockId: string,
  now: number,
  windowMs: number
): boolean {
  const marker = `"livestockId":"${livestockId}"`;
  return recent.some(
    (n) =>
      (n.type === "vaccination_reminder" || n.type === "vaccination_overdue") &&
      typeof n.details === "string" &&
      n.details.includes(marker) &&
      typeof n.createdAt === "number" &&
      n.createdAt > now - windowMs
  );
}

/**
 * Pure: has a low-coverage alert been created for this user within
 * `windowMs`? The notification carries a `{ kind: "low_coverage_alert" }`
 * details marker, which makes the daily cron retry-safe.
 */
export function hasRecentLowCoverageAlert(
  recent: Array<{ details?: string; createdAt?: number }>,
  now: number,
  windowMs: number
): boolean {
  return recent.some(
    (n) =>
      typeof n.details === "string" &&
      n.details.includes("low_coverage_alert") &&
      typeof n.createdAt === "number" &&
      n.createdAt > now - windowMs
  );
}

// Low-coverage alert batches stay smaller (100) because each item scans the
// user's full livestock table and can schedule an email.
const LOW_COVERAGE_BATCH = 100;

// ============================================================
// Low Coverage Alert Sender (Cron Job)
// ============================================================

export const sendLowCoverageAlerts = internalMutation({
  args: cronBatchArgs,
  handler: async (ctx, args): Promise<CronBatchResult> => {
    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    const vaccineTypes = [
      "FMD", "Anthrax", "Brucellosis", "Rift Valley Fever",
      "Newcastle Disease", "Gumboro", "Rabies", "Blackleg",
      "PPR", "CBPP", "Pasteurellosis", "Trypanosomiasis",
    ];
    let sent = 0;
    let skipped = 0;

    return runCronBatch(
      ctx,
      args.cursor,
      LOW_COVERAGE_BATCH,
      pageUsers,
      async (ctx, user) => {
        if (!user.email) { skipped++; return; }
        const livestock = await ctx.db
          .query("livestock")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect();
        if (livestock.length === 0) { skipped++; return; }

        // Idempotency: skip if a low-coverage alert was already sent within
        // the last 24h for this user (retry-safe — no duplicate alert spam).
        const recent = await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .order("desc")
          .take(50);
        if (hasRecentLowCoverageAlert(recent, now, 24 * 60 * 60 * 1000)) {
          skipped++;
          return;
        }

        const animalsByType: Record<string, typeof livestock> = {};
        for (const animal of livestock) {
          if (animal.status === "quarantine") continue;
          if (!animalsByType[animal.type]) animalsByType[animal.type] = [];
          animalsByType[animal.type].push(animal);
        }

        const alerts: Array<{
          vaccineName: string; animalType: string; percentage: number;
          vaccinated: number; total: number; severity: string;
          recommendation: string; interval: string;
        }> = [];

        for (const [type, animals] of Object.entries(animalsByType)) {
          const totalAnimals = animals.reduce((sum, a) => sum + a.quantity, 0);
          const vaccineCoverage: Record<string, number> = {};
          for (const vax of vaccineTypes) vaccineCoverage[vax] = 0;
          for (const animal of animals) {
            for (const record of (animal.medicalHistory || [])) {
              if (record.date < ninetyDaysAgo) continue;
              if (record.vaccineType && vaccineTypes.includes(record.vaccineType)) {
                vaccineCoverage[record.vaccineType] += animal.quantity;
              }
            }
          }
          for (const [vaxName, vaccinated] of Object.entries(vaccineCoverage)) {
            const pct = totalAnimals > 0 ? Math.min(100, Math.round((vaccinated / totalAnimals) * 100)) : 0;
            if (pct < 50) {
              const rec = COVERAGE_RECOMMENDATIONS[vaxName];
              alerts.push({
                vaccineName: vaxName, animalType: type, percentage: pct,
                vaccinated: Math.min(vaccinated, totalAnimals), total: totalAnimals,
                severity: pct === 0 ? "critical" : pct < 25 ? "critical" : "warning",
                recommendation: rec?.recommendation || "Schedule vaccination as soon as possible.",
                interval: rec?.interval || "As recommended",
              });
            }
          }
        }

        if (alerts.length === 0) { skipped++; return; }
        alerts.sort((a, b) => {
          const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
          return (sevOrder[a.severity] - sevOrder[b.severity]) || (a.percentage - b.percentage);
        });
        const summary = {
          total: alerts.length,
          critical: alerts.filter((a) => a.severity === "critical").length,
          high: alerts.filter((a) => a.severity === "critical" || a.percentage < 25).length,
          medium: alerts.filter((a) => a.severity === "warning").length,
        };
        await ctx.db.insert("notifications", {
          userId: user._id, type: "warning",
          title: `${alerts.length} vaccine${alerts.length !== 1 ? 's' : ''} below 50% coverage`,
          message: `${summary.critical} critical, ${summary.medium} warnings. Update your vaccination schedule.`,
          details: JSON.stringify({ kind: "low_coverage_alert" }),
          isRead: false, createdAt: now,
        });
        await ctx.scheduler.runAfter(0, internal.emails.sendLowCoverageAlert, {
          userId: user._id, email: user.email, name: user.name || "there",
          alerts: alerts.slice(0, 10), summary,
        });
        sent++;
      },
      (ctx, cursor) =>
        ctx.scheduler.runAfter(0, internal.livestock.sendLowCoverageAlerts, { cursor }),
      "sendLowCoverageAlerts",
      // Overlap protection: daily job — a duplicate chain is a no-op.
      { jobName: "low_coverage_alerts", ttlMs: 6 * 60 * 60 * 1000 }
    );
  },
});

// ============================================================
// Coverage Trends (Monthly historical data)
// ============================================================

/** Get monthly vaccine coverage trends for the last 12 months */
export const getCoverageTrends = query({
  args: {
    farmId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const filteredLivestock = args.farmId
      ? livestock.filter((l) => l.farmId === args.farmId)
      : livestock;

    if (filteredLivestock.length === 0) return { months: [], vaccineNames: [] };

    const now = Date.now();
    const vaccineTypes = [
      "FMD", "Anthrax", "Brucellosis", "Rift Valley Fever",
      "Newcastle Disease", "Gumboro", "Rabies", "Blackleg",
      "PPR", "CBPP", "Pasteurellosis", "Trypanosomiasis",
    ];

    // Group by animal type
    const animalsByType: Record<string, typeof filteredLivestock> = {};
    for (const animal of filteredLivestock) {
      if (animal.status === "quarantine") continue;
      if (!animalsByType[animal.type]) animalsByType[animal.type] = [];
      animalsByType[animal.type].push(animal);
    }

    // Build monthly buckets for the last 12 months
    const months: Array<Record<string, string | number>> = [];
    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(now);
      monthStart.setMonth(monthStart.getMonth() - i, 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(monthStart);
      monthEnd.setMonth(monthEnd.getMonth() + 1);
      monthEnd.setHours(0, 0, 0, 0);

      const label = monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      const bucket: Record<string, string | number> = { month: label };

      // For each vaccine type, calculate coverage up to the end of this month
      const cutoff = monthEnd.getTime();
      for (const vax of vaccineTypes) {
        let totalAnimals = 0;
        let vaccinated = 0;
        for (const [, animals] of Object.entries(animalsByType)) {
          const total = animals.reduce((sum, a) => sum + a.quantity, 0);
          totalAnimals += total;
          for (const animal of animals) {
            for (const record of (animal.medicalHistory || [])) {
              if (record.date > cutoff) continue;
              if (record.date < cutoff - 365 * 24 * 60 * 60 * 1000) continue;
              if (record.vaccineType === vax) {
                vaccinated += animal.quantity;
              }
            }
          }
        }
        const pct = totalAnimals > 0 ? Math.min(100, Math.round((vaccinated / totalAnimals) * 100)) : 0;
        bucket[vax] = pct;
      }
      months.push(bucket);
    }

    // Find which vaccine types actually have data
    const vaccineNames = vaccineTypes.filter((vax) =>
      months.some((m) => (m[vax] as number) > 0)
    );

    return { months, vaccineNames };
  },
});

// ============================================================
// Coverage Trends By Farm (Comparison Mode)
// ============================================================

/** Get monthly vaccine coverage trends broken down by farm for comparison */
export const getCoverageTrendsByFarm = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (livestock.length === 0) return { farmTrends: [], vaccineNames: [], months: [] };

    const now = Date.now();
    const vaccineTypes = [
      "FMD", "Anthrax", "Brucellosis", "Rift Valley Fever",
      "Newcastle Disease", "Gumboro", "Rabies", "Blackleg",
      "PPR", "CBPP", "Pasteurellosis", "Trypanosomiasis",
    ];

    // Get farm names
    const farmIds = [...new Set(livestock.map((l) => l.farmId))];
    const farms = await Promise.all(farmIds.map((id) => ctx.db.get(id)));
    const farmMap = new Map<string, string>(farms.filter(Boolean).map((f) => [f!._id as string, f!.name]));

    // Group livestock by farm
    const livestockByFarm: Record<string, typeof livestock> = {};
    for (const animal of livestock) {
      if (animal.status === "quarantine") continue;
      if (!livestockByFarm[animal.farmId]) livestockByFarm[animal.farmId] = [];
      livestockByFarm[animal.farmId].push(animal);
    }

    // Build monthly buckets for the last 12 months
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i, 1);
      months.push(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
    }

    // For each farm, calculate monthly coverage
    const farmTrends: Array<{
      farmId: string;
      farmName: string;
      data: Array<Record<string, string | number>>;
    }> = [];

    for (const [farmId, animals] of Object.entries(livestockByFarm)) {
      const farmName = farmMap.get(farmId) || "Unknown Farm";
      const data: Array<Record<string, string | number>> = [];

      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now);
        monthStart.setMonth(monthStart.getMonth() - i, 1);
        monthStart.setHours(0, 0, 0, 0);
        const monthEnd = new Date(monthStart);
        monthEnd.setMonth(monthEnd.getMonth() + 1);
        monthEnd.setHours(0, 0, 0, 0);

        const label = monthStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
        const bucket: Record<string, string | number> = { month: label };

        const cutoff = monthEnd.getTime();
        const totalAnimals = animals.reduce((sum, a) => sum + a.quantity, 0);

        for (const vax of vaccineTypes) {
          let vaccinated = 0;
          for (const animal of animals) {
            for (const record of (animal.medicalHistory || [])) {
              if (record.date > cutoff) continue;
              if (record.date < cutoff - 365 * 24 * 60 * 60 * 1000) continue;
              if (record.vaccineType === vax) {
                vaccinated += animal.quantity;
              }
            }
          }
          const pct = totalAnimals > 0 ? Math.min(100, Math.round((vaccinated / totalAnimals) * 100)) : 0;
          bucket[vax] = pct;
        }
        data.push(bucket);
      }

      farmTrends.push({ farmId, farmName, data });
    }

    // Find which vaccine types have data across any farm
    const vaccineNames = vaccineTypes.filter((vax) =>
      farmTrends.some((ft) => ft.data.some((m) => (m[vax] as number) > 0))
    );

    return { farmTrends, vaccineNames, months };
  },
});

// ============================================================
// Disease Alerts (derived from real livestock health records)
// ============================================================

/**
 * Derive disease alerts from the user's actual livestock records:
 * - animals with status "sick" → high-severity alert
 * - animals with status "quarantine" → critical-severity alert
 * - herd-level alert when 2+ animals of the same type are sick/quarantine
 *
 * Alerts are user-scoped (requireAuth) and include the farm name and the
 * affected head count. No fabricated outbreaks — only real record-derived
 * signals.
 */
export const getDiseaseAlerts = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const animals = await ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Load farm names for alert locations
    const farmIds = [...new Set(animals.map((a) => a.farmId))];
    const farms = await Promise.all(farmIds.map((id) => ctx.db.get(id)));
    const farmNames = new Map(
      farms.filter((f) => f !== null).map((f) => [f._id, f.name])
    );

    const SEVERITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    const alerts: {
      id: string;
      disease: string;
      severity: "critical" | "high" | "medium" | "low";
      affectedCount: number;
      location: string;
      symptoms: string[];
      preventionTips: string[];
      reportedDate: string;
    }[] = [];

    const sickByType = new Map<string, { count: number; animals: typeof animals }>();

    for (const animal of animals) {
      if (animal.status !== "sick" && animal.status !== "quarantine") continue;

      const isQuarantine = animal.status === "quarantine";
      const severity: "critical" | "high" =
        isQuarantine || (animal.healthScore !== undefined && animal.healthScore < 40)
          ? "critical"
          : "high";
      const history = animal.medicalHistory ?? [];
      const lastEntry = history[history.length - 1];

      const symptoms: string[] = [];
      if (lastEntry?.description) symptoms.push(lastEntry.description);
      symptoms.push("Reduced appetite or activity");

      const typeKey = animal.type.toLowerCase();
      const existing = sickByType.get(typeKey);
      sickByType.set(typeKey, {
        count: (existing?.count ?? 0) + animal.quantity,
        animals: [...(existing?.animals ?? []), animal],
      });

      alerts.push({
        id: animal._id,
        disease: `${animal.name} (${animal.type}) — ${isQuarantine ? "under quarantine" : "showing illness signs"}`,
        severity,
        affectedCount: animal.quantity,
        location: farmNames.get(animal.farmId) ?? "Unknown farm",
        symptoms,
        preventionTips: [
          "Isolate affected animals from the rest of the herd",
          "Disinfect housing, feeding and watering equipment",
          "Contact your veterinarian for a diagnosis and treatment plan",
        ],
        reportedDate: new Date(lastEntry?.date ?? animal.updatedAt).toISOString().split("T")[0],
      });
    }

    // Herd-level alerts: multiple sick animals of the same type
    for (const [typeKey, group] of sickByType) {
      if (group.animals.length < 2) continue;
      alerts.push({
        id: `herd-${typeKey}`,
        disease: `Possible ${typeKey} disease outbreak in your herd`,
        severity: group.animals.some((a) => a.status === "quarantine") ? "critical" : "high",
        affectedCount: group.count,
        location: "Across your farms",
        symptoms: [
          "Multiple animals of the same type showing illness signs",
          "Monitor the whole group for spreading symptoms",
        ],
        preventionTips: [
          "Separate the affected group immediately",
          "Step up biosecurity and disinfection",
          "Request a veterinary visit for the whole group",
        ],
        reportedDate: new Date().toISOString().split("T")[0],
      });
    }

    return alerts.sort(
      (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    );
  },
});
