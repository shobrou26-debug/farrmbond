import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id, Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
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

export const POST_CATEGORIES = [
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

    // Phase 7 scale hardening: page the by_created index directly (opaque
    // Convex cursors) instead of collecting the ENTIRE communityPosts table
    // on every page render. Approved posts are filtered within each fetched
    // page; the loop is bounded (max 5 index pages) so one API call never
    // walks the whole table, even at 200k+ users. The contract
    // ({ page, isDone, continueCursor }) is preserved for usePaginatedQuery.
    const numItems = Math.max(
      1,
      Math.min(50, args.paginationOpts?.numItems ?? 20)
    );
    let cursor: string | null = args.paginationOpts?.cursor ?? null;
    let isDone = false;
    let pagesFetched = 0;
    const collected: Doc<"communityPosts">[] = [];

    while (collected.length < numItems && pagesFetched < 5) {
      const page = await ctx.db
        .query("communityPosts")
        .withIndex("by_created")
        .order("desc")
        .paginate({ numItems: Math.max(numItems * 2, 50), cursor });

      for (const post of page.page) {
        if (!post.isApproved) continue;
        if (args.category && post.category !== args.category) continue;
        collected.push(post);
        if (collected.length >= numItems) break;
      }

      cursor = page.continueCursor;
      pagesFetched++;
      if (page.isDone) {
        isDone = true;
        cursor = null;
        break;
      }
    }

    const page = collected.slice(0, numItems);

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
        const imageUrl =
          post.images && post.images.length > 0
            ? ((await ctx.storage.getUrl(post.images[0])) ?? undefined)
            : undefined;
        return {
          ...post,
          authorId: post.userId,
          authorName: author?.name ?? "Farmer",
          authorRole: author?.role ?? "farmer",
          authorImage: author?.image,
          imageUrl,
          likedByMe: !!like,
        };
      })
    );

    return {
      page: enriched,
      isDone,
      continueCursor: isDone ? null : cursor,
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
    // Convex File storage IDs (from detectionResults.generateUploadUrl flow)
    images: v.optional(v.array(v.id("_storage"))),
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
      images: args.images?.length ? args.images : undefined,
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

/**
 * List posts by the current user (any moderation state) — used by
 * "My posts" so authors can find their own hidden/deleted-adjacent items.
 */
export const getPostById = query({
  args: { postId: v.id("communityPosts") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);
    return await ctx.db.get(args.postId);
  },
});

