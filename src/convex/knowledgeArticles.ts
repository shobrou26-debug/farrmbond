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

/** Like an article (toggle) */
export const toggleLike = mutation({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const article = await ctx.db.get(args.articleId);
    if (!article) throw new Error("Article not found");
    // Check if already liked
    const existing = await ctx.db
      .query("userBookmarks")
      .withIndex("by_user_article", (q) =>
        q.eq("userId", userId).eq("articleId", args.articleId)
      )
      .first();
    // For simplicity, likes just increment (no per-user like tracking in this version)
    await ctx.db.patch(args.articleId, { likes: article.likes + 1 });
    return { success: true, likes: article.likes + 1 };
  },
});

/** Toggle bookmark for an article */
export const toggleBookmark = mutation({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const article = await ctx.db.get(args.articleId);
    if (!article) throw new Error("Article not found");
    // Check if already bookmarked
    const existing = await ctx.db
      .query("userBookmarks")
      .withIndex("by_user_article", (q) =>
        q.eq("userId", userId).eq("articleId", args.articleId)
      )
      .first();
    if (existing) {
      // Remove bookmark
      await ctx.db.delete(existing._id);
      await ctx.db.patch(args.articleId, { bookmarks: Math.max(0, article.bookmarks - 1) });
      return { bookmarked: false, bookmarks: Math.max(0, article.bookmarks - 1) };
    } else {
      // Add bookmark
      await ctx.db.insert("userBookmarks", {
        userId,
        articleId: args.articleId,
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
      .collect();
    return bookmarks.map((b) => b.articleId);
  },
});
