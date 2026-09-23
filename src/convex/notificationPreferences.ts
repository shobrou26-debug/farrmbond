import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { QueryCtx, MutationCtx } from "./_generated/server";
import { requireAuth } from "./authHelpers";
import type { Id } from "./_generated/dataModel";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  resolveNotificationPreferences,
  type NotificationPreferenceKey,
  type NotificationPreferences,
} from "../lib/notificationPreferences";

// ============================================================
// Notification Preferences
//
// Persists the Settings → Notifications toggles per user.
// - `getMine` / `updateMine` back the Settings UI (auth-required,
//   ownership enforced by resolving the user server-side only).
// - `getEffectiveNotificationPrefs` is the shared enforcement
//   helper used by notification generators: a missing row means
//   defaults, so existing users see no behavior change until they
//   explicitly change a setting.
//
// Note: `pushEnabled` is stored but intentionally NOT used as a
// gate for in-app notification generation — the app has no device
// push service yet; wiring it as a master gate would silently
// suppress all in-app notifications for existing users.
// ============================================================

export type { NotificationPreferenceKey, NotificationPreferences };

/**
 * Effective preferences for a user — used by notification generators.
 * Missing row → defaults (no behavior change for existing users).
 */
export async function getEffectiveNotificationPrefs(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<NotificationPreferences> {
  const doc = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  return resolveNotificationPreferences(doc ?? undefined);
}

/** True when a notification category may be generated for this user. */
export async function isNotificationCategoryEnabled(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  category: Exclude<NotificationPreferenceKey, "pushEnabled">
): Promise<boolean> {
  const prefs = await getEffectiveNotificationPrefs(ctx, userId);
  return prefs[category];
}

// ============================================================
// Public API (Settings UI)
// ============================================================

/** Get the current user's saved preferences (null = never changed = defaults). */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const { userId } = await requireAuth(ctx);
    const doc = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return doc ?? null;
  },
});

const preferenceFlags = {
  weatherAlerts: v.boolean(),
  cropReminders: v.boolean(),
  livestockAlerts: v.boolean(),
  marketPrices: v.boolean(),
  communityUpdates: v.boolean(),
  aiInsights: v.boolean(),
  systemUpdates: v.boolean(),
  emailDigest: v.boolean(),
  pushEnabled: v.boolean(),
};

/** Upsert the current user's preferences (single row per user). */
export const updateMine = mutation({
  args: preferenceFlags,
  handler: async (ctx, args) => {
    const { userId } = await requireAuth(ctx);
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return { id: existing._id };
    }
    const id = await ctx.db.insert("notificationPreferences", {
      userId,
      ...args,
      updatedAt: now,
    });
    return { id };
  },
});
