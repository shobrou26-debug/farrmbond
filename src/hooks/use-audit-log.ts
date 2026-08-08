import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { exportAnalyticsData } from "@/lib/exports";
import {
  AuditAction,
  AuditEntityType,
  AuditLogEntry,
  AuditLogFilters,
  AuditLogStats,
  mapRow,
  getActionLabel,
  getEntityLabel,
  getStatusColor,
  getActionColor,
} from "@/lib/audit-log";

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

// Re-export helpers for components (kept for backwards compatibility)
export { getActionLabel, getEntityLabel, getStatusColor, getActionColor };
export type {
  AuditAction,
  AuditEntityType,
  AuditLogEntry,
  AuditLogFilters,
  AuditLogStats,
};
