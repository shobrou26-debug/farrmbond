import { useState, useEffect, useCallback } from "react";

// ============================================================
// Types
// ============================================================
export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "view"
  | "login"
  | "logout"
  | "export"
  | "import"
  | "share"
  | "download"
  | "upload"
  | "search"
  | "filter"
  | "settings_change"
  | "notification_sent"
  | "notification_read"
  | "alert_triggered"
  | "alert_acknowledged"
  | "alert_dismissed"
  | "payment"
  | "subscription"
  | "role_change"
  | "permission_change";

export type AuditEntityType =
  | "farm"
  | "crop"
  | "livestock"
  | "transaction"
  | "weather"
  | "irrigation"
  | "calendar"
  | "community"
  | "agronomist"
  | "user"
  | "settings"
  | "notification"
  | "alert"
  | "report"
  | "system";

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  userRole: "farmer" | "agronomist" | "admin" | "super_admin";
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string;
  entityName?: string;
  description: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  status: "success" | "failure" | "pending";
}

export interface AuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  action?: AuditAction;
  entityType?: AuditEntityType;
  status?: "success" | "failure" | "pending";
  searchQuery?: string;
}

export interface AuditLogStats {
  totalActions: number;
  actionsByType: Record<AuditAction, number>;
  actionsByEntity: Record<AuditEntityType, number>;
  recentActivity: AuditLogEntry[];
  topUsers: { userId: string; userName: string; count: number }[];
  actionsToday: number;
  actionsThisWeek: number;
  actionsThisMonth: number;
}

