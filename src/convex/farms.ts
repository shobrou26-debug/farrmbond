import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ============================================================
// Farm Queries
// ============================================================

/** Get all farms for the current user */
export const listUserFarms = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const farms = await ctx.db
      .query("farms")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return farms;
  },
});

/** Get a single farm by ID */
export const getFarm = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

    return farm;
  },
});

/** Get farm stats (crops count, livestock count, etc.) */
export const getFarmStats = query({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) return null;

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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();

    const farmId = await ctx.db.insert("farms", {
      userId,
      name: args.name,
      description: args.description,
      location: {
        latitude: args.latitude,
        longitude: args.longitude,
        address: args.address,
        city: args.city,
        state: args.state,
        country: args.country,
      },
      size: args.size,
      sizeUnit: args.sizeUnit,
      status: "active",
      soilType: args.soilType,
      soilPh: args.soilPh,
      waterSources: args.waterSources,
      irrigationType: args.irrigationType,
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
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) throw new Error("Farm not found");

    const updates: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.size !== undefined) updates.size = args.size;
    if (args.sizeUnit !== undefined) updates.sizeUnit = args.sizeUnit;
    if (args.status !== undefined) updates.status = args.status;
    if (args.soilType !== undefined) updates.soilType = args.soilType;
    if (args.soilPh !== undefined) updates.soilPh = args.soilPh;
    if (args.waterSources !== undefined) updates.waterSources = args.waterSources;
    if (args.irrigationType !== undefined) updates.irrigationType = args.irrigationType;
    if (args.ndviScore !== undefined) updates.ndviScore = args.ndviScore;

    if (args.latitude !== undefined || args.longitude !== undefined) {
      updates.location = {
        ...farm.location,
        latitude: args.latitude ?? farm.location.latitude,
        longitude: args.longitude ?? farm.location.longitude,
        address: args.address ?? farm.location.address,
        city: args.city ?? farm.location.city,
        state: args.state ?? farm.location.state,
        country: args.country ?? farm.location.country,
      };
    }

    await ctx.db.patch(args.farmId, updates);
    return args.farmId;
  },
});

/** Delete a farm */
export const deleteFarm = mutation({
  args: { farmId: v.id("farms") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const farm = await ctx.db.get(args.farmId);
    if (!farm || farm.userId !== userId) throw new Error("Farm not found");

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

    return true;
  },
});
