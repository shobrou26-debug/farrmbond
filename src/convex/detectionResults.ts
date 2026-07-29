import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  verifyFarmOwnership,
  createAuditLog,
  sanitizeInput,
} from "./authHelpers";

// ============================================================
// Detection Queries
// ============================================================

/** Get all detection results for the current user */
export const listUserDetections = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    return await ctx.db
      .query("detectionResults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Get detection results for a specific farm */
export const listFarmDetections = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyFarmOwnership(ctx, args.farmId, userId);

    return await ctx.db
      .query("detectionResults")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc")
      .collect();
  },
});

// ============================================================
// Detection Mutations
// ============================================================

/** Save a new detection result */
export const saveDetection = mutation({
  args: {
    farmId: v.optional(v.id("farms")),
    cropId: v.optional(v.id("crops")),
    type: v.union(v.literal("disease"), v.literal("pest")),
    name: v.string(),
    confidence: v.number(),
    imageUrl: v.string(),
    description: v.string(),
    severity: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical")
    ),
    recommendations: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    if (args.farmId) {
      await verifyFarmOwnership(ctx, args.farmId, userId);
    }

    const now = Date.now();

    const detectionId = await ctx.db.insert("detectionResults", {
      userId,
      farmId: args.farmId,
      cropId: args.cropId,
      type: args.type,
      name: sanitizeInput(args.name),
      confidence: args.confidence,
      imageUrl: args.imageUrl,
      description: sanitizeInput(args.description),
      severity: args.severity,
      recommendations: args.recommendations.map((r) => sanitizeInput(r)),
      detectedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "detection_saved",
      resource: "detectionResults",
      resourceId: detectionId,
      changes: { type: args.type, name: args.name, severity: args.severity },
    });

    return detectionId;
  },
});
