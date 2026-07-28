import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ============================================================
// Ads & Promotions Backend
// ============================================================

/**
 * Get all active ads (filtered by date and status)
 */
export const getActiveAds = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const ads = await ctx.db
      .query("ads")
      .withIndex("by_active")
      .collect();

    // Filter to only active ads within their date range
    return ads.filter(
      (ad) =>
        ad.isActive &&
        ad.startDate <= now &&
        ad.endDate >= now
    );
  },
});

/**
 * Get ads targeted to the current user
 */
export const getTargetedAds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user) return [];

    const now = Date.now();
    const allAds = await ctx.db.query("ads").collect();

    // Filter by active status, date range, and targeting
    return allAds.filter((ad) => {
      if (!ad.isActive) return false;
      if (ad.startDate > now || ad.endDate < now) return false;

      // Check role targeting
      if (ad.targetRoles.length > 0 && user.role && !ad.targetRoles.includes(user.role)) {
        return false;
      }

      // Check country targeting
      if (ad.targetCountries && ad.targetCountries.length > 0 && user.country) {
        if (!ad.targetCountries.includes(user.country)) {
          return false;
        }
      }

      // Check subscription tier targeting
      if (ad.targetSubscriptionTiers.length > 0) {
        const userTier = user.subscriptionTier || "free";
        if (!ad.targetSubscriptionTiers.includes(userTier)) {
          return false;
        }
      }

      return true;
    });
  },
});

/**
 * Get ad by ID
 */
export const getAdById = query({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.adId);
  },
});

/**
 * Record an ad impression for a user
 */
