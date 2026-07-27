import { useState, useEffect, useCallback, useRef } from "react";

// ============================================================
// Types
// ============================================================

export interface Notification {
  id: string;
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
  timestamp: Date;
  read: boolean;
  type: "weather_alert" | "crop_reminder" | "system" | "market_update";
  priority: "high" | "medium" | "low";
}

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: Record<string, unknown>;
  type?: Notification["type"];
  priority?: Notification["priority"];
  requireInteraction?: boolean;
}

// ============================================================
// Notification Permission Hook
// ============================================================

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

// ============================================================
// Main Notifications Hook
// ============================================================

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  sendNotification: (options: NotificationOptions) => void;
  scheduleNotification: (options: NotificationOptions & { delay: number }) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotification: (id: string) => void;
  clearAll: () => void;
  isSupported: boolean;
}

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { permission, requestPermission } = useNotificationPermission();
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isSupported = typeof window !== "undefined" && "Notification" in window;

  // Load notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("farmbond-notifications");
      if (stored) {
        const parsed = JSON.parse(stored).map((n: Notification) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
        setNotifications(parsed);
      }
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  }, []);

  // Save notifications to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem("farmbond-notifications", JSON.stringify(notifications));
    } catch (error) {
      console.error("Failed to save notifications:", error);
    }
  }, [notifications]);

  const sendNotification = useCallback(
    (options: NotificationOptions) => {
      const notification: Notification = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        title: options.title,
        body: options.body,
        icon: options.icon || "/icons/icon-192.png",
        tag: options.tag,
        data: options.data,
        timestamp: new Date(),
        read: false,
        type: options.type || "system",
        priority: options.priority || "medium",
      };

      // Add to state
      setNotifications((prev) => [notification, ...prev].slice(0, 50)); // Keep last 50

      // Send browser notification if permitted
      if (permission === "granted" && isSupported) {
        try {
          const browserNotification = new Notification(options.title, {
            body: options.body,
            icon: options.icon || "/icons/icon-192.png",
            tag: options.tag,
            data: options.data,
            requireInteraction: options.requireInteraction,
          });

          browserNotification.onclick = () => {
            window.focus();
            browserNotification.close();
          };
        } catch (error) {
          console.error("Failed to send browser notification:", error);
        }
      }
    },
    [permission, isSupported]
  );

  const scheduleNotification = useCallback(
    (options: NotificationOptions & { delay: number }) => {
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      const timer = setTimeout(() => {
        sendNotification(options);
        timersRef.current.delete(id);
      }, options.delay);
      timersRef.current.set(id, timer);
    },
    [sendNotification]
  );

  const markAsRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    permission,
    requestPermission,
    sendNotification,
    scheduleNotification,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    isSupported,
  };
}

// ============================================================
// Weather Alert Notifications
// ============================================================

export function useWeatherAlertNotifications() {
  const { sendNotification, permission } = useNotifications();

  const sendWeatherAlert = useCallback(
    (alert: { type: string; severity: string; title: string; message: string }) => {
      if (permission !== "granted") return;

      const priority = alert.severity === "high" ? "high" : alert.severity === "medium" ? "medium" : "low";

      sendNotification({
        title: `🌤️ ${alert.title}`,
        body: alert.message,
        type: "weather_alert",
        priority,
        tag: `weather-${alert.type}-${Date.now()}`,
        requireInteraction: alert.severity === "high",
      });
    },
    [sendNotification, permission]
  );

  return { sendWeatherAlert };
}

// ============================================================
// Crop Reminder Notifications
// ============================================================

export function useCropReminderNotifications() {
  const { sendNotification, scheduleNotification, permission } = useNotifications();

  const sendCropReminder = useCallback(
    (reminder: { title: string; description: string; farm?: string; daysUntil?: number }) => {
      if (permission !== "granted") return;

      const body = reminder.farm
        ? `${reminder.description} at ${reminder.farm}`
        : reminder.description;

      if (reminder.daysUntil && reminder.daysUntil > 0) {
        // Schedule for future
        scheduleNotification({
          title: `🌱 ${reminder.title}`,
          body,
          type: "crop_reminder",
          priority: "medium",
          delay: reminder.daysUntil * 24 * 60 * 60 * 1000,
          tag: `crop-reminder-${Date.now()}`,
        });
      } else {
        // Send immediately
        sendNotification({
          title: `🌱 ${reminder.title}`,
          body,
          type: "crop_reminder",
          priority: "medium",
          tag: `crop-reminder-${Date.now()}`,
        });
      }
    },
    [sendNotification, scheduleNotification, permission]
  );

  return { sendCropReminder };
}
