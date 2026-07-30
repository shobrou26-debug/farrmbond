import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  verifyLivestockOwnership,
  verifyFarmOwnership,
  createAuditLog,
  validateString,
  validateNumber,
  sanitizeInput,
} from "./authHelpers";

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
