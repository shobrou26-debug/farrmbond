import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  requireAdmin,
  createAuditLog,
  validateString,
  sanitizeInput,
} from "./authHelpers";

// ============================================================
// Farming Events Module — public events, trainings, expos
// ============================================================

const EVENT_TYPES = ["training", "expo", "workshop", "sponsored"] as const;

/** List upcoming (and recently ended) active farming events, newest first */
export const listEvents = query({
  args: {
    type: v.optional(v.string()),
    includePast: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const limit = args.limit ?? 100;

    let events = await ctx.db
      .query("farmingEvents")
      .withIndex("by_start_date")
      .order("desc")
      .collect();

    events = events.filter((e) => e.isActive);
    // Demo/seed events (admin seed tool) never appear in the public calendar.
    events = events.filter((e) => e.isSeeded !== true);
    if (!args.includePast) {
      // Keep events that haven't ended yet, plus a small grace window
      const grace = 7 * 24 * 60 * 60 * 1000;
      events = events.filter((e) => e.endDate >= now - grace);
    }
    if (args.type && args.type !== "all") {
      events = events.filter((e) => e.type === args.type);
    }

    events = events
      .sort((a, b) => a.startDate - b.startDate)
      .slice(0, limit);

    return events;
  },
});

/** Get the list of event IDs the current user has registered for */
export const getMyRegistrations = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const registrations = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return registrations.map((r) => r.eventId);
  },
});

/** Register for an event (respects capacity and duplicate registrations) */
export const registerForEvent = mutation({
  args: { eventId: v.id("farmingEvents") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const event = await ctx.db.get(args.eventId);
    if (!event || !event.isActive || event.isSeeded === true) throw new Error("Event not found");

    const existing = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", userId)
      )
      .first();
    if (existing) throw new Error("You are already registered for this event");

    if (event.attendees >= event.maxCapacity) {
      throw new Error("This event is full");
    }

    await ctx.db.insert("eventRegistrations", {
      eventId: args.eventId,
      userId,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.eventId, { attendees: event.attendees + 1 });

    // Create an in-app notification
    await ctx.db.insert("notifications", {
      userId,
      title: "Event registered",
      message: `You are registered for "${event.title}" on ${new Date(
        event.startDate
      ).toLocaleDateString()}.`,
      type: "system",
      isRead: false,
      createdAt: Date.now(),
    });

    await createAuditLog(ctx, {
      userId,
      action: "event_registered",
      resource: "farmingEvents",
      resourceId: args.eventId,
      changes: { title: event.title },
    });

    return true;
  },
});

/** Cancel a registration (frees a slot) */
export const cancelRegistration = mutation({
  args: { eventId: v.id("farmingEvents") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const registration = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event_user", (q) =>
        q.eq("eventId", args.eventId).eq("userId", userId)
      )
      .first();
    if (!registration) throw new Error("Registration not found");

    const event = await ctx.db.get(args.eventId);
    await ctx.db.delete(registration._id);
    if (event) {
      await ctx.db.patch(args.eventId, {
        attendees: Math.max(0, event.attendees - 1),
      });
    }

    await createAuditLog(ctx, {
      userId,
      action: "event_registration_cancelled",
      resource: "farmingEvents",
      resourceId: args.eventId,
      changes: { title: event?.title },
    });

    return true;
  },
});

// ============================================================
// Admin Mutations
// ============================================================

