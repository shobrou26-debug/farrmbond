import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, internalQuery, QueryCtx } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

/**
 * Get a user by their ID.
 * INTERNAL ONLY — exposed as an internal query so only server-side callers
 * (webhooks, actions, crons) can read arbitrary user records. The client
 * must use `currentUser`, which is always scoped to the signed-in session.
 */
export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Get a user by their Stripe customer ID.
 * INTERNAL ONLY — used by the Stripe webhook; not callable from the client.
 */
export const getUserByStripeCustomer = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    // Phase 7: indexed lookup (by_stripe_customer) — the previous filter
    // walked the whole users table on every Stripe webhook event.
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();
    return user || null;
  },
});

// ============================================================
// User Preferences
// ============================================================

/** Update user preferences (units, currency, timezone) */
export const updatePreferences = mutation({
  args: {
    units: v.optional(v.union(v.literal("metric"), v.literal("imperial"))),
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    theme: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const updates: Record<string, unknown> = {};
    if (args.units !== undefined) updates.units = args.units;
    if (args.currency !== undefined) updates.currency = args.currency;
    if (args.timezone !== undefined) updates.timezone = args.timezone;
    if (args.theme !== undefined) updates.theme = args.theme;

    await ctx.db.patch(userId, updates);
    return { success: true };
  },
});

/** Get current user preferences */
export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      units: user.units ?? "metric",
      currency: user.currency ?? "KES",
      timezone: user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      theme: user.theme ?? "green-fields",
    };
  },
});

/**
 * Real usage counts for the signed-in user, shown on the Settings page.
 * Replaces hardcoded usage numbers — each metric is derived from the
 * actual database records owned by the authenticated user.
 */
export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const [farms, crops, livestock, transactions, aiChats] = await Promise.all([
      ctx.db.query("farms").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("crops").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("livestock").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("transactions").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("aiChats").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    return {
      farms: farms.length,
      crops: crops.length,
      livestock: livestock.length,
      transactions: transactions.length,
      aiSessions: aiChats.length,
    };
  },
});
