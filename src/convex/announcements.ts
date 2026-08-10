import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  requireAdmin,
  createAuditLog,
  sanitizeInput,
  validateString,
} from "./authHelpers";

// ============================================================
// Announcements (Phase 8 — Admin-to-farmer broadcast)
// ============================================================

/** Admin: create a new announcement. */
export const createAnnouncement = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    type: v.string(), // "maintenance", "feature", "policy", etc.
    targetRoles: v.array(v.string()),
    targetCountries: v.optional(v.array(v.string())),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();

    const id = await ctx.db.insert("announcements", {
      title: sanitizeInput(validateString(args.title, "Title", 200)),
      content: sanitizeInput(validateString(args.content, "Content", 5000)),
      type: args.type,
      targetRoles: args.targetRoles.slice(0, 10),
      targetCountries: args.targetCountries?.slice(0, 50),
      startDate: args.startDate,
      endDate: args.endDate,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "announcement_created",
      resource: "announcements",
      resourceId: id,
      changes: { title: args.title, type: args.type },
    });
    return id;
  },
});

/** Admin: update an existing announcement. */
export const updateAnnouncement = mutation({
  args: {
    announcementId: v.id("announcements"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    type: v.optional(v.string()),
    targetRoles: v.optional(v.array(v.string())),
    targetCountries: v.optional(v.array(v.string())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const { announcementId, ...updates } = args;
    const now = Date.now();

    const sanitized: Record<string, unknown> = {};
    if (updates.title !== undefined) sanitized.title = sanitizeInput(updates.title).slice(0, 200);
    if (updates.content !== undefined) sanitized.content = sanitizeInput(updates.content).slice(0, 5000);
    if (updates.type !== undefined) sanitized.type = updates.type;
    if (updates.targetRoles !== undefined) sanitized.targetRoles = updates.targetRoles.slice(0, 10);
    if (updates.targetCountries !== undefined) sanitized.targetCountries = updates.targetCountries.slice(0, 50);
    if (updates.startDate !== undefined) sanitized.startDate = updates.startDate;
    if (updates.endDate !== undefined) sanitized.endDate = updates.endDate;
    sanitized.updatedAt = now;

    await ctx.db.patch(announcementId, sanitized);
    await createAuditLog(ctx, {
      userId,
      action: "announcement_updated",
      resource: "announcements",
      resourceId: announcementId,
      changes: { updatedFields: Object.keys(updates) },
    });
    return { success: true };
  },
});

/** Admin: delete an announcement. */
export const deleteAnnouncement = mutation({
  args: { announcementId: v.id("announcements") },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const doc = await ctx.db.get(args.announcementId);
    await ctx.db.delete(args.announcementId);
    await createAuditLog(ctx, {
      userId,
      action: "announcement_deleted",
      resource: "announcements",
      resourceId: args.announcementId,
      changes: { deletedTitle: doc?.title },
    });
    return { success: true };
  },
});

/**
 * List published announcements that the current user is allowed to see.
 * Only announcements whose date window contains now, whose targetRoles
 * match the user's role (or empty = all roles), and whose targetCountries
 * match the user's country (or empty = all countries) are returned.
 */
export const listPublishedAnnouncements = query({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireAuth(ctx);
    const now = Date.now();

    const allAnnouncements = await ctx.db
      .query("announcements")
      .withIndex("by_dates", (q) => q.lte("startDate", now))
      .order("desc")
      .collect();

    return allAnnouncements.filter((a) => {
      if (a.endDate < now) return false;
      if (a.targetRoles.length > 0 && !a.targetRoles.includes(user.role ?? "farmer")) return false;
      if (a.targetCountries && a.targetCountries.length > 0 && user.country && !a.targetCountries.includes(user.country)) return false;
      return true;
    }).slice(0, 50);
  },
});

/** Admin: list all announcements (published or not). */
export const listAllAnnouncements = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("announcements").order("desc").collect();
  },
});