// ============================================================
// Mock Data
// ============================================================
const mockAuditLogs: AuditLogEntry[] = [
  {
    id: "1",
    timestamp: new Date("2026-07-27T10:30:00"),
    userId: "u1",
    userName: "John Kamau",
    userRole: "farmer",
    action: "create",
    entityType: "farm",
    entityId: "f1",
    entityName: "Sunrise Ranch",
    description: "Created new farm: Sunrise Ranch",
    details: { area: 45, location: "Nakuru, Kenya" },
    status: "success",
  },
  {
    id: "2",
    timestamp: new Date("2026-07-27T09:15:00"),
    userId: "u1",
    userName: "John Kamau",
    userRole: "farmer",
    action: "update",
    entityType: "crop",
    entityId: "c1",
    entityName: "Maize Field A",
    description: "Updated crop status from 'planted' to 'growing'",
    details: { oldValue: "planted", newValue: "growing" },
    status: "success",
  },
  {
    id: "3",
    timestamp: new Date("2026-07-26T16:45:00"),
    userId: "u2",
    userName: "Dr. Sarah Ochieng",
    userRole: "agronomist",
    action: "view",
    entityType: "farm",
    entityId: "f1",
    entityName: "Sunrise Ranch",
    description: "Viewed farm details",
    status: "success",
  },
  {
    id: "4",
    timestamp: new Date("2026-07-26T14:20:00"),
    userId: "u3",
    userName: "Admin User",
    userRole: "admin",
    action: "export",
    entityType: "report",
    description: "Exported financial report as PDF",
    details: { format: "pdf", dateRange: "2026-06-01 to 2026-06-30" },
    status: "success",
  },
  {
    id: "5",
    timestamp: new Date("2026-07-26T11:00:00"),
    userId: "u1",
    userName: "John Kamau",
    userRole: "farmer",
    action: "payment",
    entityType: "transaction",
    entityId: "t1",
    entityName: "Maize Sale",
    description: "Recorded income: KES 12,000 from maize sale",
    details: { amount: 12000, currency: "KES", category: "Harvest Sale" },
    status: "success",
  },
  {
    id: "6",
    timestamp: new Date("2026-07-25T08:30:00"),
    userId: "u1",
    userName: "John Kamau",
    userRole: "farmer",
    action: "alert_triggered",
    entityType: "weather",
    description: "Weather alert triggered: Heavy Rain Warning",
    details: { severity: "high", precipitation: 45 },
    status: "success",
  },
  {
    id: "7",
    timestamp: new Date("2026-07-25T08:35:00"),
    userId: "u1",
    userName: "John Kamau",
    userRole: "farmer",
    action: "alert_acknowledged",
    entityType: "alert",
    entityId: "a1",
    description: "Acknowledged weather alert: Heavy Rain Warning",
    status: "success",
  },
  {
    id: "8",
    timestamp: new Date("2026-07-24T15:00:00"),
    userId: "u3",
    userName: "Admin User",
    userRole: "admin",
    action: "role_change",
    entityType: "user",
    entityId: "u4",
    entityName: "New Farmer",
    description: "Changed user role from 'viewer' to 'farmer'",
    details: { oldRole: "viewer", newRole: "farmer" },
    status: "success",
  },
  {
    id: "9",
    timestamp: new Date("2026-07-24T10:15:00"),
    userId: "u1",
    userName: "John Kamau",
    userRole: "farmer",
    action: "login",
    entityType: "user",
    description: "User logged in via email",
    details: { method: "email" },
    status: "success",
  },
  {
    id: "10",
    timestamp: new Date("2026-07-23T14:30:00"),
    userId: "u2",
    userName: "Dr. Sarah Ochieng",
    userRole: "agronomist",
    action: "create",
    entityType: "community",
    entityId: "p1",
    entityName: "Pest Control Tips",
    description: "Published new community post: Pest Control Tips",
    status: "success",
  },
  {
    id: "11",
    timestamp: new Date("2026-07-23T09:00:00"),
    userId: "u1",
    userName: "John Kamau",
    userRole: "farmer",
    action: "settings_change",
    entityType: "settings",
    description: "Updated notification preferences",
    details: { setting: "pushNotifications", oldValue: false, newValue: true },
    status: "success",
  },
  {
    id: "12",
    timestamp: new Date("2026-07-22T16:00:00"),
    userId: "u1",
    userName: "John Kamau",
    userRole: "farmer",
    action: "delete",
    entityType: "crop",
    entityId: "c2",
    entityName: "Old Tomato Plot",
    description: "Deleted crop record: Old Tomato Plot",
    status: "success",
  },
  {
    id: "13",
    timestamp: new Date("2026-07-22T11:30:00"),
    userId: "u1",
    userName: "John Kamau",
    userRole: "farmer",
    action: "share",
    entityType: "farm",
    entityId: "f1",
    entityName: "Sunrise Ranch",
    description: "Shared farm access with agronomist",
    details: { sharedWith: "Dr. Sarah Ochieng", permission: "view" },
    status: "success",
  },
  {
    id: "14",
    timestamp: new Date("2026-07-21T08:00:00"),
    userId: "u1",
    userName: "John Kamau",
    userRole: "farmer",
    action: "download",
    entityType: "report",
    description: "Downloaded crop yield report",
    details: { format: "pdf", reportType: "crop_yield" },
    status: "success",
  },
  {
    id: "15",
    timestamp: new Date("2026-07-20T14:00:00"),
    userId: "u3",
    userName: "Admin User",
    userRole: "admin",
    action: "update",
    entityType: "user",
    entityId: "u1",
    entityName: "John Kamau",
    description: "Updated user subscription to Premium",
    details: { oldPlan: "Free", newPlan: "Premium" },
    status: "success",
  },
];

// ============================================================
// Helper Functions
// ============================================================
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function getActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    create: "Created",
    update: "Updated",
    delete: "Deleted",
    view: "Viewed",
    login: "Logged In",
    logout: "Logged Out",
    export: "Exported",
    import: "Imported",
    share: "Shared",
    download: "Downloaded",
    upload: "Uploaded",
    search: "Searched",
    filter: "Filtered",
    settings_change: "Settings Changed",
    notification_sent: "Notification Sent",
    notification_read: "Notification Read",
    alert_triggered: "Alert Triggered",
    alert_acknowledged: "Alert Acknowledged",
    alert_dismissed: "Alert Dismissed",
    payment: "Payment",
    subscription: "Subscription",
    role_change: "Role Changed",
    permission_change: "Permission Changed",
  };
  return labels[action] || action;
}