export const recordImpression = mutation({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { recorded: false };

    const now = Date.now();

    // Check if impression record exists
    const existing = await ctx.db
      .query("adImpressions")
      .withIndex("by_ad_user", (q) =>
        q.eq("adId", args.adId).eq("userId", userId)
      )
      .first();

    if (existing) {
      // Update existing impression
      const cooldownMs = 24 * 60 * 60 * 1000; // 1 day
      if (now - existing.lastImpressionAt < cooldownMs) {
        // Still in cooldown, just increment count
        await ctx.db.patch(existing._id, {
          impressionCount: existing.impressionCount + 1,
          lastImpressionAt: now,
          updatedAt: now,
        });
      } else {
        // Cooldown passed, reset and increment
        await ctx.db.patch(existing._id, {
          impressionCount: 1,
          lastImpressionAt: now,
          updatedAt: now,
        });
      }
    } else {
      // Create new impression record
      await ctx.db.insert("adImpressions", {
        adId: args.adId,
        userId: userId,
        impressionCount: 1,
        lastImpressionAt: now,
        clickCount: 0,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Increment total impressions on the ad
    const ad = await ctx.db.get(args.adId);
    if (ad) {
      await ctx.db.patch(args.adId, {
        totalImpressions: ad.totalImpressions + 1,
        updatedAt: now,
      });
    }

    return { recorded: true };
  },
});

/**
 * Record an ad click
 */
export const recordClick = mutation({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { recorded: false };

    const now = Date.now();

    // Update or create impression record with click
    const existing = await ctx.db
      .query("adImpressions")
      .withIndex("by_ad_user", (q) =>
        q.eq("adId", args.adId).eq("userId", userId)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        clickCount: existing.clickCount + 1,
        lastClickAt: now,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("adImpressions", {
        adId: args.adId,
        userId: userId,
        impressionCount: 1,
        lastImpressionAt: now,
        clickCount: 1,
        lastClickAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Increment total clicks on the ad
    const ad = await ctx.db.get(args.adId);
    if (ad) {
      await ctx.db.patch(args.adId, {
        totalClicks: ad.totalClicks + 1,
        updatedAt: now,
      });
    }

    return { recorded: true };
  },
});

// ============================================================
// Admin Mutations
// ============================================================

/**
 * Create a new ad (admin only)
 */
export const createAd = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    imageUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    adType: v.union(
      v.literal("pro_upgrade"),
      v.literal("sponsor"),
      v.literal("seasonal"),
      v.literal("cross_sell"),
    ),
    priority: v.number(),
    maxImpressionsPerUser: v.number(),
    impressionCooldownDays: v.number(),
    targetRoles: v.array(v.string()),
    targetCountries: v.optional(v.array(v.string())),
    targetSubscriptionTiers: v.array(v.string()),
    ctaText: v.string(),
    ctaUrl: v.string(),
    sponsorName: v.optional(v.string()),
    sponsorWebsite: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    const user = await ctx.db.get(userId);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      throw new Error("Admin access required");
    }

    const now = Date.now();
    const adId = await ctx.db.insert("ads", {
      ...args,
      isActive: true,
      totalImpressions: 0,
      totalClicks: 0,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    // Audit log
    await ctx.db.insert("auditLogs", {
      userId,
      action: "ad_created",
      resource: "ads",
      resourceId: adId,
      changes: { title: args.title, adType: args.adType },
      createdAt: now,
    });

    return { adId };
  },
});

/**
 * Update an ad (admin only)
 */
export const updateAd = mutation({
  args: {
    adId: v.id("ads"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    adType: v.optional(
      v.union(
        v.literal("pro_upgrade"),
        v.literal("sponsor"),
        v.literal("seasonal"),
        v.literal("cross_sell"),
      )
    ),
    priority: v.optional(v.number()),
    maxImpressionsPerUser: v.optional(v.number()),
    impressionCooldownDays: v.optional(v.number()),
    targetRoles: v.optional(v.array(v.string())),
    targetCountries: v.optional(v.array(v.string())),
    targetSubscriptionTiers: v.optional(v.array(v.string())),
    ctaText: v.optional(v.string()),
    ctaUrl: v.optional(v.string()),
    sponsorName: v.optional(v.string()),
    sponsorWebsite: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    const user = await ctx.db.get(userId);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      throw new Error("Admin access required");
    }

    const { adId, ...updates } = args;
    const now = Date.now();

    await ctx.db.patch(adId, {
      ...updates,
      updatedAt: now,
    });

    // Audit log
    await ctx.db.insert("auditLogs", {
      userId,
      action: "ad_updated",
      resource: "ads",
      resourceId: adId,
      changes: Object.keys(updates),
      createdAt: now,
    });

    return { updated: true };
  },
});

/**
 * Delete an ad (admin only)
 */
export const deleteAd = mutation({
  args: { adId: v.id("ads") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Authentication required");

    const user = await ctx.db.get(userId);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      throw new Error("Admin access required");
    }

    await ctx.db.delete(args.adId);

    // Audit log
    await ctx.db.insert("auditLogs", {
      userId,
      action: "ad_deleted",
      resource: "ads",
      resourceId: args.adId,
      createdAt: Date.now(),
    });

    return { deleted: true };
  },
});

/**
 * Get all ads for admin management
 */
export const listAllAds = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return [];
    }

    return await ctx.db.query("ads").collect();
  },
});

/**
 * Get ad stats for admin dashboard
 */
export const getAdStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
      return null;
    }

    const ads = await ctx.db.query("ads").collect();
    const impressions = await ctx.db.query("adImpressions").collect();

    const now = Date.now();
    const activeAds = ads.filter((ad) => ad.isActive && ad.startDate <= now && ad.endDate >= now);
    const totalImpressions = ads.reduce((sum, ad) => sum + ad.totalImpressions, 0);
    const totalClicks = ads.reduce((sum, ad) => sum + ad.totalClicks, 0);

    return {
      totalAds: ads.length,
      activeAds: activeAds.length,
      totalImpressions,
      totalClicks,
      clickThroughRate: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0,
      totalUsersImpressed: impressions.length,
    };
  },
});
