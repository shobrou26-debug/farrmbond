import { useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { exportAnalyticsData } from "@/lib/exports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellRing,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  X,
  Clock,
  Settings,
  History,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Leaf,
  Trash2,
  Download,
  Info,
  Calendar,
  Lightbulb,
} from "lucide-react";
import {
  useWeatherAlerts,
  ExtendedWeatherAlert,
  AlertType,
  alertTypeConfig,
} from "@/hooks/use-weather-alerts";
import { useMotion } from "@/hooks/use-motion";

// ============================================================
// Accessible Toggle Switch Component
// ============================================================
function ToggleSwitch({
  checked,
  onToggle,
  label,
  id,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

// ============================================================
// Animation Variants
// ============================================================
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const alertVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } },
};

// Reduced-motion variants (instant transitions)
const reducedContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const reducedItemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const reducedAlertVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================
// Main Component
// ============================================================
export default function WeatherAlerts() {
  const prefersReducedMotion = useMotion();
  const {
    alerts,
    alertHistory,
    config,
    stats,
    isLoading,
    error,
    lastCheck,
    nextCheck,
    updateConfig,
    acknowledgeAlert,
    dismissAlert,
    clearHistory,
    checkNow,
    getAlertsByCategory,
  } = useWeatherAlerts();

  const [activeTab, setActiveTab] = useState<"active" | "history" | "settings">("active");
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<"all" | "severe" | "advisory" | "opportunity">("all");
  const [dismissedError, setDismissedError] = useState(false);

  // Pick appropriate animation variants based on reduced motion preference
  const cv = prefersReducedMotion ? reducedContainerVariants : containerVariants;
  const iv = prefersReducedMotion ? reducedItemVariants : itemVariants;
  const av = prefersReducedMotion ? reducedAlertVariants : alertVariants;

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    if (filterCategory === "all") return alerts;
    return alerts.filter((a) => a.category === filterCategory);
  }, [alerts, filterCategory]);

  // Stats
  const criticalAlerts = alerts.filter((a) => a.severity === "critical");
  const highAlerts = alerts.filter((a) => a.severity === "high");
  const mediumAlerts = alerts.filter((a) => a.severity === "medium");
  const lowAlerts = alerts.filter((a) => a.severity === "low");

  // Export the actual loaded alert history (no fabricated data)
  const handleExport = useCallback(() => {
    if (alertHistory.length === 0) {
      toast.error("No alert history to export yet");
      return;
    }
    const rows = alertHistory.map((h) => ({
      Type: h.alert.type,
      Severity: h.alert.severity,
      Title: h.alert.title,
      Message: h.alert.message,
      Triggered: h.triggeredAt.toLocaleString(),
      Expires: h.alert.expiresAt.toLocaleString(),
      Status: h.alert.acknowledged ? "Acknowledged" : "Active",
    }));
    try {
      exportAnalyticsData(rows, "Weather Alerts", "excel");
      toast.success("Alert history exported");
    } catch {
      toast.error("Failed to export alert history");
    }
  }, [alertHistory]);

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Format time until
  const formatTimeUntil = (date: Date) => {
    const now = new Date();
    const diff = date.getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 0) return "Expired";
    if (minutes < 60) return `In ${minutes}m`;
    if (hours < 24) return `In ${hours}h`;
    return `In ${Math.floor(hours / 24)}d`;
  };

  // Alert Card Component
  const AlertCard = ({ alert, isHistory = false }: { alert: ExtendedWeatherAlert; isHistory?: boolean }) => {
    const isExpanded = expandedAlert === alert.id;
    const alertConfig = alertTypeConfig[alert.type as AlertType] || alertTypeConfig.heavy_rain;

    return (
      <motion.div
        variants={av}
        initial="hidden"
        animate="visible"
        exit="exit"
        className={`rounded-2xl border ${alertConfig.borderColor} ${alertConfig.bgColor} overflow-hidden ${
          alert.severity === "critical" ? "ring-2 ring-red-500/30" : ""
        }`}
      >
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className={`text-2xl ${alertConfig.color}`}>{alertConfig.icon}</div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-foreground">{alert.title}</h3>
                {alert.severity === "critical" && (
                  <Badge className="bg-red-500 text-white text-xs">CRITICAL</Badge>
                )}
                {alert.severity === "high" && (
                  <Badge className="bg-orange-500 text-white text-xs">HIGH</Badge>
                )}
                {alert.acknowledged && (
                  <Badge className="bg-green-100 text-green-700 text-xs">Acknowledged</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>

              {/* Meta info */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatTimeAgo(alert.timestamp)}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Expires {formatTimeUntil(alert.expiresAt)}
                </span>
                <span className="flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  {alert.source}
                </span>
              </div>
            </div>

            {/* Actions — 44px touch targets */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                className="flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl hover:bg-background/50 transition-colors"
                aria-label={isExpanded ? "Collapse details" : "Expand details"}
                aria-expanded={isExpanded}
              >
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </button>
              {!isHistory && !alert.acknowledged && (
                <button
                  onClick={() => acknowledgeAlert(alert.id)}
                  className="flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl hover:bg-green-100 transition-colors"
                  aria-label="Acknowledge alert"
                >
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                </button>
              )}
              {!isHistory && (
                <button
                  onClick={() => dismissAlert(alert.id)}
                  className="flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl hover:bg-red-100 transition-colors"
                  aria-label="Dismiss alert"
                >
                  <X className="w-5 h-5 text-red-500" />
                </button>
              )}
            </div>
          </div>

          {/* Expanded Content */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-current/10">
                  {/* Recommendations */}
                  {alert.recommendations.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        Recommendations
                      </h4>
                      <ul className="space-y-1" role="list">
                        {alert.recommendations.map((rec, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" aria-hidden="true" />
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Affected Crops */}
                  {alert.affectedCrops && alert.affectedCrops.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Leaf className="w-4 h-4 text-green-600" />
                        Affected Crops
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {alert.affectedCrops.map((crop) => (
                          <Badge key={crop} variant="secondary" className="text-xs">
                            {crop}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Estimated Impact */}
                  {alert.estimatedImpact && (
                    <div className="p-3 rounded-xl bg-background/50">
                      <h4 className="text-sm font-medium mb-1 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Estimated Impact
                      </h4>
                      <p className="text-sm text-muted-foreground">{alert.estimatedImpact}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  };

  // Settings Panel
  const SettingsPanel = () => (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Alert Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable Weather Alerts</p>
            <p className="text-sm text-muted-foreground">Receive proactive notifications for severe weather</p>
          </div>
          <ToggleSwitch
            id="toggle-alerts"
            checked={config.enabled}
            onToggle={() => updateConfig({ enabled: !config.enabled })}
            label="Enable weather alerts"
          />
        </div>

        {/* Push Notifications */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Push Notifications</p>
            <p className="text-sm text-muted-foreground">Get browser notifications for critical alerts</p>
          </div>
          <ToggleSwitch
            id="toggle-push"
            checked={config.pushNotifications}
            onToggle={() => updateConfig({ pushNotifications: !config.pushNotifications })}
            label="Enable push notifications"
          />
        </div>

        {/* Check Interval */}
        <div>
          <p className="font-medium mb-2">Check Interval</p>
          <p className="text-sm text-muted-foreground mb-3">How often to check for new alerts</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Check interval">
            {[15, 30, 60, 120].map((interval) => (
              <button
                key={interval}
                role="radio"
                aria-checked={config.checkInterval === interval}
                onClick={() => updateConfig({ checkInterval: interval })}
                className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {interval < 60 ? `${interval}m` : `${interval / 60}h`}
              </button>
            ))}
          </div>
        </div>

        {/* Severity Threshold */}
        <div>
          <p className="font-medium mb-2">Alert Severity Threshold</p>
          <p className="text-sm text-muted-foreground mb-3">Minimum severity level to receive alerts</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Severity threshold">
            {(["low", "medium", "high"] as const).map((level) => (
              <button
                key={level}
                role="radio"
                aria-checked={config.severityThreshold === level}
                onClick={() => updateConfig({ severityThreshold: level })}
                className="min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {level.charAt(0).toUpperCase() + level.slice(1)}+
              </button>
            ))}
          </div>
        </div>

        {/* Alert Types */}
        <div>
          <p className="font-medium mb-2">Alert Types</p>
          <p className="text-sm text-muted-foreground mb-3">Select which alerts you want to receive</p>
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(alertTypeConfig) as AlertType[]).map((type) => {
              const typeConfig = alertTypeConfig[type];
              const isEnabled = config.types.includes(type);
              return (
                <button
                  key={type}
                  role="checkbox"
                  aria-checked={isEnabled}
                  onClick={() => {
                    const newTypes = isEnabled
                      ? config.types.filter((t) => t !== type)
                      : [...config.types, type];
                    updateConfig({ types: newTypes });
                  }}
                  className={`flex items-center gap-2 p-3 min-h-[44px] rounded-xl border text-left text-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    isEnabled
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <span className="text-lg" aria-hidden="true">{typeConfig.icon}</span>
                  <span className={isEnabled ? "font-medium" : "text-muted-foreground"}>
                    {typeConfig.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Brand-deep header — matching Weather / Finances design language */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-600 via-orange-600 to-red-600 p-6 md:p-8 text-white">
            {/* Decorative background shapes */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/20" />
              <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-white/10" />
              <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-white/5" />
            </div>
            
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/20 backdrop-blur-sm">
                    <Bell className="w-6 h-6" />
                  </div>
                  Weather Alerts
                </h1>
                <p className="text-white/80 mt-1">
                  Proactive notifications for severe weather conditions
                </p>
                <div className="flex items-center gap-4 mt-3 text-sm text-white/70">
                  <span className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    {alerts.length} active alert{alerts.length !== 1 ? "s" : ""}
                  </span>
                  {lastCheck && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Last check: {formatTimeAgo(lastCheck)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    checkNow()
                      .then(() => toast.success("Weather alerts updated"))
                      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to check weather alerts"));
                  }}
                  disabled={isLoading}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20 min-h-[44px]"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                  Check Now
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setActiveTab("settings")}
                  className="bg-white/20 hover:bg-white/30 text-white border-white/20 min-h-[44px]"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error banner */}
        {error && !dismissedError && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 p-3 rounded-xl border border-red-500/30 bg-red-500/5 flex items-center gap-2 text-sm text-red-600"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => setDismissedError(true)}
              className="ml-auto flex items-center justify-center w-11 h-11 min-h-[44px] min-w-[44px] rounded-xl hover:bg-red-500/10 transition-colors"
              aria-label="Dismiss error"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* Stats */}
        <motion.div
          variants={cv}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6"
        >
          <motion.div variants={iv}>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-red-500/10">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Critical</p>
                    <p className="text-2xl font-bold text-red-500">{criticalAlerts.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={iv}>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-orange-500/10">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">High</p>
                    <p className="text-2xl font-bold text-orange-500">{highAlerts.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={iv}>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-amber-500/10">
                    <Info className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Medium</p>
                    <p className="text-2xl font-bold text-amber-500">{mediumAlerts.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={iv}>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10">
                    <Leaf className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Opportunities</p>
                    <p className="text-2xl font-bold text-blue-500">
                      {alerts.filter((a) => a.category === "opportunity").length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={iv}>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-green-500/10">
                    <Clock className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Check</p>
                    <p className="text-lg font-bold">
                      {lastCheck ? formatTimeAgo(lastCheck) : "Never"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: prefersReducedMotion ? 0 : 0.2 }}
          className="mb-6"
        >
          <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit" role="tablist" aria-label="Weather alerts tabs">
            {[
              { id: "active" as const, label: "Active Alerts", icon: BellRing },
              { id: "history" as const, label: "History", icon: History },
              { id: "settings" as const, label: "Settings", icon: Settings },
            ].map((tab) => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`tabpanel-${tab.id}`}
                id={`tab-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  activeTab === tab.id
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" aria-hidden="true" />
                {tab.label}
                {tab.id === "active" && alerts.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs" aria-label={`${alerts.length} alerts`}>
                    {alerts.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Active Alerts Tab */}
        {activeTab === "active" && (
          <div id="tabpanel-active" role="tabpanel" aria-labelledby="tab-active">
            {/* Category Filters */}
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: prefersReducedMotion ? 0 : 0.25 }}
              className="mb-6"
            >
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filter alerts by category">
                {[
                  { id: "all" as const, label: "All Alerts", count: alerts.length },
                  { id: "severe" as const, label: "Severe", count: alerts.filter((a) => a.category === "severe").length, color: "bg-red-500" },
                  { id: "advisory" as const, label: "Advisory", count: alerts.filter((a) => a.category === "advisory").length, color: "bg-amber-500" },
                  { id: "opportunity" as const, label: "Opportunities", count: alerts.filter((a) => a.category === "opportunity").length, color: "bg-green-500" },
                ].map((filter) => (
                  <button
                    key={filter.id}
                    role="radio"
                    aria-checked={filterCategory === filter.id}
                    onClick={() => setFilterCategory(filter.id)}
                    className="flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {filter.color && (
                      <div className={`w-2 h-2 rounded-full ${filter.color}`} aria-hidden="true" />
                    )}
                    {filter.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full`}>
                      {filter.count}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Alerts List */}
            <motion.div
              variants={cv}
              initial="hidden"
              animate="visible"
              className="space-y-4"
            >
              <AnimatePresence mode="popLayout">
                {filteredAlerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </AnimatePresence>

              {filteredAlerts.length === 0 && (
                <div className="text-center py-12" role="status">
                  <CheckCircle2 className="w-16 h-16 mx-auto text-green-500/30 mb-4" aria-hidden="true" />
                  <h3 className="text-lg font-medium">No Active Alerts</h3>
                  <p className="text-muted-foreground mt-1">
                    {filterCategory === "all"
                      ? "All clear! No weather alerts at this time."
                      : `No ${filterCategory} alerts at this time.`}
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <div id="tabpanel-history" role="tabpanel" aria-labelledby="tab-history">
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Alert History</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExport} className="min-h-[44px]">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm("Clear your entire weather alert history? This cannot be undone.")) return;
                      clearHistory();
                      toast.success("Alert history cleared");
                    }}
                    className="min-h-[44px]"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear History
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {alertHistory.slice(0, 50).map((item) => (
                  <AlertCard key={item.id} alert={item.alert} isHistory />
                ))}

                {alertHistory.length === 0 && (
                  <div className="text-center py-12" role="status">
                    <History className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-medium">No Alert History</h3>
                    <p className="text-muted-foreground mt-1">
                      Alerts will appear here once they are triggered
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div id="tabpanel-settings" role="tabpanel" aria-labelledby="tab-settings">
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <SettingsPanel />
            </motion.div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
