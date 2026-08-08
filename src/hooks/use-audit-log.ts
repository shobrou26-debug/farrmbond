import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { exportAnalyticsData } from "@/lib/exports";

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
// DB Row → Entry Mapping
// ============================================================

/** Map the snake_case DB action strings (e.g. "crop_created") onto the AuditAction union. */
function mapAction(action: string): AuditAction {
  if (action === "create") return "create";
  if (action === "update") return "update";
  if (action === "delete") return "delete";
  if (action.endsWith("_created")) return "create";
  if (action.endsWith("_updated")) return "update";
  if (action.endsWith("_deleted")) return "delete";
  if (action === "role_changed") return "role_change";
  if (action.includes("subscription") || action.includes("trial")) return "subscription";
  if (action.includes("payment") || action === "mobile_payment_completed") return "payment";
  if (action.includes("warning_sent") || action.includes("reminder_sent")) return "notification_sent";
  if (action.includes("notification")) return "notification_sent";
  if (action.includes("alert")) return "alert_triggered";
  if (action.includes("login")) return "login";
  if (action.includes("logout")) return "logout";
  if (action.includes("export")) return "export";
  if (action.includes("share")) return "share";
  if (action.includes("download")) return "download";
  if (action.includes("upload")) return "upload";
  if (action.includes("permission")) return "permission_change";
  if (action.includes("settings") || action.includes("preference")) return "settings_change";
  return "view";
}

/** Map the DB resource name (e.g. "farms") onto the AuditEntityType union. */
function mapEntity(resource: string): AuditEntityType {
  if (resource === "farms" || resource === "farm") return "farm";
  if (resource === "crops" || resource === "crop") return "crop";
  if (resource === "livestock") return "livestock";
  if (resource === "transactions" || resource === "transaction") return "transaction";
  if (resource === "users" || resource === "user") return "user";
  if (resource === "community" || resource === "posts") return "community";
  if (resource === "agronomist" || resource === "consultations" || resource === "consultation") return "agronomist";
  if (resource === "calendar" || resource === "events" || resource === "farming_events") return "calendar";
  if (resource === "weather") return "weather";
  if (resource === "irrigation") return "irrigation";
  if (resource === "notification" || resource === "notifications") return "notification";
  if (resource === "alert" || resource === "alerts") return "alert";
  if (resource === "report" || resource === "reports") return "report";
  if (resource === "settings") return "settings";
  return "system";
}

/** Build a human-readable description from the DB row fields. */
function buildDescription(action: AuditAction, entityType: AuditEntityType, details?: Record<string, unknown>): string {
  let desc = `${getActionLabel(action)} ${getEntityLabel(entityType).toLowerCase()}`;
  if (details && typeof details === "object") {
    const field = details.field as string | undefined;
    if (field) {
      const oldValue = details.oldValue as string | number | undefined;
      const newValue = details.newValue as string | number | undefined;
      desc += ` (${field}: ${oldValue ?? "—"} → ${newValue ?? "—"})`;
    } else if (details.status) {
      desc += ` (status: ${String(details.status)})`;
    }
  }
  return desc;
}

/** Convert an enriched Convex auditLogs row into the hook's AuditLogEntry shape. */
function mapRow(row: {
  _id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
}): AuditLogEntry {
  const action = mapAction(row.action);
  const entityType = mapEntity(row.resource);
  const details = row.changes;
  const entityName =
    (details?.entityName as string | undefined) ??
    (details?.userName as string | undefined) ??
    (details?.name as string | undefined);

  const userRole = ["farmer", "agronomist", "admin", "super_admin"].includes(
    row.userRole ?? ""
  )
    ? (row.userRole as AuditLogEntry["userRole"])
    : "farmer";

  return {
    id: row._id,
    timestamp: new Date(row.createdAt),
    userId: row.userId,
    userName: row.userName || "Unknown User",
    userRole,
    action,
    entityType,
    entityId: row.resourceId || undefined,
    entityName,
    description: buildDescription(action, entityType, details),
    details,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    status: row.action.includes("failed") ? "failure" : "success",
  };
}

// ============================================================
// Helper Functions
// ============================================================
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
  // Load real audit logs from Convex. Admins see all logs; regular users see
  // their own. Rows arrive enriched with the actor's name and role.
  const rawRows = useQuery(api.admin.listAuditLogsForViewer, { limit: 200 });
  const clearMyAuditLogs = useMutation(api.admin.clearMyAuditLogs);
  const [localEntries, setLocalEntries] = useState<AuditLogEntry[]>([]);

  // Map DB rows once — reactive updates flow straight through useQuery.
  const logs = useMemo<AuditLogEntry[]>(() => {
    const mapped = (rawRows ?? []).map(mapRow);
    return [...mapped, ...localEntries];
  }, [rawRows, localEntries]);

  const isLoading = rawRows === undefined;

  // Add new log entry (client-side only; server-side audit logging is done by
  // Convex mutations via createAuditLog).
  const addLog = useCallback(
    (newLog: Omit<AuditLogEntry, "id" | "timestamp" | "ipAddress" | "userAgent">) => {
      const entry: AuditLogEntry = {
        ...newLog,
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp: new Date(),
        ipAddress: undefined,
        userAgent: navigator.userAgent,
      };
      setLocalEntries((prev) => [entry, ...prev].slice(0, 500));
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

  // Clear logs — deletes the current user's own entries from the DB.
  // (Admins' Clear button is intentionally scoped to their own actions to
  // avoid wiping the platform-wide audit trail with one click.)
  const clearLogs = useCallback(() => {
    setLocalEntries([]);
    void clearMyAuditLogs({ all: false }).catch(() => {
      // Query stays reactive; on failure the logs simply remain visible.
    });
  }, [clearMyAuditLogs]);

  // Export logs — uses the real PDF/Excel export utilities.
  const exportLogs = useCallback(
    (format: "pdf" | "excel") => {
      const data = logs.map((log) => ({
        ...log,
        timestamp: log.timestamp.toISOString(),
      }));
      exportAnalyticsData(data, "Audit Logs", format);
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
