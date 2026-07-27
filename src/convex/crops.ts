import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ============================================================
// Crop Queries
// ============================================================

/** Get all crops for the current user */
export const listUserCrops = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("crops")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Get crops for a specific farm */
export const listFarmCrops = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("crops")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .collect();
  },
});

/** Get active crops count */
export const getActiveCropsCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();

    return await ctx.db.insert("crops", {
      farmId: args.farmId,
      userId,
      name: args.name,
      variety: args.variety,
      type: args.type,
      plantingDate: args.plantingDate,
      expectedHarvestDate: args.expectedHarvestDate,
      quantity: args.quantity,
      unit: args.unit,
      status: "seedling",
      healthScore: 100,
      plotNumber: args.plotNumber,
      expectedYield: args.expectedYield,
      seedCost: args.seedCost,
      fertilizerCost: args.fertilizerCost,
      laborCost: args.laborCost,
      otherCosts: args.otherCosts,
      createdAt: now,
      updatedAt: now,
    });
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const crop = await ctx.db.get(args.cropId);
    if (!crop || crop.userId !== userId) throw new Error("Crop not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.variety !== undefined) updates.variety = args.variety;
    if (args.status !== undefined) updates.status = args.status;
    if (args.healthScore !== undefined) updates.healthScore = args.healthScore;
    if (args.expectedHarvestDate !== undefined) updates.expectedHarvestDate = args.expectedHarvestDate;
    if (args.actualHarvestDate !== undefined) updates.actualHarvestDate = args.actualHarvestDate;
    if (args.actualYield !== undefined) updates.actualYield = args.actualYield;

    await ctx.db.patch(args.cropId, updates);
    return args.cropId;
  },
});

/** Delete a crop */
export const deleteCrop = mutation({
  args: { cropId: v.id("crops") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const crop = await ctx.db.get(args.cropId);
    if (!crop || crop.userId !== userId) throw new Error("Crop not found");

    await ctx.db.delete(args.cropId);
    return true;
  },
});
