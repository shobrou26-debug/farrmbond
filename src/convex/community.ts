import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import {
  requireAuth,
  requireAdmin,
  createAuditLog,
  validateString,
  sanitizeInput,
} from "./authHelpers";

// ============================================================
// Community Module — posts, comments, likes
// ============================================================

const POST_CATEGORIES = [
  "general",
  "crop_health",
  "market",
  "tips",
  "questions",
];

/**
 * List community posts (approved only), newest first, with author info
 * and whether the current user liked each post. Supports manual cursor
 * pagination compatible with the usePaginatedQuery hook.
 */
export const listPosts = query({
  args: {
    paginationOpts: v.optional(
      v.object({
        numItems: v.number(),
        cursor: v.union(v.string(), v.null()),
      })
    ),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const all = await ctx.db
      .query("communityPosts")
      .withIndex("by_created")
      .order("desc")
      .collect();

    const approved = all.filter((p) => p.isApproved);
    const filtered = args.category
      ? approved.filter((p) => p.category === args.category)
      : approved;

    const numItems = args.paginationOpts?.numItems ?? 20;
    const start = args.paginationOpts?.cursor
      ? parseInt(args.paginationOpts.cursor, 10) || 0
      : 0;
    const page = filtered.slice(start, start + numItems);
    const nextIndex = start + numItems;

    // Enrich with author + likedByMe
    const enriched = await Promise.all(
      page.map(async (post) => {
        const author = post.userId ? await ctx.db.get(post.userId) : null;
        const like = await ctx.db
          .query("communityLikes")
          .withIndex("by_post_user", (q) =>
            q.eq("postId", post._id).eq("userId", userId)
          )
          .first();
        return {
          ...post,
          authorName: author?.name ?? "Farmer",
          authorRole: author?.role ?? "farmer",
          authorImage: author?.image,
          likedByMe: !!like,
        };
      })
    );

    return {
      page: enriched,
      isDone: nextIndex >= filtered.length,
      continueCursor: nextIndex < filtered.length ? String(nextIndex) : null,
    };
  },
});

/** Create a new community post */
export const createPost = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    category: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const title = sanitizeInput(validateString(args.title, "Title", 200));
    const content = sanitizeInput(validateString(args.content, "Content", 5000));
    const category = POST_CATEGORIES.includes(args.category)
      ? args.category
      : "general";
    const tags = (args.tags ?? [])
      .map((t) => sanitizeInput(t))
      .filter((t) => t.length > 0)
      .slice(0, 8);

    const now = Date.now();
    const postId = await ctx.db.insert("communityPosts", {
      userId,
      title,
      content,
      category,
      tags,
      images: undefined,
      likes: 0,
      comments: 0,
      shares: 0,
      isApproved: true,
      isPinned: false,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx, {
      userId,
      action: "post_created",
      resource: "communityPosts",
      resourceId: postId,
      changes: { title, category },
    });

    return postId;
  },
});

/** Toggle a like on a post */
export const likePost = mutation({
  args: { postId: v.id("communityPosts") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");

    const existing = await ctx.db
      .query("communityLikes")
      .withIndex("by_post_user", (q) =>
        q.eq("postId", args.postId).eq("userId", userId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.postId, { likes: Math.max(0, post.likes - 1) });
      return { liked: false, likes: Math.max(0, post.likes - 1) };
    }

    await ctx.db.insert("communityLikes", {
      postId: args.postId,
      userId,
      createdAt: Date.now(),
    });
    await ctx.db.patch(args.postId, { likes: post.likes + 1 });
    return { liked: true, likes: post.likes + 1 };
  },
});

/** Delete a post (owner only, or any admin) */
export const deletePost = mutation({
  args: { postId: v.id("communityPosts") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");

    const isAdmin = user?.role === "admin" || user?.role === "super_admin";
    if (post.userId !== userId && !isAdmin) {
      throw new Error("You can only delete your own posts");
    }

    await ctx.db.delete(args.postId);

    // Clean up likes and comments
    const likes = await ctx.db
      .query("communityLikes")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .collect();
    for (const like of likes) await ctx.db.delete(like._id);

    const comments = await ctx.db
      .query("communityComments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .collect();
    for (const comment of comments) await ctx.db.delete(comment._id);

    await createAuditLog(ctx, {
      userId,
      action: "post_deleted",
      resource: "communityPosts",
      resourceId: args.postId,
      changes: { title: post.title },
    });

    return true;
  },
});

/** Add a comment to a post */
export const addComment = mutation({
  args: {
    postId: v.id("communityPosts"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");

    const content = sanitizeInput(validateString(args.content, "Comment", 2000));
    const now = Date.now();

    await ctx.db.insert("communityComments", {
      postId: args.postId,
      userId,
      content,
      likes: 0,
      parentCommentId: undefined,
      isApproved: true,
      createdAt: now,
    });

    await ctx.db.patch(args.postId, { comments: post.comments + 1 });
    return true;
  },
});

/** List comments for a post (newest first) with author info */
export const listComments = query({
  args: { postId: v.id("communityPosts") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);

    const comments = await ctx.db
      .query("communityComments")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      comments.map(async (comment) => {
        const author = comment.userId ? await ctx.db.get(comment.userId) : null;
        return {
          ...comment,
          authorName: author?.name ?? "Farmer",
          authorImage: author?.image,
          authorRole: author?.role ?? "farmer",
        };
      })
    );

    return enriched;
  },
});

