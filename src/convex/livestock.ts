import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ============================================================
// Livestock Queries
// ============================================================

/** Get all livestock for the current user */
export const listUserLivestock = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

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
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();

    return await ctx.db.insert("livestock", {
      farmId: args.farmId,
      userId,
      name: args.name,
      type: args.type,
      breed: args.breed,
      quantity: args.quantity,
      unit: args.unit,
      status: "healthy",
      healthScore: 100,
      acquisitionDate: args.acquisitionDate,
      acquisitionCost: args.acquisitionCost,
      productionType: args.productionType,
      feedType: args.feedType,
      dailyFeedCost: args.dailyFeedCost,
      createdAt: now,
      updatedAt: now,
    });
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const livestock = await ctx.db.get(args.livestockId);
    if (!livestock || livestock.userId !== userId) throw new Error("Livestock not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.status !== undefined) updates.status = args.status;
    if (args.healthScore !== undefined) updates.healthScore = args.healthScore;
    if (args.quantity !== undefined) updates.quantity = args.quantity;
    if (args.lastVaccination !== undefined) updates.lastVaccination = args.lastVaccination;
    if (args.nextVaccination !== undefined) updates.nextVaccination = args.nextVaccination;
    if (args.lastCheckup !== undefined) updates.lastCheckup = args.lastCheckup;
    if (args.dailyFeedCost !== undefined) updates.dailyFeedCost = args.dailyFeedCost;

    await ctx.db.patch(args.livestockId, updates);
    return args.livestockId;
  },
});

/** Delete livestock */
export const deleteLivestock = mutation({
  args: { livestockId: v.id("livestock") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const livestock = await ctx.db.get(args.livestockId);
    if (!livestock || livestock.userId !== userId) throw new Error("Livestock not found");

    await ctx.db.delete(args.livestockId);
    return true;
  },
});