/** Create a new farming event (admin only) */
export const createEvent = mutation({
  args: {
    title: v.string(),
    type: v.union(
      v.literal("training"),
      v.literal("expo"),
      v.literal("workshop"),
      v.literal("sponsored")
    ),
    description: v.string(),
    location: v.string(),
    startDate: v.number(),
    endDate: v.number(),
    time: v.string(),
    organizer: v.string(),
    maxCapacity: v.number(),
    ticketPrice: v.string(),
    sponsored: v.boolean(),
    sponsorName: v.optional(v.string()),
    tags: v.array(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);

    const now = Date.now();
    const eventId = await ctx.db.insert("farmingEvents", {
      title: sanitizeInput(validateString(args.title, "Event title", 200)),
      type: args.type,
      description: sanitizeInput(validateString(args.description, "Description", 5000)),
      location: sanitizeInput(validateString(args.location, "Location", 200)),
      startDate: args.startDate,
      endDate: args.endDate,
      time: args.time,
      organizer: sanitizeInput(validateString(args.organizer, "Organizer", 200)),
      attendees: 0,
      maxCapacity: args.maxCapacity,
      ticketPrice: args.ticketPrice,
      sponsored: args.sponsored,
      sponsorName: args.sponsorName ? sanitizeInput(args.sponsorName) : undefined,
      tags: args.tags.map((t) => sanitizeInput(t)).slice(0, 10),
      imageUrl: args.imageUrl,
      isActive: true,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "event_created",
      resource: "farmingEvents",
      resourceId: eventId,
      changes: { title: args.title, type: args.type },
    });

    return eventId;
  },
});

/** Admin: list ALL events including inactive/deleted-pending ones */
export const listAllEvents = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("farmingEvents").order("desc").collect();
  },
});

/** Edit a farming event (admin only) */
export const updateEvent = mutation({
  args: {
    eventId: v.id("farmingEvents"),
    title: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("training"),
      v.literal("expo"),
      v.literal("workshop"),
      v.literal("sponsored")
    )),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    time: v.optional(v.string()),
    organizer: v.optional(v.string()),
    maxCapacity: v.optional(v.number()),
    ticketPrice: v.optional(v.string()),
    sponsored: v.optional(v.boolean()),
    sponsorName: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    imageUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");
    const { eventId, ...updates } = args;

    await ctx.db.patch(args.eventId, {
      ...(updates.title !== undefined && { title: sanitizeInput(validateString(updates.title, "Event title", 200)) }),
      ...(updates.type !== undefined && { type: updates.type }),
      ...(updates.description !== undefined && { description: sanitizeInput(validateString(updates.description, "Description", 5000)) }),
      ...(updates.location !== undefined && { location: sanitizeInput(validateString(updates.location, "Location", 200)) }),
      ...(updates.startDate !== undefined && { startDate: updates.startDate }),
      ...(updates.endDate !== undefined && { endDate: updates.endDate }),
      ...(updates.time !== undefined && { time: updates.time }),
      ...(updates.organizer !== undefined && { organizer: sanitizeInput(validateString(updates.organizer, "Organizer", 200)) }),
      ...(updates.maxCapacity !== undefined && { maxCapacity: updates.maxCapacity }),
      ...(updates.ticketPrice !== undefined && { ticketPrice: updates.ticketPrice }),
      ...(updates.sponsored !== undefined && { sponsored: updates.sponsored }),
      ...(updates.sponsorName ? { sponsorName: sanitizeInput(updates.sponsorName) } : {}),
      ...(updates.tags !== undefined && { tags: updates.tags.map((t) => sanitizeInput(t)).slice(0, 10) }),
      ...(updates.imageUrl !== undefined && { imageUrl: updates.imageUrl }),
      ...(updates.isActive !== undefined && { isActive: updates.isActive }),
      updatedAt: Date.now(),
    });
    await createAuditLog(ctx, {
      userId,
      action: "event_updated",
      resource: "farmingEvents",
      resourceId: args.eventId,
      changes: { title: updates.title ?? event.title },
    });
    return { success: true };
  },
});

/** Delete an event (admin only) */
export const deleteEvent = mutation({
  args: { eventId: v.id("farmingEvents") },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    await ctx.db.delete(args.eventId);

    const registrations = await ctx.db
      .query("eventRegistrations")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const reg of registrations) await ctx.db.delete(reg._id);

    await createAuditLog(ctx, {
      userId,
      action: "event_deleted",
      resource: "farmingEvents",
      resourceId: args.eventId,
      changes: { title: event.title },
    });

    return true;
  },
});

export { EVENT_TYPES };