/** Share count increment (Web Share API / copy link) */
export const incrementShareCount = mutation({
  args: { postId: v.id("communityPosts") },
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    await ctx.db.patch(args.postId, { shares: (post.shares ?? 0) + 1 });
    return true;
  },
});

// ============================================================
// Moderation (Phase 4D)
// Users report posts; admins review and hide/restore. Hiding flips
// isApproved off so the post disappears from every public listing.
// ============================================================

/**
 * Pure: next visibility for a moderation action.
 * "hide" → hidden; "restore" → visible. Anything else is invalid.
 */
export function nextModerationVisibility(
  action: string,
  currentApproved: boolean
): { isApproved: boolean; valid: boolean } {
  if (action === "hide") return { isApproved: false, valid: true };
  if (action === "restore") return { isApproved: true, valid: true };
  return { isApproved: currentApproved, valid: false };
}

/**
 * Report a post (authenticated users). One report per user per post —
 * re-reporting updates the reason. Self-reports are rejected.
 */
export const reportPost = mutation({
  args: {
    postId: v.id("communityPosts"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    if (post.userId === userId) {
      throw new Error("You cannot report your own post");
    }
    const reason = sanitizeInput(validateString(args.reason, "Report reason", 500));

    const existing = await ctx.db
      .query("communityReports")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { reason, createdAt: Date.now() });
      return { success: true, alreadyReported: true };
    }

    await ctx.db.insert("communityReports", {
      postId: args.postId,
      userId,
      reason,
      status: "open",
      createdAt: Date.now(),
    });
    return { success: true, alreadyReported: false };
  },
});

/**
 * Admin: hide or restore a post. Hidden posts are excluded from public
 * listings (isApproved false) but are never deleted — restorable.
 */
export const moderatePost = mutation({
  args: {
    postId: v.id("communityPosts"),
    action: v.union(v.literal("hide"), v.literal("restore")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");

    const visibility = nextModerationVisibility(args.action, post.isApproved);
    if (!visibility.valid) throw new Error("Invalid moderation action");
    if (visibility.isApproved === post.isApproved) {
      throw new Error("Post is already in that state");
    }

    await ctx.db.patch(args.postId, { isApproved: visibility.isApproved, updatedAt: Date.now() });

    // Resolve any open reports for this post.
    const openReports = await ctx.db
      .query("communityReports")
      .withIndex("by_post", (q) => q.eq("postId", args.postId))
      .filter((q) => q.eq(q.field("status"), "open"))
      .collect();
    for (const report of openReports) {
      await ctx.db.patch(report._id, {
        status: "resolved",
        resolvedBy: userId,
        resolvedAt: Date.now(),
      });
    }

    await createAuditLog(ctx, {
      userId,
      action: args.action === "hide" ? "post_hidden" : "post_restored",
      resource: "communityPosts",
      resourceId: args.postId,
      changes: { title: post.title, reportsResolved: openReports.length },
    });

    return { success: true, isApproved: visibility.isApproved };
  },
});

/**
 * Admin: list reported posts with report counts and the post content.
 */
export const listReportedPosts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const reports = await ctx.db.query("communityReports").collect();
    const byPost = new Map<string, any[]>();
    for (const report of reports) {
      const list = byPost.get(report.postId) || [];
      list.push(report);
      byPost.set(report.postId, list);
    }
    const out = await Promise.all(
      [...byPost.entries()].map(async ([postId, postReports]) => {
        const post = await ctx.db.get(postId as Id<"communityPosts">);
        return {
          postId,
          title: post?.title ?? "[deleted]",
          isApproved: post?.isApproved ?? false,
          reportCount: postReports.length,
          openReports: postReports.filter((r) => r.status === "open").length,
          reasons: postReports.slice(0, 5).map((r) => r.reason),
          lastReportedAt: Math.max(...postReports.map((r) => r.createdAt)),
        };
      })
    );
    return out.sort((a, b) => b.lastReportedAt - a.lastReportedAt);
  },
});
