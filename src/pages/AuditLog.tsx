import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ExportDropdown } from "@/components/ExportDropdown";
import { exportAnalyticsData } from "@/lib/exports";
import {
  useAuditLog,
  AuditLogEntry,
  AuditAction,
  AuditEntityType,
  getActionLabel,
  getEntityLabel,
  getStatusColor,
  getActionColor,
} from "@/hooks/use-audit-log";
import {
  History,
  Search,
  Filter,
  Download,
  Trash2,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  Settings,
  LogIn,
  LogOut,
  Plus,
  Edit,
  Trash,
  Share,
  Upload,
  Bell,
  DollarSign,
  Shield,
} from "lucide-react";

// ============================================================
// Animation Variants
// ============================================================
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ============================================================
// Action Icons
// ============================================================
const actionIcons: Record<AuditAction, React.ComponentType<{ className?: string }>> = {
  create: Plus,
  update: Edit,
  delete: Trash,
  view: Eye,
  login: LogIn,
  logout: LogOut,
  export: Download,
  import: Upload,
  share: Share,
  download: Download,
  upload: Upload,
  search: Search,
  filter: Filter,
  settings_change: Settings,
  notification_sent: Bell,
  notification_read: Bell,
  alert_triggered: AlertTriangle,
  alert_acknowledged: CheckCircle2,
  alert_dismissed: XCircle,
  payment: DollarSign,
  subscription: Shield,
  role_change: Shield,
  permission_change: Shield,
};

