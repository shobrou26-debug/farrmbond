import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/use-notifications";
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Trash2,
  Cloud,
  Sprout,
  DollarSign,
  Settings,
  X,
  AlertTriangle,
  Clock,
} from "lucide-react";

// ============================================================
// Notification Type Icons
// ============================================================

function getNotificationIcon(type: string) {
  switch (type) {
    case "weather_alert":
      return { icon: Cloud, color: "text-blue-500", bg: "bg-blue-500/10" };
    case "crop_reminder":
      return { icon: Sprout, color: "text-green-500", bg: "bg-green-500/10" };
    case "market_update":
      return { icon: DollarSign, color: "text-amber-500", bg: "bg-amber-500/10" };
    default:
      return { icon: Bell, color: "text-gray-500", bg: "bg-gray-500/10" };
  }
}

// ============================================================
// Single Notification Item
// ============================================================

function NotificationItem({
  notification,
  onRead,
  onDelete,
}: {
  notification: import("@/hooks/use-notifications").Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const typeConfig = getNotificationIcon(notification.type);
  const Icon = typeConfig.icon;
  const timeAgo = getTimeAgo(notification.timestamp);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className={`relative flex items-start gap-3 p-3 rounded-xl transition-colors cursor-pointer ${
        notification.read ? "bg-muted/30" : "bg-primary/5 hover:bg-primary/10"
      }`}
      onClick={() => !notification.read && onRead(notification.id)}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute top-3 left-1 w-2 h-2 bg-primary rounded-full" />
      )}

      {/* Type icon */}
      <div className={`flex items-center justify-center w-8 h-8 rounded-lg shrink-0 ${typeConfig.bg}`}>
        <Icon className={`w-4 h-4 ${typeConfig.color}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium line-clamp-1">{notification.title}</h4>
          {notification.priority === "high" && (
            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" />
            {timeAgo}
          </span>
          <Badge variant="secondary" className="text-[9px] px-1 py-0">
            {notification.type.replace("_", " ")}
          </Badge>
        </div>
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
      >
        <X className="w-3 h-3" />
      </Button>
    </motion.div>
  );
}

// ============================================================
// Time Helper
// ============================================================

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

// ============================================================
// Main NotificationCenter Component
// ============================================================

export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const {
    notifications,
    unreadCount,
    permission,
    requestPermission,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
    isSupported,
  } = useNotifications();

  return (
    <div className="relative">
      {/* Bell Button */}
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        {unreadCount > 0 ? (
          <BellRing className="w-5 h-5 text-primary" />
        ) : (
          <Bell className="w-5 h-5" />
        )}
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[9px] font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="absolute right-0 top-full mt-2 w-80 md:w-96 z-50 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">Notifications</h3>
                  {unreadCount > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {unreadCount} new
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {unreadCount > 0 && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={markAllAsRead}>
                      <CheckCheck className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={clearAll}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Permission Request */}
              {isSupported && permission !== "granted" && (
                <div className="p-4 bg-primary/5 border-b border-border">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                      <Bell className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium">Enable Notifications</p>
                      <p className="text-[10px] text-muted-foreground">
                        Get alerts for weather and crop reminders
                      </p>
                    </div>
                    <Button size="sm" onClick={requestPermission}>
                      Enable
                    </Button>
                  </div>
                </div>
              )}

              {/* Notification List */}
              <ScrollArea className="h-80">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <Bell className="w-8 h-8 text-muted-foreground/50 mb-3" />
                    <p className="text-sm font-medium text-muted-foreground">No notifications</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Weather alerts and reminders will appear here
                    </p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1">
                    <AnimatePresence>
                      {notifications.slice(0, 20).map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onRead={markAsRead}
                          onDelete={clearNotification}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </ScrollArea>

              {/* Footer */}
              {notifications.length > 0 && (
                <div className="p-3 border-t border-border">
                  <Button variant="ghost" size="sm" className="w-full text-xs">
                    <Settings className="w-3.5 h-3.5 mr-1.5" />
                    Notification Settings
                  </Button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
