import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAdmin } from "./authHelpers";

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
