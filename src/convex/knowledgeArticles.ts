import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import {
  requireAuth,
  requireAdmin,
  optionalAuth,
  hasRole,
  createAuditLog,
} from "./authHelpers";
import { ROLES } from "./schema";
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
        // The by_category index does NOT scope to published — drafts must be
        // filtered explicitly or they would leak into the public category view.
        .filter((q) => q.eq(q.field("isPublished"), true))
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

/** List all knowledge articles (ADMIN only — includes unpublished drafts) */
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("knowledgeArticles").collect();
  },
});

/**
 * Pure: an article is publicly readable only when published — unless the
 * viewer is an admin (draft preview). Drafts never leak to regular users.
 */
export function isArticleReadable(
  article: { isPublished: boolean } | null | undefined,
  isAdmin: boolean
): boolean {
  if (!article) return false;
  return article.isPublished || isAdmin;
}

/** Get a single article by ID — drafts are only visible to admins. */
export const getArticle = query({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    const article = await ctx.db.get(args.articleId);
    if (!article) return null;
    const viewer = await optionalAuth(ctx);
    const isAdmin = viewer ? hasRole(viewer.user.role, ROLES.ADMIN) : false;
    return isArticleReadable(article, isAdmin) ? article : null;
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

/**
 * Pure: next publish state for a toggle.
 * Publishing stamps a publishedAt; unpublishing keeps the record intact.
 */
export function nextPublishState(
  currentPublished: boolean | undefined,
  desiredPublished: boolean
): { isPublished: boolean; publishedAt?: number } {
  const now = Date.now();
  if (desiredPublished) {
    return {
      isPublished: true,
      ...(currentPublished ? {} : { publishedAt: now }),
    };
  }
  return { isPublished: false };
}

/** Edit a knowledge article (admin only) */
export const updateArticle = mutation({
  args: {
    articleId: v.id("knowledgeArticles"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const article = await ctx.db.get(args.articleId);
    if (!article) throw new Error("Article not found");
    const { articleId, ...updates } = args;
    await ctx.db.patch(articleId, { ...updates, updatedAt: Date.now() });
    await createAuditLog(ctx, {
      userId,
      action: "article_updated",
      resource: "knowledgeArticles",
      resourceId: articleId,
      changes: { fields: Object.keys(updates) },
    });
    return { success: true };
  },
});

/** Publish or unpublish a knowledge article (admin only) */
export const setArticlePublished = mutation({
  args: {
    articleId: v.id("knowledgeArticles"),
    published: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { userId } = await requireAdmin(ctx);
    const article = await ctx.db.get(args.articleId);
    if (!article) throw new Error("Article not found");
    const state = nextPublishState(article.isPublished, args.published);
    await ctx.db.patch(args.articleId, { ...state, updatedAt: Date.now() });
    await createAuditLog(ctx, {
      userId,
      action: args.published ? "article_published" : "article_unpublished",
      resource: "knowledgeArticles",
      resourceId: args.articleId,
      changes: { title: article.title },
    });
    return { success: true, isPublished: state.isPublished };
  },
});

// ============================================================
// Engagement Mutations
// ============================================================

/** Increment article view count */
export const incrementViews = mutation({
  args: { articleId: v.id("knowledgeArticles") },
  handler: async (ctx, args) => {
    // Phase 7: requires authentication — previously an unauthenticated
    // mutation that any client could call to inflate view counts.
    await requireAuth(ctx);
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