function getEntityLabel(entityType: AuditEntityType): string {
  const labels: Record<AuditEntityType, string> = {
    farm: "Farm",
    crop: "Crop",
    livestock: "Livestock",
    transaction: "Transaction",
    weather: "Weather",
    irrigation: "Irrigation",
    calendar: "Calendar",
    community: "Community",
    agronomist: "Agronomist",
    user: "User",
    settings: "Settings",
    notification: "Notification",
    alert: "Alert",
    report: "Report",
    system: "System",
  };
  return labels[entityType] || entityType;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "success":
      return "text-green-600 bg-green-50";
    case "failure":
      return "text-red-600 bg-red-50";
    case "pending":
      return "text-amber-600 bg-amber-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
}

function getActionColor(action: AuditAction): string {
  const colors: Record<AuditAction, string> = {
    create: "text-green-600 bg-green-50",
    update: "text-blue-600 bg-blue-50",
    delete: "text-red-600 bg-red-50",
    view: "text-gray-600 bg-gray-50",
    login: "text-purple-600 bg-purple-50",
    logout: "text-gray-600 bg-gray-50",
    export: "text-indigo-600 bg-indigo-50",
    import: "text-indigo-600 bg-indigo-50",
    share: "text-cyan-600 bg-cyan-50",
    download: "text-indigo-600 bg-indigo-50",
    upload: "text-indigo-600 bg-indigo-50",
    search: "text-gray-600 bg-gray-50",
    filter: "text-gray-600 bg-gray-50",
    settings_change: "text-amber-600 bg-amber-50",
    notification_sent: "text-blue-600 bg-blue-50",
    notification_read: "text-blue-600 bg-blue-50",
    alert_triggered: "text-orange-600 bg-orange-50",
    alert_acknowledged: "text-green-600 bg-green-50",
    alert_dismissed: "text-gray-600 bg-gray-50",
    payment: "text-green-600 bg-green-50",
    subscription: "text-purple-600 bg-purple-50",
    role_change: "text-amber-600 bg-amber-50",
    permission_change: "text-amber-600 bg-amber-50",
  };
  return colors[action] || "text-gray-600 bg-gray-50";
}

// ============================================================
// Main Hook
// ============================================================
interface UseAuditLogReturn {
  logs: AuditLogEntry[];
  stats: AuditLogStats;
  isLoading: boolean;
  addLog: (log: Omit<AuditLogEntry, "id" | "timestamp" | "ipAddress" | "userAgent">) => void;
  getLogs: (filters?: AuditLogFilters) => AuditLogEntry[];
  getLogsByEntity: (entityType: AuditEntityType, entityId?: string) => AuditLogEntry[];
  getLogsByUser: (userId: string) => AuditLogEntry[];
  getLogsByAction: (action: AuditAction) => AuditLogEntry[];
  clearLogs: () => void;
  exportLogs: (format: "pdf" | "excel") => void;
  getActionLabel: (action: AuditAction) => string;
  getEntityLabel: (entityType: AuditEntityType) => string;
  getStatusColor: (status: string) => string;
  getActionColor: (action: AuditAction) => string;
}

