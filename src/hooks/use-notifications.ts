import { useState, useEffect, useCallback } from "react";

// ============================================================
// Notification Permission Hook
// ============================================================
//
// NOTE: The in-app notification feed is server-backed via the Convex
// `smartNotifications` module (see NotificationCenter.tsx). This hook only
// handles the browser-level notification permission, which is inherently a
// client-side browser API. Previously this file also contained a
// localStorage-backed notification feed — that was dead code (zero consumers)
// and has been removed.

export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!("Notification" in window)) {
      console.warn("Notifications not supported");
      return "denied";
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      return result;
    } catch (error) {
      console.error("Failed to request notification permission:", error);
      return "denied";
    }
  }, []);

  return { permission, requestPermission };
}
