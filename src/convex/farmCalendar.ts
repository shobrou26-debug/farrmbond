import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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

    // If recurring, generate future occurrences within a 3-month window
    if (args.isRecurring && args.recurringPattern) {
      const pattern = args.recurringPattern; // "daily" | "weekly" | "monthly"
      const windowMs = 90 * 24 * 60 * 60 * 1000; // 3 months
      const windowEnd = args.startDate + windowMs;

      // Determine step interval in ms
      let stepMs = 0;
      if (pattern === "daily") stepMs = 24 * 60 * 60 * 1000;
      else if (pattern === "weekly") stepMs = 7 * 24 * 60 * 60 * 1000;
      else if (pattern === "monthly") stepMs = 30 * 24 * 60 * 60 * 1000;

      if (stepMs > 0) {
        // Fetch existing events to prevent duplicates
        const existingEvents = await ctx.db
          .query("farmCalendar")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();

        const existingDates = new Set(
          existingEvents
            .filter((e) => e.title === title && e.farmId === args.farmId)
            .map((e) => e.startDate)
        );

        let nextDate = args.startDate + stepMs;
        while (nextDate < windowEnd) {
          // Skip if this date already has an event with the same title + farm
          if (!existingDates.has(nextDate)) {
            await ctx.db.insert("farmCalendar", {
              userId,
              farmId: args.farmId,
              cropId: args.cropId,
              title,
              description: args.description ? sanitizeInput(args.description) : undefined,
              eventType: args.eventType,
              startDate: nextDate,
              endDate: args.endDate ? nextDate + (args.endDate - args.startDate) : undefined,
              isRecurring: false, // individual instances are not themselves recurring
              recurringPattern: undefined,
              isCompleted: false,
              reminderDaysBefore: args.reminderDaysBefore,
              parentEventId: eventId,
              createdAt: now,
              updatedAt: now,
            });
          }
          nextDate += stepMs;
        }
      }
    }

    await createAuditLog(ctx, {
      userId,
      action: "calendar_event_created",
      resource: "farmCalendar",
      resourceId: eventId,
      changes: { title, eventType: args.eventType, farmId: args.farmId, isRecurring: args.isRecurring, pattern: args.recurringPattern },
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

// ============================================================
// Calendar Reminders (cron)
// ============================================================

/**
 * Process upcoming calendar events and send reminder notifications.
 * Runs daily via cron. Deduplicates by checking for an existing
 * notification with the same title + userId created within the
 * last 24 hours.
 */
export const sendCalendarReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const lookAheadMs = 7 * oneDayMs; // look 7 days ahead

    // Get all calendar events with active reminders
    const allEvents = await ctx.db
      .query("farmCalendar")
      .collect();

    // Group events by userId (typed as Id<"users">)
    const eventsByUser = new Map<string, { userId: string; events: typeof allEvents }>();
    for (const event of allEvents) {
      if (event.isCompleted || event.reminderDaysBefore === undefined || event.reminderDaysBefore === null) continue;
      const entry = eventsByUser.get(event.userId);
      if (entry) {
        entry.events.push(event);
      } else {
        eventsByUser.set(event.userId, { userId: event.userId, events: [event] });
      }
    }

    let sent = 0;
    let skipped = 0;

    for (const [, group] of eventsByUser) {
      const userId = group.userId as import("./_generated/dataModel").Id<"users">;

      for (const event of group.events) {
        const daysBefore = event.reminderDaysBefore!;
        const reminderTime = event.startDate - daysBefore * oneDayMs;

        // Only send if the reminder window is active now:
        // reminderTime must be in the past (or very close to now)
        // but the event itself must still be in the future
        if (reminderTime > now || event.startDate < now) continue;

        // Avoid duplicates: check for an existing notification with
        // the same title created within the last 24 hours for this user.
        const recentNotifications = await ctx.db
          .query("notifications")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .collect();

        const isDuplicate = recentNotifications.some(
          (n) =>
            n.title === event.title &&
            n.type === "calendar_reminder" &&
            now - n.createdAt < lookAheadMs
        );

        if (isDuplicate) {
          skipped++;
          continue;
        }

        // Resolve the farm name for a human-friendly message
        const farm = await ctx.db.get(event.farmId);
        const farmName = farm?.name ?? "your farm";

        const daysUntil = Math.max(
          0,
          Math.round((event.startDate - now) / oneDayMs)
        );
        const timeLabel =
          daysUntil === 0
            ? "today"
            : daysUntil === 1
            ? "tomorrow"
            : `in ${daysUntil} days`;

        await ctx.db.insert("notifications", {
          userId,
          title: `Reminder: ${event.title}`,
          message: `${event.title} is scheduled ${timeLabel} on ${farmName}.`,
          type: "calendar_reminder",
          isRead: false,
          actionUrl: "/calendar",
          actionLabel: "View Calendar",
          createdAt: now,
        });

        sent++;
      }
    }

    return { sent, skipped };
  },
});
