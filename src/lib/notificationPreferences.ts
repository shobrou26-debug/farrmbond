// ============================================================
// Notification preference defaults + resolver (shared, pure)
//
// Single source of truth used by BOTH:
// - the Settings UI (src/pages/Settings.tsx)
// - the Convex backend (src/convex/notificationPreferences.ts)
//
// Keep this file free of platform-specific imports (no convex,
// no react) so it bundles safely on both sides.
// ============================================================

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  weatherAlerts: true,
  cropReminders: true,
  livestockAlerts: true,
  marketPrices: false,
  communityUpdates: true,
  aiInsights: true,
  systemUpdates: true,
  emailDigest: true,
  pushEnabled: false,
} as const;

export type NotificationPreferenceKey = keyof typeof DEFAULT_NOTIFICATION_PREFERENCES;
export type NotificationPreferences = Record<NotificationPreferenceKey, boolean>;

/**
 * Merge a (possibly partial or missing) saved record onto the defaults.
 * Missing fields fall back to defaults so older/partial rows stay valid.
 */
export function resolveNotificationPreferences(
  saved: Partial<NotificationPreferences> | null | undefined
): NotificationPreferences {
  return { ...DEFAULT_NOTIFICATION_PREFERENCES, ...(saved ?? {}) };
}
