import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { roleValidator, subscriptionTierValidator } from "./schema";
import {
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
  hasRole,
  createAuditLog,
  checkRateLimit,
} from "./authHelpers";
import { ROLES } from "./schema";

// ============================================================
// Admin Queries
// ============================================================

/**
 * List all users (admin only)
 */
export const listAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role || "farmer",
      subscriptionTier: u.subscriptionTier || "free",
      lastActiveAt: u.lastActiveAt,
      createdAt: u.createdAt,
      country: u.country,
      phone: u.phone,
    }));
  },
});

/**
 * Get user stats for admin dashboard
 */
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAdmin(ctx);

    const users = await ctx.db.query("users").collect();
    const total = users.length;
    const byRole = {
      farmer: users.filter((u) => u.role === "farmer").length,
      agronomist: users.filter((u) => u.role === "agronomist").length,
      admin: users.filter((u) => u.role === "admin" || u.role === "super_admin").length,
    };
    const bySubscription = {
      free: users.filter((u) => !u.subscriptionTier || u.subscriptionTier === "free").length,
      pro: users.filter((u) => u.subscriptionTier === "pro").length,
    };

    // Count users active in last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeUsers = users.filter((u) => u.lastActiveAt && u.lastActiveAt > sevenDaysAgo).length;

    return { total, byRole, bySubscription, activeUsers };
  },
});

/**
 * List all audit logs (admin only)
 */
export const listAuditLogs = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAdmin(ctx);

    return await ctx.db
      .query("auditLogs")
      .order("desc")
      .take(100);
  },
});

/**
 * List the current user's own audit log entries (any authenticated user)
 */
export const listMyAuditLogs = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(args.limit ?? 100);

    return enrichAuditLogs(ctx, rows);
  },
});

/**
 * Enrich raw audit log rows with the acting user's name and role.
 * Deduplicates user lookups so N rows cost at most N distinct user fetches.
 */
async function enrichAuditLogs(ctx: QueryCtx, rows: Doc<"auditLogs">[]) {
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const userDocs = await Promise.all(userIds.map((id) => ctx.db.get(id)));
  const userById = new Map(userDocs.filter((u): u is NonNullable<typeof u> => u !== null).map((u) => [u._id, u]));

  return rows.map((row) => {
    const actor = userById.get(row.userId);
    return {
      ...row,
      userName: actor?.name ?? actor?.email ?? "Unknown User",
      userRole: actor?.role ?? "farmer",
    };
  });
}

/**
 * List audit logs for the current viewer.
 * Admins see all logs; regular users only see their own.
 * Rows are enriched with the actor's name and role for display.
 */
export const listAuditLogsForViewer = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);

    const isAdmin = user.role === "admin" || user.role === "super_admin";
    const limit = args.limit ?? 200;

    const rows = isAdmin
      ? await ctx.db.query("auditLogs").order("desc").take(limit)
      : await ctx.db
          .query("auditLogs")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(limit);

    return enrichAuditLogs(ctx, rows);
  },
});

/**
 * Delete the current user's own audit log entries.
 * Admins can optionally clear all logs via the `all` flag.
 */
export const clearMyAuditLogs = mutation({
  args: { all: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);

    const isAdmin = user.role === "admin" || user.role === "super_admin";
    const canClearAll = args.all === true && isAdmin;

    const rows = canClearAll
      ? await ctx.db.query("auditLogs").collect()
      : await ctx.db
          .query("auditLogs")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();

    await Promise.all(rows.map((r) => ctx.db.delete(r._id)));

    return { deleted: rows.length, clearedAll: canClearAll };
  },
});

// ============================================================
// Admin Mutations
// ============================================================

/**
 * Update a user's role (admin only, super_admin for promoting to super_admin)
 */
export const updateUserRole = mutation({
  args: {
    targetUserId: v.id("users"),
    newRole: roleValidator,
  },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAdmin(ctx);

    // Rate limiting: max 10 role changes per hour
    const rateCheck = await checkRateLimit(ctx, userId, "role_changed", 10, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
      throw new Error("Rate limit exceeded: Too many role changes. Try again later.");
    }

    // Prevent non-super-admins from promoting to super_admin
    if (args.newRole === "super_admin" && user.role !== "super_admin") {
      throw new Error("Authorization denied: Only super admins can assign super admin role");
    }

    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) throw new Error("User not found");

    const oldRole = targetUser.role || "farmer";

    // Update the user's role
    await ctx.db.patch(args.targetUserId, {
      role: args.newRole,
      updatedAt: Date.now(),
    });

    // Create audit log
    await createAuditLog(ctx, {
      userId,
      action: "role_changed",
      resource: "users",
      resourceId: args.targetUserId,
      changes: {
        field: "role",
        oldValue: oldRole,
        newValue: args.newRole,
        userName: targetUser.name,
        userEmail: targetUser.email,
      },
    });

    return { success: true, oldRole, newRole: args.newRole };
  },
});

/**
 * Update a user's subscription tier (admin only)
 */
export const updateUserSubscription = mutation({
  args: {
    targetUserId: v.id("users"),
    newTier: subscriptionTierValidator,
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);

    // Rate limiting: max 20 subscription changes per hour
    const rateCheck = await checkRateLimit(ctx, userId, "subscription_changed", 20, 60 * 60 * 1000);
    if (!rateCheck.allowed) {
      throw new Error("Rate limit exceeded: Too many subscription changes. Try again later.");
    }

    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) throw new Error("User not found");

    const oldTier = targetUser.subscriptionTier || "free";

    // Update subscription
    const now = Date.now();
    await ctx.db.patch(args.targetUserId, {
      subscriptionTier: args.newTier,
      subscriptionStartDate: now,
      subscriptionEndDate: args.newTier === "free" ? undefined : now + 30 * 24 * 60 * 60 * 1000,
      updatedAt: now,
    });

    // Create audit log
    await createAuditLog(ctx, {
      userId,
      action: "subscription_changed",
      resource: "users",
      resourceId: args.targetUserId,
      changes: {
        field: "subscriptionTier",
        oldValue: oldTier,
        newValue: args.newTier,
        userName: targetUser.name,
        userEmail: targetUser.email,
      },
    });

    return { success: true, oldTier, newTier: args.newTier };
  },
});

/**
 * Suspend or reactivate a user (admin only)
 */
export const toggleUserStatus = mutation({
  args: {
    targetUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);

    // Prevent suspending yourself
    if (args.targetUserId === userId) {
      throw new Error("Cannot suspend your own account");
    }

    const targetUser = await ctx.db.get(args.targetUserId);
    if (!targetUser) throw new Error("User not found");

    // Cannot suspend super admins
    if (targetUser.role === "super_admin") {
      throw new Error("Cannot suspend a super admin");
    }

    // Toggle: if user has no isSuspended field or it's false, set to true (suspended)
    const isCurrentlySuspended = (targetUser as Record<string, unknown>).isSuspended === true;
    const newSuspendedState = !isCurrentlySuspended;

    await ctx.db.patch(args.targetUserId, {
      isSuspended: newSuspendedState,
      updatedAt: Date.now(),
    } as Record<string, unknown>);

    // Create audit log
    await createAuditLog(ctx, {
      userId,
      action: newSuspendedState ? "user_suspended" : "user_reactivated",
      resource: "users",
      resourceId: args.targetUserId,
      changes: {
        userName: targetUser.name,
        userEmail: targetUser.email,
        status: newSuspendedState ? "suspended" : "active",
      },
    });

    return { success: true, suspended: newSuspendedState };
  },
});
