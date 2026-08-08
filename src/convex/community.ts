import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
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
