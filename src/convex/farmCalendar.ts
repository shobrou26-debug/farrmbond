import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  verifyFarmOwnership,
  createAuditLog,
  validateString,
  sanitizeInput,
} from "./authHelpers";

// ============================================================
// Calendar Queries
// ============================================================

/** Get all calendar events for the current user. Optional pagination. */
export const listUserEvents = query({
  args: {
    paginationOpts: v.optional(v.object({
      numItems: v.number(),
      cursor: v.union(v.string(), v.null()),
    })),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const base = ctx.db
      .query("farmCalendar")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc");

    if (args.paginationOpts) {
      return await base.paginate(args.paginationOpts);
    }

    const items = await base.collect();
    return { page: items, isDone: true, continueCursor: null };
  },
});

/** Get calendar events for a specific farm. Optional pagination. */
export const listFarmEvents = query({
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
      .query("farmCalendar")
      .withIndex("by_farm", (q) => q.eq("farmId", args.farmId))
      .order("desc");

    if (args.paginationOpts) {
      return await base.paginate(args.paginationOpts);
    }

    const items = await base.collect();
    return { page: items, isDone: true, continueCursor: null };
  },
});

/** Get upcoming events (not yet completed) */
export const listUpcomingEvents = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const now = Date.now();

    const events = await ctx.db
      .query("farmCalendar")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return events
      .filter((e) => !e.isCompleted && e.startDate >= now - 7 * 24 * 60 * 60 * 1000)
      .sort((a, b) => a.startDate - b.startDate);
  },
});

// ============================================================
// Calendar Mutations
// ============================================================

/** Create a new calendar event */
export const createEvent = mutation({
  args: {
    farmId: v.id("farms"),
    cropId: v.optional(v.id("crops")),
    title: v.string(),
    description: v.optional(v.string()),
    eventType: v.union(
      v.literal("planting"),
      v.literal("harvesting"),
      v.literal("fertilizing"),
      v.literal("pest_control"),
      v.literal("irrigation"),
      v.literal("vaccination"),
      v.literal("other")
    ),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    isRecurring: v.boolean(),
    recurringPattern: v.optional(v.string()),
    reminderDaysBefore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    await verifyFarmOwnership(ctx, args.farmId, userId);

    const title = sanitizeInput(validateString(args.title, "Title", 200));
    const now = Date.now();

    const eventId = await ctx.db.insert("farmCalendar", {
      userId,
      farmId: args.farmId,
      cropId: args.cropId,
      title,
      description: args.description ? sanitizeInput(args.description) : undefined,
      eventType: args.eventType,
      startDate: args.startDate,
      endDate: args.endDate,
      isRecurring: args.isRecurring,
      recurringPattern: args.recurringPattern,
      isCompleted: false,
      reminderDaysBefore: args.reminderDaysBefore,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "calendar_event_created",
      resource: "farmCalendar",
      resourceId: eventId,
      changes: { title, eventType: args.eventType, farmId: args.farmId },
    });

    return eventId;
  },
});

/** Mark an event as completed */
export const completeEvent = mutation({
  args: { eventId: v.id("farmCalendar") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event || event.userId !== userId) {
      throw new Error("Event not found or unauthorized");
    }

    await ctx.db.patch(args.eventId, {
      isCompleted: true,
      updatedAt: Date.now(),
    });

    return args.eventId;
  },
});

/** Delete a calendar event */
export const deleteEvent = mutation({
  args: { eventId: v.id("farmCalendar") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event || event.userId !== userId) {
      throw new Error("Event not found or unauthorized");
    }

    await ctx.db.delete(args.eventId);

    await createAuditLog(ctx, {
      userId,
      action: "calendar_event_deleted",
      resource: "farmCalendar",
      resourceId: args.eventId,
      changes: { title: event.title, eventType: event.eventType },
    });

    return true;
  },
});
