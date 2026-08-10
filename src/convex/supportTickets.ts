import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  requireAdmin,
  createAuditLog,
  sanitizeInput,
  validateString,
} from "./authHelpers";
import { Doc } from "./_generated/dataModel";

// ============================================================
// Support Tickets (Phase 8)
// ============================================================

/** Farmer: create a support ticket. The creator identity is always the
 *  authenticated user — a client can never create a ticket on behalf of
 *  another user. */
export const createTicket = mutation({
  args: {
    subject: v.string(),
    description: v.string(),
    category: v.string(),
    priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const now = Date.now();

    const id = await ctx.db.insert("supportTickets", {
      userId,
      subject: sanitizeInput(validateString(args.subject, "Subject", 200)),
      description: sanitizeInput(validateString(args.description, "Description", 5000)),
      category: args.category,
      priority: args.priority,
      status: "open",
      messages: [{
        senderId: userId,
        content: sanitizeInput(args.description).slice(0, 5000),
        timestamp: now,
      }],
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "ticket_created",
      resource: "supportTickets",
      resourceId: id,
      changes: { subject: args.subject, category: args.category },
    });
    return id;
  },
});

/** Farmer: reply to their own ticket. Only the ticket owner can reply. */
export const replyToTicket = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.userId !== userId) throw new Error("Access denied: you do not own this ticket");

    const now = Date.now();
    const message = {
      senderId: userId,
      content: sanitizeInput(validateString(args.content, "Message", 5000)),
      timestamp: now,
    };

    await ctx.db.patch(args.ticketId, {
      messages: [...ticket.messages, message],
      updatedAt: now,
      // Re-open if it was closed
      status: ticket.status === "closed" ? "open" as const : ticket.status,
    });
    return { success: true };
  },
});

/** Farmer: list their own tickets. */
export const listMyTickets = query({
  args: {
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    let tickets = await ctx.db
      .query("supportTickets")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    if (args.status) {
      tickets = tickets.filter((t) => t.status === args.status);
    }

    return tickets.map((t) => ({
      _id: t._id,
      _creationTime: t._creationTime,
      subject: t.subject,
      category: t.category,
      priority: t.priority,
      status: t.status,
      messageCount: t.messages.length,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));
  },
});

/** Farmer: get full detail of their own ticket (including messages). */
export const getMyTicket = query({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) return null;
    if (ticket.userId !== userId) return null;
    return ticket;
  },
});

// ============================================================
// Admin ticket management
// ============================================================

/** Admin: list all tickets (with optional status filter). */
export const listAllTickets = query({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const max = args.limit ?? 100;
    let tickets: Doc<"supportTickets">[];
    if (args.status) {
      tickets = await ctx.db
        .query("supportTickets")
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
        .order("desc")
        .collect();
    } else {
      tickets = await ctx.db
        .query("supportTickets")
        .order("desc")
        .collect();
    }
    return tickets.slice(0, max);
  },
});

/** Admin: reply to a ticket. */
export const adminReplyToTicket = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");

    const now = Date.now();
    const message = {
      senderId: userId,
      content: sanitizeInput(validateString(args.content, "Message", 5000)),
      timestamp: now,
    };

    await ctx.db.patch(args.ticketId, {
      messages: [...ticket.messages, message],
      assignedTo: userId,
      status: "in_progress" as const,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "ticket_admin_reply",
      resource: "supportTickets",
      resourceId: args.ticketId,
      changes: { ticketSubject: ticket.subject },
    });
    return { success: true };
  },
});

/** Admin: change ticket status. */
export const updateTicketStatus = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("resolved"), v.literal("closed")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();

    await ctx.db.patch(args.ticketId, {
      status: args.status,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "ticket_status_changed",
      resource: "supportTickets",
      resourceId: args.ticketId,
      changes: { newStatus: args.status, note: args.note },
    });
    return { success: true };
  },
});