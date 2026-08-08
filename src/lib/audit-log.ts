// ============================================================
// Audit Log — shared pure types + DB row mapping
// Framework-free so it can be unit tested directly.
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
export function mapAction(action: string): AuditAction {
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
export function mapEntity(resource: string): AuditEntityType {
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
export function buildDescription(
  action: AuditAction,
  entityType: AuditEntityType,
  details?: Record<string, unknown>
): string {
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

/** Convert an enriched Convex auditLogs row into the AuditLogEntry shape. */
export function mapRow(row: {
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
// Label + Color Helpers
// ============================================================
export function getActionLabel(action: AuditAction): string {
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

export function getEntityLabel(entityType: AuditEntityType): string {
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

export function getStatusColor(status: string): string {
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

export function getActionColor(action: AuditAction): string {
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