/** Edit a post (owner only). Only content fields are mutable. */
export const editPost = mutation({
  args: {
    postId: v.id("communityPosts"),
    title: v.string(),
    content: v.string(),
    category: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    if (post.userId !== userId) {
      throw new Error("You can only edit your own posts");
    }

    const title = sanitizeInput(validateString(args.title, "Title", 200));
    const content = sanitizeInput(validateString(args.content, "Content", 5000));
    const category = POST_CATEGORIES.includes(args.category)
      ? args.category
      : post.category;
    const tags = (args.tags ?? [])
      .map((t) => sanitizeInput(t))
      .filter((t) => t.length > 0)
      .slice(0, 8);

    await ctx.db.patch(args.postId, {
      title,
      content,
      category,
      tags,
      updatedAt: Date.now(),
    });

    await createAuditLog(ctx, {
      userId,
      action: "post_edited",
      resource: "communityPosts",
      resourceId: args.postId,
      changes: { title, category },
    });

    return true;
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

    // Notify the post author (never self; skip missing/deleted authors).
    if (post.userId && post.userId !== userId) {
      const actor = await ctx.db.get(userId);
      await ctx.db.insert("notifications", {
        userId: post.userId,
        title: "New like on your post",
        message: `${actor?.name ?? "A farmer"} liked "${post.title.slice(0, 80)}"`,
        type: "community",
        actionUrl: "/community",
        isRead: false,
        createdAt: Date.now(),
      });
    }

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

    // Notify the post author about the new comment (never self).
    if (post.userId && post.userId !== userId) {
      const actor = await ctx.db.get(userId);
      await ctx.db.insert("notifications", {
        userId: post.userId,
        title: "New comment on your post",
        message: `${actor?.name ?? "A farmer"} commented on "${post.title.slice(0, 80)}"`,
        type: "community",
        actionUrl: "/community",
        isRead: false,
        createdAt: Date.now(),
      });
    }

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
      .filter((q) => q.eq(q.field("isApproved"), true))
      .order("desc")
      .collect();

    const enriched = await Promise.all(
      comments.map(async (comment) => {
        const author = comment.userId ? await ctx.db.get(comment.userId) : null;
        return {
          ...comment,
          authorId: comment.userId,
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
/** Delete a comment (owner only, or any admin) */
export const deleteComment = mutation({
  args: { commentId: v.id("communityComments") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const user = await ctx.db.get(userId);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    const isAdmin = user?.role === "admin" || user?.role === "super_admin";
    if (comment.userId !== userId && !isAdmin) {
      throw new Error("You can only delete your own comments");
    }

    // Decrement comment count on the parent post (floor at 0 — a deleted
    // post's cascade already removed its comments without decrementing).
    const post = await ctx.db.get(comment.postId);
    if (post) {
      await ctx.db.patch(comment.postId, {
        comments: nextCommentCounts(post.comments, 1),
      });
    }

    await ctx.db.delete(args.commentId);

    await createAuditLog(ctx, {
      userId,
      action: "comment_deleted",
      resource: "communityComments",
      resourceId: args.commentId,
      changes: { postId: comment.postId },
    });

    return true;
  },
});

/**
 * Pure: floor-at-zero counter for post comment counts after removals.
 * Guards against drifting negative if a post's cascade delete raced a count.
 */
export function nextCommentCounts(current: number, removing: number): number {
  return Math.max(0, current - removing);
}

/**
 * Pure: extract up to `max` hashtags from post content. A hashtag is '#'
 * followed by one or more non-space, non-'#' characters — so runs of '#'
 * act as delimiters and never become tags. Shared by the composer UI and
 * tests so tag derivation follows one rule.
 */
export function extractHashtags(content: string, max = 5): string[] {
  const out: string[] = [];
  for (const match of content.matchAll(/#([^\s#]+)/g)) {
    if (out.length >= max) break;
    out.push(match[1]);
  }
  return out;
}

/**
 * Resolve every open report targeting a post or comment after moderation.
 * Returns how many reports were resolved (for audit trails).
 */
async function resolveReportsFor(
  ctx: MutationCtx,
  moderatorId: Id<"users">,
  target: { postId?: Id<"communityPosts">; commentId?: Id<"communityComments"> }
): Promise<number> {
  let open: Doc<"communityReports">[] = [];
  if (target.postId) {
    open = await ctx.db
      .query("communityReports")
      .withIndex("by_post", (q) => q.eq("postId", target.postId!))
      .filter((q) => q.eq(q.field("status"), "open"))
      .collect();
  } else if (target.commentId) {
    open = await ctx.db
      .query("communityReports")
      .withIndex("by_comment", (q) => q.eq("commentId", target.commentId!))
      .filter((q) => q.eq(q.field("status"), "open"))
      .collect();
  }
  for (const report of open) {
    await ctx.db.patch(report._id, {
      status: "resolved",
      resolvedBy: moderatorId,
      resolvedAt: Date.now(),
    });
  }
  return open.length;
}

/**
 * Pure: audit-log payload for a completed moderation action.
 * Shared shape by post and comment moderation.
 */
export function moderationAuditChanges(params: {
  action: "hide" | "restore";
  reportsResolved: number;
}): Record<string, unknown> {
  return {
    auditAction: params.action === "hide" ? "item_hidden" : "item_restored",
    reportsResolved: params.reportsResolved,
  };
}

export const incrementShareCount = mutation({
  args: { postId: v.id("communityPosts") },
  handler: async (ctx, args) => {
    // Phase 7: requires authentication — previously an unauthenticated
    // mutation that any client could call to inflate share counts.
    await requireAuth(ctx);
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
    const resolved = await resolveReportsFor(ctx, userId, { postId: args.postId });

    await createAuditLog(ctx, {
      userId,
      action: args.action === "hide" ? "post_hidden" : "post_restored",
      resource: "communityPosts",
      resourceId: args.postId,
      changes: {
        title: post.title,
        ...moderationAuditChanges({ action: args.action, reportsResolved: resolved }),
      },
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
    const postReports = reports.filter((r) => r.postId !== undefined);
    const byPost = new Map<string, Doc<"communityReports">[]>();
    for (const report of postReports) {
      const list = byPost.get(report.postId!) || [];
      list.push(report);
      byPost.set(report.postId!, list);
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

// ============================================================
// Comment moderation — same hide/restore model as posts
// ============================================================

/**
 * Report a comment (authenticated users). One report per user per comment —
 * re-reporting updates the reason. Self-reports are rejected.
 */
export const reportComment = mutation({
  args: {
    commentId: v.id("communityComments"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");
    if (comment.userId === userId) {
      throw new Error("You cannot report your own comment");
    }
    const reason = sanitizeInput(validateString(args.reason, "Report reason", 500));

    const existing = await ctx.db
      .query("communityReports")
      .withIndex("by_comment", (q) => q.eq("commentId", args.commentId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { reason, createdAt: Date.now() });
      return { success: true, alreadyReported: true };
    }

    await ctx.db.insert("communityReports", {
      commentId: args.commentId,
      userId,
      reason,
      status: "open",
      createdAt: Date.now(),
    });
    return { success: true, alreadyReported: false };
  },
});

/**
 * Admin: hide or restore a comment. Hidden comments are excluded from
 * public comment listings but never deleted — restorable.
 */
export const moderateComment = mutation({
  args: {
    commentId: v.id("communityComments"),
    action: v.union(v.literal("hide"), v.literal("restore")),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const comment = await ctx.db.get(args.commentId);
    if (!comment) throw new Error("Comment not found");

    const visibility = nextModerationVisibility(args.action, comment.isApproved);
    if (!visibility.valid) throw new Error("Invalid moderation action");
    if (visibility.isApproved === comment.isApproved) {
      throw new Error("Comment is already in that state");
    }

    await ctx.db.patch(args.commentId, { isApproved: visibility.isApproved });

    const resolved = await resolveReportsFor(ctx, userId, { commentId: args.commentId });

    await createAuditLog(ctx, {
      userId,
      action: args.action === "hide" ? "comment_hidden" : "comment_restored",
      resource: "communityComments",
      resourceId: args.commentId,
      changes: {
        postId: comment.postId,
        ...moderationAuditChanges({ action: args.action, reportsResolved: resolved }),
      },
    });

    return { success: true, isApproved: visibility.isApproved };
  },
});

/**
 * Admin: list reported comments with report counts and content context.
 */
export const listReportedComments = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const reports = await ctx.db.query("communityReports").collect();
    const commentReports = reports.filter((r) => r.commentId !== undefined);
    const byComment = new Map<string, Doc<"communityReports">[]>();
    for (const report of commentReports) {
      const list = byComment.get(report.commentId!) || [];
      list.push(report);
      byComment.set(report.commentId!, list);
    }
    const out = await Promise.all(
      [...byComment.entries()].map(async ([commentId, cReports]) => {
        const comment = await ctx.db.get(commentId as Id<"communityComments">);
        const post = comment ? await ctx.db.get(comment.postId) : null;
        return {
          commentId,
          contentPreview: comment?.content.slice(0, 120) ?? "[deleted]",
          postId: comment?.postId,
          postTitle: post?.title ?? "[deleted]",
          isApproved: comment?.isApproved ?? false,
          reportCount: cReports.length,
          openReports: cReports.filter((r) => r.status === "open").length,
          reasons: cReports.slice(0, 5).map((r) => r.reason),
          lastReportedAt: Math.max(...cReports.map((r) => r.createdAt)),
        };
      })
    );
    return out.sort((a, b) => b.lastReportedAt - a.lastReportedAt);
  },
});
