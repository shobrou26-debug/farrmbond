import { getAuthUserId } from "@convex-dev/auth/server";
import {
  query,
  mutation,
  internalQuery,
  QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { requireAuth, createAuditLog } from "./authHelpers";
import {
  isValidProfilePhotoType,
  isWithinProfilePhotoSize,
  shouldDeleteReplacedPhoto,
} from "../lib/profilePhoto";

/**
 * Get the current signed in user. Returns null if the user is not signed in.
 * Usage: const signedInUser = await ctx.runQuery(api.authHelpers.currentUser);
 * THIS FUNCTION IS READ-ONLY. DO NOT MODIFY.
 */
export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);

    if (user === null) {
      return null;
    }

    return user;
  },
});

/**
 * Use this function internally to get the current user data. Remember to handle the null user case.
 * @param ctx
 * @returns
 */
export const getCurrentUser = async (ctx: QueryCtx) => {
  const userId = await getAuthUserId(ctx);
  if (userId === null) {
    return null;
  }
  return await ctx.db.get(userId);
};

/**
 * Get a user by their ID.
 * INTERNAL ONLY — exposed as an internal query so only server-side callers
 * (webhooks, actions, crons) can read arbitrary user records. The client
 * must use `currentUser`, which is always scoped to the signed-in session.
 */
export const getUserById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

/**
 * Get a user by their Stripe customer ID.
 * INTERNAL ONLY — used by the Stripe webhook; not callable from the client.
 */
export const getUserByStripeCustomer = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    // Phase 7: indexed lookup (by_stripe_customer) — the previous filter
    // walked the whole users table on every Stripe webhook event.
    const user = await ctx.db
      .query("users")
      .withIndex("by_stripe_customer", (q) =>
        q.eq("stripeCustomerId", args.stripeCustomerId)
      )
      .first();
    return user || null;
  },
});

// ============================================================
// User Preferences
// ============================================================

/** Update user preferences (units, currency, timezone) */
export const updatePreferences = mutation({
  args: {
    units: v.optional(v.union(v.literal("metric"), v.literal("imperial"))),
    currency: v.optional(v.string()),
    timezone: v.optional(v.string()),
    theme: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const updates: Record<string, unknown> = {};
    if (args.units !== undefined) updates.units = args.units;
    if (args.currency !== undefined) updates.currency = args.currency;
    if (args.timezone !== undefined) updates.timezone = args.timezone;
    if (args.theme !== undefined) updates.theme = args.theme;

    await ctx.db.patch(userId, updates);
    return { success: true };
  },
});

/**
 * Update the current user's editable profile fields (Settings → Profile).
 * Email is intentionally NOT editable here — it is the auth identity.
 * Ownership is implicit: the row patched is the authenticated user's own.
 */
export const updateProfile = mutation({
  args: {
    name: v.string(),
    phone: v.optional(v.string()),
    location: v.optional(v.string()),
    bio: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    await ctx.db.patch(userId, {
      name: args.name,
      ...(args.phone !== undefined ? { phone: args.phone } : {}),
      ...(args.location !== undefined ? { location: args.location } : {}),
      ...(args.bio !== undefined ? { bio: args.bio } : {}),
    });
    return { success: true };
  },
});

// ============================================================
// Profile Photo (Convex file storage)
//
// The photo file lives in Convex storage; the user row keeps a
// display URL in `image` plus the owning `imageStorageId`. Storing
// the URL keeps every existing avatar consumer (`user.image`)
// working without change; storing the id enables replacing the
// blob (no orphaned files) and honest deletion.
// The server re-validates type/size from the stored blob's own
// metadata — never from client input.
// ============================================================

/** Auth-gated upload URL for the current user's profile photo. */
export const generateProfilePhotoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Attach an uploaded storage blob as the current user's profile
 * photo. The blob's metadata is verified (real image type, within
 * size limit) before it is accepted; the previous photo blob is
 * deleted when replaced (unless still referenced elsewhere).
 */
export const setProfilePhoto = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const { userId, user } = await requireAuth(ctx);

    // Validate the stored blob itself — never trust client metadata.
    const metadata = await ctx.db.system.get(args.storageId);
    if (!metadata || !isValidProfilePhotoType(metadata.contentType ?? null)) {
      throw new Error("Unsupported image type. Use JPEG, PNG, or WebP.");
    }
    if (!isWithinProfilePhotoSize(metadata.size)) {
      throw new Error("Image is too large or empty. Maximum size is 5 MB.");
    }

    const storageUrl = await ctx.storage.getUrl(args.storageId);
    if (!storageUrl) {
      throw new Error("Uploaded image could not be resolved. Try again.");
    }

    const previousStorageId = user.imageStorageId;

    await ctx.db.patch(userId, {
      image: storageUrl,
      imageStorageId: args.storageId,
    });

    // Delete the replaced blob so storage doesn't accumulate orphans.
    if (
      previousStorageId &&
      shouldDeleteReplacedPhoto({
        previousStorageId,
        newStorageId: args.storageId,
        referencedElsewhere:
          (
            await ctx.db
              .query("users")
              .withIndex("by_image_storage", (q) =>
                q.eq("imageStorageId", previousStorageId)
              )
              .first()
          ) !== null,
      })
    ) {
      await ctx.storage.delete(previousStorageId);
    }

    await createAuditLog(ctx, {
      userId,
      action: "profile_photo_set",
      resource: "users",
      resourceId: userId,
    });
    return { success: true };
  },
});

/**
 * Remove the current user's profile photo: clears the display URL
 * and storage reference and deletes the blob (unless referenced
 * elsewhere).
 */
export const removeProfilePhoto = mutation({
  args: {},
  handler: async (ctx) => {
    const { userId, user } = await requireAuth(ctx);
    const previousStorageId = user.imageStorageId;

    await ctx.db.patch(userId, {
      image: undefined,
      imageStorageId: undefined,
    });

    if (previousStorageId) {
      const referencedElsewhere =
        (
          await ctx.db
            .query("users")
            .withIndex("by_image_storage", (q) =>
              q.eq("imageStorageId", previousStorageId)
            )
            .first()
        ) !== null;
      if (!referencedElsewhere) {
        await ctx.storage.delete(previousStorageId);
      }
    }

    await createAuditLog(ctx, {
      userId,
      action: "profile_photo_removed",
      resource: "users",
      resourceId: userId,
    });
    return { success: true };
  },
});

/** Get current user preferences */
export const getPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      units: user.units ?? "metric",
      currency: user.currency ?? "KES",
      timezone: user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      theme: user.theme ?? "green-fields",
    };
  },
});

/**
 * Real usage counts for the signed-in user, shown on the Settings page.
 * Replaces hardcoded usage numbers — each metric is derived from the
 * actual database records owned by the authenticated user.
 */
export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const [farms, crops, livestock, transactions, aiChats] = await Promise.all([
      ctx.db.query("farms").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("crops").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("livestock").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("transactions").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
      ctx.db.query("aiChats").withIndex("by_user", (q) => q.eq("userId", userId)).collect(),
    ]);

    return {
      farms: farms.length,
      crops: crops.length,
      livestock: livestock.length,
      transactions: transactions.length,
      aiSessions: aiChats.length,
    };
  },
});
