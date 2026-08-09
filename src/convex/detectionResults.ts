import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  requireAuth,
  verifyFarmOwnership,
  createAuditLog,
  sanitizeInput,
} from "./authHelpers";

// ============================================================
// Detection Image Handling (P2-2)
//
// Historically detection images were stored as base64 data URLs in
// the `imageUrl` field, which bloats documents as the history grows.
// New detections now upload the raw file to Convex file storage and
// store a storage reference in `imageStorageId`. `imageUrl` remains
// for legacy records and as a fallback when an upload fails, so no
// existing data is lost and the UI contract (a string `imageUrl`)
// is preserved by resolving storage references in the list queries.
// ============================================================

/**
 * Pure: does this detection carry any image data (legacy URL or a
 * storage reference)? At least one is required to save a detection.
 */
export function hasDetectionImage(
  imageUrl?: string,
  imageStorageId?: string
): boolean {
  return Boolean(imageUrl?.trim()) || Boolean(imageStorageId);
}

/**
 * Pure: resolve the display URL for a detection row. A resolved
 * storage URL wins over a legacy data URL; falls back to the legacy
 * URL; returns null when no image exists.
 */
export function resolveDetectionImageUrl(opts: {
  legacyImageUrl?: string;
  storageUrl?: string | null;
}): string | null {
  if (opts.storageUrl) return opts.storageUrl;
  return opts.legacyImageUrl ?? null;
}

/** Resolve a stored detection row's image to a displayable URL. */
async function withResolvedImageUrl<T extends Doc<"detectionResults">>(
  ctx: QueryCtx,
  item: T
): Promise<T & { imageUrl: string }> {
  if (item.imageStorageId) {
    const storageUrl = await ctx.storage.getUrl(item.imageStorageId);
    return {
      ...item,
      imageUrl: resolveDetectionImageUrl({
        legacyImageUrl: item.imageUrl,
        storageUrl,
      }) ?? "",
    };
  }
  return { ...item, imageUrl: item.imageUrl ?? "" };
}

/** Generate a client upload URL for a detection image (auth required). */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

// ============================================================
// Detection Queries
// ============================================================

/** Get all detection results for the current user. Optional pagination. */
export const listUserDetections = query({
  args: {
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const base = ctx.db
      .query("detectionResults")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc");

    if (args.paginationOpts) {
      const page = await base.paginate(args.paginationOpts);
      return {
        ...page,
        page: await Promise.all(page.page.map((item) => withResolvedImageUrl(ctx, item))),
      };
    }

    const items = await base.collect();
    const resolved = await Promise.all(items.map((item) => withResolvedImageUrl(ctx, item)));
    return { page: resolved, isDone: true, continueCursor: null };
  },
});

/** Get detection results for a specific farm. Optional pagination. */
export const listFarmDetections = query({
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
      .query("detectionResults")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc");

    if (args.paginationOpts) {
      const page = await base.paginate(args.paginationOpts);
      return {
        ...page,
        page: await Promise.all(page.page.map((item) => withResolvedImageUrl(ctx, item))),
      };
    }

    const items = await base.collect();
    const resolved = await Promise.all(items.map((item) => withResolvedImageUrl(ctx, item)));
    return { page: resolved, isDone: true, continueCursor: null };
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
    // Image — either a legacy data URL or a Convex file-storage reference.
    imageUrl: v.optional(v.string()),
    imageStorageId: v.optional(v.id("_storage")),
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

    if (!hasDetectionImage(args.imageUrl, args.imageStorageId)) {
      throw new Error("A detection must include an image (imageUrl or imageStorageId)");
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
      imageStorageId: args.imageStorageId,
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
