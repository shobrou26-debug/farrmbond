import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  verifyFarmOwnership,
  createAuditLog,
  sanitizeInput,
} from "./authHelpers";

// ============================================================
// Yield Prediction Queries
// ============================================================

/** Get all yield predictions for the current user. Optional pagination. */
export const listUserPredictions = query({
  args: {
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const base = ctx.db
      .query("yieldPredictions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc");

    if (args.paginationOpts) {
      return await base.paginate(args.paginationOpts);
    }

    const items = await base.collect();
    return { page: items, isDone: true, continueCursor: null };
  },
});

/** Get yield predictions for a specific crop (with ownership check). Optional pagination. */
export const listCropPredictions = query({
  args: {
    cropId: v.id("crops"),
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    // Verify the user owns this crop before returning predictions
    const crop = await ctx.db.get(args.cropId);
    if (!crop || crop.userId !== userId) {
      throw new Error("Crop not found or unauthorized");
    }

    const base = ctx.db
      .query("yieldPredictions")
      .withIndex("by_crop", (q) => q.eq("cropId", args.cropId))
      .order("desc");

    if (args.paginationOpts) {
      return await base.paginate(args.paginationOpts);
    }

    const items = await base.collect();
    return { page: items, isDone: true, continueCursor: null };
  },
});

/** Get yield predictions for a specific farm. Optional pagination. */
export const listFarmPredictions = query({
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
      .query("yieldPredictions")
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
// Yield Prediction Mutations
// ============================================================

/** Save a new yield prediction */
export const savePrediction = mutation({
  args: {
    cropId: v.id("crops"),
    farmId: v.id("farms"),
    predictedYield: v.number(),
    unit: v.string(),
    confidence: v.number(),
    factors: v.array(
      v.object({
        name: v.string(),
        impact: v.number(),
        description: v.string(),
      })
    ),
    weatherImpact: v.optional(v.number()),
    validDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyFarmOwnership(ctx, args.farmId, userId);

    const now = Date.now();
    const validUntil = now + (args.validDays || 30) * 24 * 60 * 60 * 1000;

    const predictionId = await ctx.db.insert("yieldPredictions", {
      cropId: args.cropId,
      userId,
      farmId: args.farmId,
      predictedYield: args.predictedYield,
      unit: sanitizeInput(args.unit),
      confidence: args.confidence,
      factors: args.factors.map((f) => ({
        name: sanitizeInput(f.name),
        impact: f.impact,
        description: sanitizeInput(f.description),
      })),
      weatherImpact: args.weatherImpact,
      generatedAt: now,
      validUntil,
    });

    await createAuditLog(ctx, {
      userId,
      action: "yield_prediction_created",
      resource: "yieldPredictions",
      resourceId: predictionId,
      changes: { predictedYield: args.predictedYield, confidence: args.confidence },
    });

    return predictionId;
  },
});
