import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  verifyCropOwnership,
  verifyFarmOwnership,
  createAuditLog,
  validateString,
  validateNumber,
  sanitizeInput,
  isProActive,
} from "./authHelpers";

// ============================================================
// Crop Queries
// ============================================================

/** Get a single crop by ID with ownership verification. */
export const getCrop = query({
  args: { cropId: v.id("crops") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const crop = await ctx.db.get(args.cropId);
    if (!crop || crop.userId !== userId) return null;
    return crop;
  },
});

/** Get all crops for the current user. Optional pagination for large datasets. */
export const listUserCrops = query({
  args: {
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const base = ctx.db
      .query("crops")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc");

    if (args.paginationOpts) {
      return await base.paginate(args.paginationOpts);
    }

    const items = await base.collect();
    return { page: items, isDone: true, continueCursor: null };
  },
});

/** Get crops for a specific farm. Optional pagination. */
export const listFarmCrops = query({
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
      .query("crops")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc");

    if (args.paginationOpts) {
      return await base.paginate(args.paginationOpts);
    }

    const items = await base.collect();
    return { page: items, isDone: true, continueCursor: null };
  },
});

/** Get active crops count */
export const getActiveCropsCount = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const crops = await ctx.db
      .query("crops")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return crops.filter(
      (c) => c.status !== "harvested" && c.status !== "failed"
    ).length;
  },
});

// ============================================================
// Crop Mutations
// ============================================================

/** Create a new crop */
export const createCrop = mutation({
  args: {
    farmId: v.id("farms"),
    name: v.string(),
    variety: v.optional(v.string()),
    type: v.string(),
    plantingDate: v.number(),
    expectedHarvestDate: v.optional(v.number()),
    quantity: v.number(),
    unit: v.string(),
    plotNumber: v.optional(v.string()),
    expectedYield: v.optional(v.number()),
    seedCost: v.optional(v.number()),
    fertilizerCost: v.optional(v.number()),
    laborCost: v.optional(v.number()),
    otherCosts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);

    // Verify user owns the farm
    await verifyFarmOwnership(ctx, args.farmId, userId);

    // Free tier is limited to 5 crops — enforced server-side, not just in the UI.
    // Pro (paid or in-trial) is unlimited.
    if (!isProActive(user)) {
      const crops = await ctx.db
        .query("crops")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      if (crops.length >= 5) {
        throw new Error(
          "Free plan includes 5 crops. Upgrade to FarmBond Pro for unlimited crops."
        );
      }
    }

    // Input validation
    const name = sanitizeInput(validateString(args.name, "Crop name", 100));
    const type = sanitizeInput(validateString(args.type, "Crop type", 50));
    validateNumber(args.quantity, "Quantity", 0.01, 1000000);

    const now = Date.now();

    const cropId = await ctx.db.insert("crops", {
      farmId: args.farmId,
      userId,
      name,
      variety: args.variety ? sanitizeInput(args.variety) : undefined,
      type,
      plantingDate: args.plantingDate,
      expectedHarvestDate: args.expectedHarvestDate,
      quantity: args.quantity,
      unit: args.unit,
      status: "seedling",
      healthScore: 100,
      plotNumber: args.plotNumber ? sanitizeInput(args.plotNumber) : undefined,
      expectedYield: args.expectedYield,
      seedCost: args.seedCost,
      fertilizerCost: args.fertilizerCost,
      laborCost: args.laborCost,
      otherCosts: args.otherCosts,
      createdAt: now,
      updatedAt: now,
    });

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "crop_created",
      resource: "crops",
      resourceId: cropId,
      changes: { name, type, farmId: args.farmId },
    });

    return cropId;
  },
});

/** Update a crop */
export const updateCrop = mutation({
  args: {
    cropId: v.id("crops"),
    name: v.optional(v.string()),
    variety: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("seedling"),
        v.literal("growing"),
        v.literal("flowering"),
        v.literal("fruiting"),
        v.literal("harvest_ready"),
        v.literal("harvested"),
        v.literal("failed")
      )
    ),
    healthScore: v.optional(v.number()),
    expectedHarvestDate: v.optional(v.number()),
    actualHarvestDate: v.optional(v.number()),
    actualYield: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyCropOwnership(ctx, args.cropId, userId);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = sanitizeInput(validateString(args.name, "Crop name", 100));
    if (args.variety !== undefined) updates.variety = sanitizeInput(args.variety);
    if (args.status !== undefined) updates.status = args.status;
    if (args.healthScore !== undefined) updates.healthScore = validateNumber(args.healthScore, "Health score", 0, 100);
    if (args.expectedHarvestDate !== undefined) updates.expectedHarvestDate = args.expectedHarvestDate;
    if (args.actualHarvestDate !== undefined) updates.actualHarvestDate = args.actualHarvestDate;
    if (args.actualYield !== undefined) updates.actualYield = validateNumber(args.actualYield, "Actual yield", 0);

    await ctx.db.patch(args.cropId, updates);

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "crop_updated",
      resource: "crops",
      resourceId: args.cropId,
      changes: { updatedFields: Object.keys(updates).filter((k) => k !== "updatedAt") },
    });

    return args.cropId;
  },
});

/** Delete a crop */
export const deleteCrop = mutation({
  args: { cropId: v.id("crops") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const crop = await verifyCropOwnership(ctx, args.cropId, userId);

    await ctx.db.delete(args.cropId);

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "crop_deleted",
      resource: "crops",
      resourceId: args.cropId,
      changes: { name: crop.name, type: crop.type } as Record<string, unknown>,
    });

    return true;
  },
});