// ============================================================
// Main Component
// ============================================================
export default function AuditLog() {
  const {
    logs,
    stats,
    getLogs,
    clearLogs,
  } = useAuditLog();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterAction, setFilterAction] = useState<AuditAction | "all">("all");
  const [filterEntity, setFilterEntity] = useState<AuditEntityType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "success" | "failure" | "pending">("all");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<"activity" | "users" | "entities">("activity");

  // Exports are a Pro feature — data flows through the gated backend action.
  const getExportData = useAction(api.exports.getExportData);

  const handleProExport = async (format: "pdf" | "excel") => {
    try {
      const bundle = await getExportData({ resource: "audit_log" });
      exportAnalyticsData(bundle.rows, "Audit Logs", format);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Exports require FarmBond Pro");
    }
  };

  // Filter logs
  const filteredLogs = useMemo(() => {
    return getLogs({
      searchQuery: searchQuery || undefined,
      action: filterAction === "all" ? undefined : filterAction,
      entityType: filterEntity === "all" ? undefined : filterEntity,
      status: filterStatus === "all" ? undefined : filterStatus,
    });
  }, [searchQuery, filterAction, filterEntity, filterStatus, getLogs]);

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups: Record<string, AuditLogEntry[]> = {};
    filteredLogs.forEach((log) => {
      const dateKey = log.timestamp.toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });
    return groups;
  }, [filteredLogs]);

  // Format date
  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Log Entry Card
  const LogEntryCard = ({ log }: { log: AuditLogEntry }) => {
    const isExpanded = expandedLog === log.id;
    const ActionIcon = actionIcons[log.action] || Activity;
    const actionColor = getActionColor(log.action);
    const statusColor = getStatusColor(log.status);

    return (
      <motion.div
        variants={itemVariants}
        className="border border-border/50 rounded-xl hover:shadow-md transition-all"
      >
        <div
          className="p-4 cursor-pointer"
          onClick={() => setExpandedLog(isExpanded ? null : log.id)}
        >
          <div className="flex items-start gap-3">
            {/* Action Icon */}
            <div className={`p-2 rounded-lg ${actionColor}`}>
              <ActionIcon className="w-5 h-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-foreground">{log.userName}</span>
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {log.userRole.replace("_", " ")}
                </Badge>
                <Badge className={`text-[10px] ${statusColor}`}>
                  {log.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{log.description}</p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTime(log.timestamp)}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  {getEntityLabel(log.entityType)}
                </span>
                {log.entityName && (
                  <span className="flex items-center gap-1">
                    <span className="text-muted-foreground/50">•</span>
                    {log.entityName}
                  </span>
                )}
              </div>
            </div>

            {/* Expand Button */}
            <button className="p-1 rounded-lg hover:bg-muted transition-colors">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 pt-2 border-t border-border/50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Action</p>
                    <p className="font-medium">{getActionLabel(log.action)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Entity Type</p>
                    <p className="font-medium">{getEntityLabel(log.entityType)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Entity ID</p>
                    <p className="font-medium font-mono text-xs">{log.entityId || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs mb-1">Timestamp</p>
                    <p className="font-medium">{log.timestamp.toLocaleString()}</p>
                  </div>
                </div>

                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Additional Details</p>
                    <pre className="text-xs font-mono text-foreground overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </div>
                )}

                {log.ipAddress && (
                  <div className="mt-3 text-xs text-muted-foreground">
                    IP: {log.ipAddress} • Browser: {log.userAgent?.split(")")[0]}...)
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                  <History className="w-6 h-6" />
                </div>
                Audit Log
              </h1>
              <p className="text-muted-foreground mt-1">
                Track all user actions and system changes across the platform
              </p>
            </div>
            <div className="flex gap-2">
              <ExportDropdown
                onExportPDF={() => handleProExport("pdf")}
                onExportExcel={() => handleProExport("excel")}
                label="Export Logs"
              />
              <Button variant="outline" onClick={clearLogs}>
                <Trash2 className="w-4 h-4 mr-2" />
                Clear
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        >
          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-500/10">
                    <Activity className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Actions</p>
                    <p className="text-2xl font-bold">{stats.totalActions}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Today</p>
                    <p className="text-2xl font-bold">{stats.actionsToday}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Calendar className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">This Week</p>
                    <p className="text-2xl font-bold">{stats.actionsThisWeek}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <User className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Users</p>
                    <p className="text-2xl font-bold">{stats.topUsers.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-6"
        >
          <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
            {[
              { id: "activity" as const, label: "Activity Log", icon: History },
              { id: "users" as const, label: "By User", icon: User },
              { id: "entities" as const, label: "By Entity", icon: FileText },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </motion.div>

        {activeTab === "activity" && (
          <>
            {/* Search and Filters */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mb-6"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs by user, action, or entity..."
                    className="pl-10"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <Filter className="w-4 h-4 mr-2" />
                  Filters
                  {(filterAction !== "all" || filterEntity !== "all" || filterStatus !== "all") && (
                    <Badge className="ml-2 px-1.5 py-0.5 text-[10px]">
                      {(filterAction !== "all" ? 1 : 0) +
                        (filterEntity !== "all" ? 1 : 0) +
                        (filterStatus !== "all" ? 1 : 0)}
                    </Badge>
                  )}
                </Button>
              </div>

              {/* Filter Options */}
              <AnimatePresence>
                {showFilters && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-4 p-4 rounded-xl bg-muted/30 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Action</label>
                        <select
                          value={filterAction}
                          onChange={(e) => setFilterAction(e.target.value as AuditAction | "all")}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                        >
                          <option value="all">All Actions</option>
                          <option value="create">Create</option>
                          <option value="update">Update</option>
                          <option value="delete">Delete</option>
                          <option value="view">View</option>
                          <option value="login">Login</option>
                          <option value="export">Export</option>
                          <option value="payment">Payment</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Entity Type</label>
                        <select
                          value={filterEntity}
                          onChange={(e) => setFilterEntity(e.target.value as AuditEntityType | "all")}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                        >
                          <option value="all">All Entities</option>
                          <option value="farm">Farm</option>
                          <option value="crop">Crop</option>
                          <option value="livestock">Livestock</option>
                          <option value="transaction">Transaction</option>
                          <option value="user">User</option>
                          <option value="settings">Settings</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Status</label>
                        <select
                          value={filterStatus}
                          onChange={(e) => setFilterStatus(e.target.value as "all" | "success" | "failure" | "pending")}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                        >
                          <option value="all">All Status</option>
                          <option value="success">Success</option>
                          <option value="failure">Failure</option>
                          <option value="pending">Pending</option>
                        </select>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Results Count */}
            <div className="mb-4 text-sm text-muted-foreground">
              Showing {filteredLogs.length} of {logs.length} log entries
            </div>

            {/* Logs List */}
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              {Object.entries(groupedLogs).map(([dateKey, dateLogs]) => (
                <div key={dateKey}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background/80 backdrop-blur-sm py-2 z-10">
                    {formatDate(new Date(dateKey))}
                  </h3>
                  <div className="space-y-3">
                    {dateLogs.map((log) => (
                      <LogEntryCard key={log.id} log={log} />
                    ))}
                  </div>
                </div>
              ))}

              {filteredLogs.length === 0 && (
                <div className="text-center py-12">
                  <History className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-medium">No log entries found</h3>
                  <p className="text-muted-foreground mt-1">
                    {searchQuery || filterAction !== "all" || filterEntity !== "all" || filterStatus !== "all"
                      ? "Try adjusting your filters"
                      : "Actions will appear here as users interact with the platform"}
                  </p>
                </div>
              )}
            </motion.div>
          </>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold">Activity by User</h2>
            {stats.topUsers.map((user) => (
              <Card key={user.userId} className="border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{user.userName}</p>
                        <p className="text-sm text-muted-foreground">
                          {user.count} actions recorded
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${(user.count / stats.totalActions) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {((user.count / stats.totalActions) * 100).toFixed(1)}% of total
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}

        {/* Entities Tab */}
        {activeTab === "entities" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold">Activity by Entity Type</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(stats.actionsByEntity)
                .sort(([, a], [, b]) => b - a)
                .map(([entity, count]) => (
                  <Card key={entity} className="border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{getEntityLabel(entity as AuditEntityType)}</p>
                          <p className="text-sm text-muted-foreground">
                            {count} actions
                          </p>
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
