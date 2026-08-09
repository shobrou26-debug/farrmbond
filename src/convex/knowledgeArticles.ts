import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAdmin } from "./authHelpers";
import { getAuthUserId } from "@convex-dev/auth/server";

/** List published knowledge articles with optional category filter */
export const listPublished = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let articles;
    if (args.category && args.category !== "all") {
      articles = await ctx.db
        .query("knowledgeArticles")
        .withIndex("by_category", (q) => q.eq("category", args.category!))
        .collect();
    } else {
      articles = await ctx.db
        .query("knowledgeArticles")
        .withIndex("by_published", (q) => q.eq("isPublished", true))
        .collect();
    }
    return articles;
  },
});

/** List all knowledge articles (admin) */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.db.query("knowledgeArticles").collect();
  },
});

/** Get a single article by ID */
export const getArticle = query({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.articleId);
  },
});

/** Create a knowledge article (admin) */
export const createArticle = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    content: v.string(),
    category: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const now = Date.now();
    return await ctx.db.insert("knowledgeArticles", {
      authorId: userId,
      ...args,
      views: 0,
      likes: 0,
      bookmarks: 0,
      isPublished: true,
      isFeatured: false,
      createdAt: now,
      updatedAt: now,
      publishedAt: now,
    });
  },
});

/** Delete a knowledge article (admin) */
export const deleteArticle = mutation({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.articleId);
    return { success: true };
  },
});

// ============================================================
// Engagement Mutations
// ============================================================

/** Increment article view count */
export const incrementViews = mutation({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId);
    if (!article) throw new Error("Article not found");
    await ctx.db.patch(args.articleId, { views: article.views + 1 });
    return { success: true };
  },
});

/**
 * Pure: compute the new like count for a toggle.
 * Never goes below 0, never trusts a missing/NaN stored count.
 */
export function nextLikeCount(currentLikes: number | undefined, isNowLiked: boolean): number {
  const base = typeof currentLikes === "number" && !isNaN(currentLikes) ? currentLikes : 0;
  return isNowLiked ? base + 1 : Math.max(0, base - 1);
}

/** Like an article (real per-user toggle) */
export const toggleLike = mutation({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const article = await ctx.db.get(args.articleId);
    if (!article) throw new Error("Article not found");

    // Per-user like record (kind "like" — independent from bookmarks)
    const existing = await ctx.db
      .query("userBookmarks")
      .withIndex("by_user_article", (q) =>
        q.eq("userId", userId).eq("articleId", args.articleId)
      )
      .filter((q) => q.eq(q.field("kind"), "like"))
      .first();

    if (existing) {
      // Unlike
      await ctx.db.delete(existing._id);
      const likes = nextLikeCount(article.likes, false);
      await ctx.db.patch(args.articleId, { likes });
      return { success: true, liked: false, likes };
    }

    // Like
    await ctx.db.insert("userBookmarks", {
      userId,
      articleId: args.articleId,
      kind: "like",
      createdAt: Date.now(),
    });
    const likes = nextLikeCount(article.likes, true);
    await ctx.db.patch(args.articleId, { likes });
    return { success: true, liked: true, likes };
  },
});

/** Toggle bookmark for an article */
export const toggleBookmark = mutation({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const article = await ctx.db.get(args.articleId);
    if (!article) throw new Error("Article not found");
    // Check if already bookmarked (kind "bookmark" only — likes live in
    // the same table with kind "like" and must not collide)
    const existing = await ctx.db
      .query("userBookmarks")
      .withIndex("by_user_article", (q) =>
        q.eq("userId", userId).eq("articleId", args.articleId)
      )
      .filter((q) => q.eq(q.field("kind"), "bookmark"))
      .first();
    if (existing) {
      // Remove bookmark
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.articleId, { bookmarks: Math.max(0, article.bookmarks - 1) });
      return { bookmarked: false, bookmarks: Math.max(0, article.bookmarks - 1) };
    } else {
      // Add bookmark (kind discriminator keeps likes and bookmarks separate)
      await ctx.db.insert("userBookmarks", {
        userId,
        articleId: args.articleId,
        kind: "bookmark",
        createdAt: Date.now(),
      });
      await ctx.db.patch(args.articleId, { bookmarks: article.bookmarks + 1 });
      return { bookmarked: true, bookmarks: article.bookmarks + 1 };
    }
  },
});

/** Get user's bookmarked article IDs */
export const getUserBookmarks = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const bookmarks = await ctx.db
      .query("userBookmarks")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("kind"), "bookmark"))
      .collect();
    return bookmarks.map((b) => b.articleId);
  },
});
