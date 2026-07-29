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

/** Get all yield predictions for the current user */
export const listUserPredictions = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    return await ctx.db
      .query("yieldPredictions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Get yield predictions for a specific crop (with ownership check) */
export const listCropPredictions = query({
  args: { cropId: v.id("crops") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    // Verify the user owns this crop before returning predictions
    const crop = await ctx.db.get(args.cropId);
    if (!crop || crop.userId !== userId) {
      throw new Error("Crop not found or unauthorized");
    }

    return await ctx.db
      .query("yieldPredictions")
      .withIndex("by_crop", (q) => q.eq("cropId", args.cropId))
      .order("desc")
      .collect();
  },
});

/** Get yield predictions for a specific farm */
export const listFarmPredictions = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyFarmOwnership(ctx, args.farmId, userId);

    return await ctx.db
      .query("yieldPredictions")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .collect();
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
