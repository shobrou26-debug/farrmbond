import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  sanitizeInput,
  validateString,
  checkRateLimit,
} from "./authHelpers";

// ============================================================
// Farmer-Agronomist Messaging (Phase 8)
//
// Messages belong to a deterministic conversation ID (sorted pair of
// participant user IDs). The sender is always the authenticated session
// — a client can never forge a sender. Farmers may only message approved
// agronomists; agronomists may reply to any farmer who messaged them.
// ============================================================

/** Pure: deterministic conversation ID from two user IDs (sorted). */
export function buildConversationId(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Send a message to another user. */
export const sendMessage = mutation({
  args: {
    receiverId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    if (userId === args.receiverId) throw new Error("Cannot send a message to yourself");

    const content = sanitizeInput(validateString(args.content, "Message", 2000));
    if (!content.trim()) throw new Error("Message cannot be empty");

    // Rate-limit: 30 messages per minute per sender
    const rateCheck = await checkRateLimit(ctx, userId, "send_message", 30, 60_000);
    if (!rateCheck.allowed) {
      throw new Error("Rate limit exceeded. Please wait before sending another message.");
    }

    const now = Date.now();
    const conversationId = buildConversationId(userId, args.receiverId);

    await ctx.db.insert("messages", {
      conversationId,
      senderId: userId,
      receiverId: args.receiverId,
      content,
      type: "text",
      isRead: false,
      createdAt: now,
    });

    return { conversationId, sentAt: now };
  },
});

/** List the authenticated user's conversations (counterparties + last message). */
export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const asSender = await ctx.db
      .query("messages")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .order("desc")
      .take(100);

    const asReceiver = await ctx.db
      .query("messages")
      .withIndex("by_receiver", (q) => q.eq("receiverId", userId))
      .order("desc")
      .take(100);

    const conversationMap = new Map<string, { otherUserId: string; lastMessageAt: number; lastContent: string; unread: number }>();

    for (const msg of asSender) {
      const convId = msg.conversationId;
      if (!conversationMap.has(convId) || msg.createdAt > conversationMap.get(convId)!.lastMessageAt) {
        conversationMap.set(convId, {
          otherUserId: msg.receiverId,
          lastMessageAt: msg.createdAt,
          lastContent: msg.content.slice(0, 100),
          unread: 0,
        });
      }
    }

    for (const msg of asReceiver) {
      const convId = msg.conversationId;
      if (!conversationMap.has(convId) || msg.createdAt > conversationMap.get(convId)!.lastMessageAt) {
        conversationMap.set(convId, {
          otherUserId: msg.senderId,
          lastMessageAt: msg.createdAt,
          lastContent: msg.content.slice(0, 100),
          unread: 0,
        });
      }
      if (!msg.isRead) {
        const existing = conversationMap.get(convId);
        if (existing) existing.unread++;
      }
    }

    const convs = Array.from(conversationMap.entries())
      .sort(([, a], [, b]) => b.lastMessageAt - a.lastMessageAt);

    // Join other user names
    return Promise.all(
      convs.map(async ([convId, info]) => {
        const otherUser = await ctx.db.get(info.otherUserId as any);
        const u = otherUser as { name?: string; image?: string | null } | null;
        return {
          conversationId: convId,
          otherUserId: info.otherUserId,
          otherName: u?.name ?? "Unknown",
          otherImage: u?.image ?? null,
          lastMessageAt: info.lastMessageAt,
          lastContent: info.lastContent,
          unread: info.unread,
        };
      })
    );
  },
});

/** List messages in a conversation (participant only). */
export const listMessages = query({
  args: {
    conversationId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const max = args.limit ?? 100;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .collect();

    // Verify the user is a participant in this conversation
    const isParticipant = messages.some(
      (m) => m.senderId === userId || m.receiverId === userId
    );
    if (!isParticipant) return [];

    return messages.slice(0, max).reverse();
  },
});

/** Mark all unread messages in a conversation as read (participant only). */
export const markConversationRead = mutation({
  args: {
    conversationId: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const now = Date.now();

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const participant = messages.some(
      (m) => m.senderId === userId || m.receiverId === userId
    );
    if (!participant) throw new Error("Access denied");

    for (const msg of messages) {
      if (msg.receiverId === userId && !msg.isRead) {
        await ctx.db.patch(msg._id, { isRead: true, readAt: now });
      }
    }
    return { success: true };
  },
});

/** Get total unread count for the authenticated user. */
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);

    const recent = await ctx.db
      .query("messages")
      .withIndex("by_receiver", (q) => q.eq("receiverId", userId))
      .order("desc")
      .take(100);

    return recent.filter((m) => !m.isRead).length;
  },
});