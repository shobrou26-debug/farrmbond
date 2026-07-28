import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  requireRole,
  verifyFarmOwnership,
  createAuditLog,
  validateString,
  validateNumber,
  validateCoordinates,
  sanitizeInput,
  requireOwnerOfResource,
} from "./authHelpers";
import { ROLES } from "./schema";

// ============================================================
// Farm Queries
// ============================================================

/** Get all farms for the current user */
export const listUserFarms = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    return await ctx.db
      .query("farms")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Get a single farm by ID */
export const getFarm = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    return farm;
  },
});

/** Get farm stats (crops count, livestock count, etc.) */
export const getFarmStats = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await verifyFarmOwnership(ctx, args.farmId, userId);

    const crops = await ctx.db
      .query("crops")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .collect();

    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .collect();

    const activeCrops = crops.filter((c) => c.status !== "harvested" && c.status !== "failed");
    const healthyLivestock = livestock.filter((l) => l.status === "healthy");

    return {
      totalCrops: crops.length,
      activeCrops: activeCrops.length,
      totalLivestock: livestock.length,
      healthyLivestock: healthyLivestock.length,
      farmSize: farm.size,
      ndviScore: farm.ndviScore,
    };
  },
});

// ============================================================
// Farm Mutations
// ============================================================

/** Create a new farm */
export const createFarm = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    latitude: v.number(),
    longitude: v.number(),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    size: v.number(),
    sizeUnit: v.union(v.literal("hectares"), v.literal("acres")),
    soilType: v.optional(v.string()),
    soilPh: v.optional(v.number()),
    waterSources: v.optional(v.array(v.string())),
    irrigationType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Authorization: any authenticated user can create a farm
    const { userId } = await requireAuth(ctx);

    // Input validation
    const name = sanitizeInput(validateString(args.name, "Farm name", 100));
    validateNumber(args.size, "Farm size", 0.01, 100000);
    validateCoordinates(args.latitude, args.longitude);
    if (args.soilPh !== undefined) {
      validateNumber(args.soilPh, "Soil pH", 0, 14);
    }

    const now = Date.now();

    const farmId = await ctx.db.insert("farms", {
      userId,
      name,
      description: args.description ? sanitizeInput(args.description) : undefined,
      location: {
        latitude: args.latitude,
        longitude: args.longitude,
        address: args.address ? sanitizeInput(args.address) : undefined,
        city: args.city ? sanitizeInput(args.city) : undefined,
        state: args.state ? sanitizeInput(args.state) : undefined,
        country: args.country ? sanitizeInput(args.country) : undefined,
      },
      size: args.size,
      sizeUnit: args.sizeUnit,
      status: "active",
      soilType: args.soilType ? sanitizeInput(args.soilType) : undefined,
      soilPh: args.soilPh,
      waterSources: args.waterSources,
      irrigationType: args.irrigationType ? sanitizeInput(args.irrigationType) : undefined,
      createdAt: now,
      updatedAt: now,
    });

    // Update user's farm size
    const user = await ctx.db.get(userId);
    if (user) {
      await ctx.db.patch(userId, {
        farmSize: (user.farmSize || 0) + args.size,
        updatedAt: now,
      });
    }

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "farm_created",
      resource: "farms",
      resourceId: farmId,
      changes: { name, size: args.size, sizeUnit: args.sizeUnit },
    });

    return farmId;
  },
});

/** Update a farm */
export const updateFarm = mutation({
  args: {
    farmId: v.id("farms"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
    address: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    country: v.optional(v.string()),
    size: v.optional(v.number()),
    sizeUnit: v.optional(v.union(v.literal("hectares"), v.literal("acres"))),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("inactive"),
        v.literal("harvesting"),
        v.literal("planting")
      )
    ),
    soilType: v.optional(v.string()),
    soilPh: v.optional(v.number()),
    waterSources: v.optional(v.array(v.string())),
    irrigationType: v.optional(v.string()),
    ndviScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await verifyFarmOwnership(ctx, args.farmId, userId);

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = sanitizeInput(validateString(args.name, "Farm name", 100));
    if (args.description !== undefined) updates.description = sanitizeInput(args.description);
    if (args.size !== undefined) updates.size = validateNumber(args.size, "Farm size", 0.01, 100000);
    if (args.sizeUnit !== undefined) updates.sizeUnit = args.sizeUnit;
    if (args.status !== undefined) updates.status = args.status;
    if (args.soilType !== undefined) updates.soilType = sanitizeInput(args.soilType);
    if (args.soilPh !== undefined) updates.soilPh = validateNumber(args.soilPh, "Soil pH", 0, 14);
    if (args.waterSources !== undefined) updates.waterSources = args.waterSources;
    if (args.irrigationType !== undefined) updates.irrigationType = sanitizeInput(args.irrigationType);
    if (args.ndviScore !== undefined) updates.ndviScore = validateNumber(args.ndviScore, "NDVI Score", 0, 100);

    if (args.latitude !== undefined || args.longitude !== undefined) {
      const lat = args.latitude ?? farm.location.latitude;
      const lng = args.longitude ?? farm.location.longitude;
      validateCoordinates(lat, lng);
      updates.location = {
        ...farm.location,
        latitude: lat,
        longitude: lng,
        address: args.address ? sanitizeInput(args.address) : farm.location.address,
        city: args.city ? sanitizeInput(args.city) : farm.location.city,
        state: args.state ? sanitizeInput(args.state) : farm.location.state,
        country: args.country ? sanitizeInput(args.country) : farm.location.country,
      };
    }

    await ctx.db.patch(args.farmId, updates);

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "farm_updated",
      resource: "farms",
      resourceId: args.farmId,
      changes: { updatedFields: Object.keys(updates).filter((k) => k !== "updatedAt") },
    });

    return args.farmId;
  },
});

/** Delete a farm */
export const deleteFarm = mutation({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const farm = await verifyFarmOwnership(ctx, args.farmId, userId);

    // Delete associated crops
    const crops = await ctx.db
      .query("crops")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .collect();

    for (const crop of crops) {
      await ctx.db.delete(crop._id);
    }

    // Delete associated livestock
    const livestock = await ctx.db
      .query("livestock")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .collect();

    for (const animal of livestock) {
      await ctx.db.delete(animal._id);
    }

    // Delete the farm
    await ctx.db.delete(args.farmId);

    // Audit log
    await createAuditLog(ctx, {
      userId,
      action: "farm_deleted",
      resource: "farms",
      resourceId: args.farmId,
      changes: { name: farm.name, cropsDeleted: crops.length, livestockDeleted: livestock.length } as Record<string, unknown>,
    });

    return true;
  },
});
