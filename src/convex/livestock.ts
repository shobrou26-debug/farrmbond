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

/** Get all livestock for the current user */
export const listUserLivestock = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    return await ctx.db
      .query("livestock")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Get livestock for a specific farm */
export const listFarmLivestock = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyFarmOwnership(ctx, args.farmId, userId);

    return await ctx.db
      .query("livestock")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .collect();
  },
});

// ============================================================
// Livestock Mutations
// ============================================================

/** Create a new livestock entry */
export const createLivestock = mutation({
  args: {
    farmId: v.id("farms"),
    name: v.string(),
    type: v.string(),
    breed: v.optional(v.string()),
    quantity: v.number(),
    unit: v.string(),
    acquisitionDate: v.number(),
    acquisitionCost: v.optional(v.number()),
    productionType: v.optional(v.string()),
    feedType: v.optional(v.string()),
    dailyFeedCost: v.optional(v.number()),
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