export function useAuditLog(): UseAuditLogReturn {
  const [logs, setLogs] = useState<AuditLogEntry[]>(() => {
    const stored = localStorage.getItem("farmbond-audit-logs");
    if (stored) {
      try {
        return JSON.parse(stored).map((log: AuditLogEntry) => ({
          ...log,
          timestamp: new Date(log.timestamp),
        }));
      } catch {
        return mockAuditLogs;
      }
    }
    return mockAuditLogs;
  });

  const [isLoading, setIsLoading] = useState(false);

  // Save to localStorage when logs change
  useEffect(() => {
    localStorage.setItem("farmbond-audit-logs", JSON.stringify(logs));
  }, [logs]);

  // Add new log entry
  const addLog = useCallback(
    (newLog: Omit<AuditLogEntry, "id" | "timestamp" | "ipAddress" | "userAgent">) => {
      const entry: AuditLogEntry = {
        ...newLog,
        id: generateId(),
        timestamp: new Date(),
        ipAddress: "192.168.1.1", // Would be real IP in production
        userAgent: navigator.userAgent,
      };

      setLogs((prev) => [entry, ...prev].slice(0, 1000)); // Keep last 1000 entries
    },
    []
  );

  // Get filtered logs
  const getLogs = useCallback(
    (filters?: AuditLogFilters) => {
      let filtered = [...logs];

      if (filters) {
        if (filters.startDate) {
          filtered = filtered.filter((log) => log.timestamp >= filters.startDate!);
        }
        if (filters.endDate) {
          filtered = filtered.filter((log) => log.timestamp <= filters.endDate!);
        }
        if (filters.userId) {
          filtered = filtered.filter((log) => log.userId === filters.userId);
        }
        if (filters.action) {
          filtered = filtered.filter((log) => log.action === filters.action);
        }
        if (filters.entityType) {
          filtered = filtered.filter((log) => log.entityType === filters.entityType);
        }
        if (filters.status) {
          filtered = filtered.filter((log) => log.status === filters.status);
        }
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          filtered = filtered.filter(
            (log) =>
              log.description.toLowerCase().includes(query) ||
              log.userName.toLowerCase().includes(query) ||
              (log.entityName && log.entityName.toLowerCase().includes(query))
          );
        }
      }

      return filtered;
    },
    [logs]
  );

  // Get logs by entity type
  const getLogsByEntity = useCallback(
    (entityType: AuditEntityType, entityId?: string) => {
      return logs.filter(
        (log) =>
          log.entityType === entityType && (entityId ? log.entityId === entityId : true)
      );
    },
    [logs]
  );

  // Get logs by user
  const getLogsByUser = useCallback(
    (userId: string) => {
      return logs.filter((log) => log.userId === userId);
    },
    [logs]
  );

  // Get logs by action
  const getLogsByAction = useCallback(
    (action: AuditAction) => {
      return logs.filter((log) => log.action === action);
    },
    [logs]
  );

  // Clear all logs
  const clearLogs = useCallback(() => {
    setLogs([]);
    localStorage.removeItem("farmbond-audit-logs");
  }, []);

  // Export logs
  const exportLogs = useCallback(
    (format: "pdf" | "excel") => {
      // This would use the exports utility in production
      console.log(`Exporting ${logs.length} logs as ${format}`);
    },
    [logs]
  );

  // Calculate stats
  const stats: AuditLogStats = {
    totalActions: logs.length,
    actionsByType: logs.reduce(
      (acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      },
      {} as Record<AuditAction, number>
    ),
    actionsByEntity: logs.reduce(
      (acc, log) => {
        acc[log.entityType] = (acc[log.entityType] || 0) + 1;
        return acc;
      },
      {} as Record<AuditEntityType, number>
    ),
    recentActivity: logs.slice(0, 10),
    topUsers: Object.entries(
      logs.reduce(
        (acc, log) => {
          if (!acc[log.userId]) {
            acc[log.userId] = { userId: log.userId, userName: log.userName, count: 0 };
          }
          acc[log.userId].count++;
          return acc;
        },
        {} as Record<string, { userId: string; userName: string; count: number }>
      )
    )
      .map(([, data]) => data)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    actionsToday: logs.filter((log) => {
      const today = new Date();
      return log.timestamp.toDateString() === today.toDateString();
    }).length,
    actionsThisWeek: logs.filter((log) => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return log.timestamp >= weekAgo;
    }).length,
    actionsThisMonth: logs.filter((log) => {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return log.timestamp >= monthAgo;
    }).length,
  };

  return {
    logs,
    stats,
    isLoading,
    addLog,
    getLogs,
    getLogsByEntity,
    getLogsByUser,
    getLogsByAction,
    clearLogs,
    exportLogs,
    getActionLabel,
    getEntityLabel,
    getStatusColor,
    getActionColor,
  };
}

// Export helpers for use in components
export { getActionLabel, getEntityLabel, getStatusColor, getActionColor };
