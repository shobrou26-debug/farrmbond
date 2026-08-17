import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWeather } from "@/hooks/use-weather";
import { useIrrigation } from "@/hooks/use-irrigation";
import { useHaptic } from "@/hooks/use-mobile";
import {
  Droplets,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Sun,
  Cloud,
  CloudRain,
  Wind,
  Leaf,
  Power,
  PowerOff,
  TrendingDown,
  Activity,
  Bell,
  Trash2,
  Edit,
  Inbox,
  Loader2,
  History,
  Sprout,
  CalendarDays,
  MapPin,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface ScheduleDoc {
  _id: Id<"irrigationSchedules">;
  farmId: Id<"farms">;
  userId: string;
  cropId?: string;
  name: string;
  frequency: string;
  customDays?: number[];
  startTime: string;
  duration: number;
  waterAmount: number;
  waterSource?: string;
  zone?: string;
  soilMoistureTarget?: number;
  weatherDependent?: boolean;
  isActive: boolean;
  lastRunAt?: number;
  nextRunAt: number;
  createdAt: number;
  updatedAt: number;
}

interface DerivedAlert {
  id: string;
  type: string;
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  timestamp: number;
}

// ============================================================
// Helpers
// ============================================================

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "Daily",
  alternate_days: "Alternate days",
  weekly: "Weekly",
  custom: "Custom",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatDate = (ts?: number) =>
  ts ? new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Never";

const formatDateTime = (ts: number) =>
  new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ============================================================
// Animation (respects prefers-reduced-motion)
// ============================================================

function useEntranceVariants() {
  const shouldReduceMotion = useReducedMotion();
  const duration = shouldReduceMotion ? 0 : 0.35;
  const stagger = shouldReduceMotion ? 0 : 0.05;
  return {
    container: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { staggerChildren: stagger } },
    },
    item: {
      hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 14 },
      visible: { opacity: 1, y: 0, transition: { duration } },
    },
  };
}

// ============================================================
// Water Usage Stats (computed from real irrigation history)
// ============================================================

interface HistoryRow {
  _id: string;
  date: number;
  duration: number;
  waterAmount: number;
  method?: string;
  status: string;
  scheduleName?: string;
}

function WaterUsageStats({
  history,
  soilMoisture,
  soilSource,
}: {
  history: HistoryRow[];
  soilMoisture: number | null;
  soilSource: string | null;
}) {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const today = history.filter((r) => r.date >= todayStart.getTime()).reduce((s, r) => s + r.waterAmount, 0);
  const week = history.filter((r) => r.date >= now - 7 * day).reduce((s, r) => s + r.waterAmount, 0);
  const month = history.filter((r) => r.date >= now - 30 * day).reduce((s, r) => s + r.waterAmount, 0);

  const stats = [
    {
      label: "Today's Usage",
      value: `${(today / 1000).toFixed(1)} kL`,
      sub: `${history.filter((r) => r.date >= todayStart.getTime()).length} run${history.filter((r) => r.date >= todayStart.getTime()).length === 1 ? "" : "s"}`,
      icon: Droplets,
      chip: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      label: "Weekly Usage",
      value: `${(week / 1000).toFixed(1)} kL`,
      sub: `${history.filter((r) => r.date >= now - 7 * day).length} run${history.filter((r) => r.date >= now - 7 * day).length === 1 ? "" : "s"}`,
      icon: Activity,
      chip: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400",
    },
    {
      label: "Monthly Usage",
      value: `${(month / 1000).toFixed(1)} kL`,
      sub: `${history.filter((r) => r.date >= now - 30 * day).length} run${history.filter((r) => r.date >= now - 30 * day).length === 1 ? "" : "s"}`,
      icon: TrendingDown,
      chip: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    },
    {
      label: "Soil Moisture",
      value: soilMoisture === null ? "—" : `${Math.round(soilMoisture)}%`,
      sub:
        soilMoisture === null
          ? "Select a farm to view"
          : soilSource === "estimated"
          ? "Estimated"
          : "Lab / field test",
      icon: Leaf,
      chip:
        soilMoisture !== null && soilMoisture < 40
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "bg-brand/10 text-brand-foreground dark:text-brand",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4 lg:gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground sm:text-sm">{stat.label}</p>
                  <p className="mt-1.5 truncate text-2xl font-bold tracking-tight">{stat.value}</p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground sm:text-xs">{stat.sub}</p>
                </div>
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${stat.chip}`}>
                  <Icon className="h-5 w-5 sm:h-5.5 sm:w-5.5" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Smart Recommendations (real weather + soil data)
// ============================================================

function SmartRecommendations({
  weather,
  soilMoisture,
}: {
  weather: ReturnType<typeof useWeather>["data"];
  soilMoisture: number | null;
}) {
  const recommendations = useMemo(() => {
    const recs: Array<{
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
      icon: typeof Droplets;
      badge: string;
      dot: string;
    }> = [];

    if (weather?.daily.some((d) => d.precipitationSum > 10)) {
      recs.push({
        title: "Skip Tomorrow's Irrigation",
        description: "Significant rain expected. Watering now may waste resources and cause waterlogging.",
        priority: "high",
        icon: CloudRain,
        badge: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        dot: "bg-sky-500",
      });
    }

    if (soilMoisture !== null) {
      if (soilMoisture < 30) {
        recs.push({
          title: "Increase Irrigation Frequency",
          description: `Soil moisture is ${Math.round(soilMoisture)}% — critically low. Consider irrigating sooner.`,
          priority: "high",
          icon: Droplets,
          badge: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
          dot: "bg-amber-500",
        });
      } else if (soilMoisture < 40) {
        recs.push({
          title: "Irrigate Soon",
          description: `Soil moisture is ${Math.round(soilMoisture)}% — below the optimal 50-70% band.`,
          priority: "medium",
          icon: Droplets,
          badge: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
          dot: "bg-amber-500",
        });
      } else if (soilMoisture > 75) {
        recs.push({
          title: "Delay Irrigation",
          description: `Soil moisture is ${Math.round(soilMoisture)}% — high waterlogging risk. Hold off watering.`,
          priority: "medium",
          icon: CloudRain,
          badge: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
          dot: "bg-sky-500",
        });
      } else {
        recs.push({
          title: "Conditions Optimal",
          description: "Soil moisture is within the healthy 50-70% band. Continue your current schedule.",
          priority: "low",
          icon: CheckCircle2,
          badge: "border-green-500/25 bg-green-500/10 text-green-700 dark:text-green-300",
          dot: "bg-green-500",
        });
      }
    }

    if (weather?.current.uvIndex && weather.current.uvIndex > 7) {
      recs.push({
        title: "Water Early Morning",
        description: "High UV index expected. Water before 6 AM to minimize evaporation losses.",
        priority: "medium",
        icon: Sun,
        badge: "border-orange-500/25 bg-orange-500/10 text-orange-700 dark:text-orange-300",
        dot: "bg-orange-500",
      });
    }

    if (weather?.current.windSpeed && weather.current.windSpeed > 20) {
      recs.push({
        title: "Reduce Spray Irrigation",
        description: "Strong winds detected. Prefer drip irrigation to prevent water drift.",
        priority: "medium",
        icon: Wind,
        badge: "border-purple-500/25 bg-purple-500/10 text-purple-700 dark:text-purple-300",
        dot: "bg-purple-500",
      });
    }

    return recs;
  }, [weather, soilMoisture]);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
            <Leaf className="h-4 w-4" />
          </span>
          <div>
            <CardTitle className="text-base">Recommendations</CardTitle>
            <p className="text-xs text-muted-foreground">From real weather & soil data</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-8 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-green-500" />
            <p className="text-sm text-muted-foreground">
              {soilMoisture === null
                ? "Select a farm to see soil-based recommendations"
                : "No current irrigation recommendations"}
            </p>
          </div>
        ) : (
          recommendations.map((rec) => {
            const Icon = rec.icon;
            return (
              <div key={rec.title} className={`rounded-xl border p-3.5 ${rec.badge}`}>
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold">{rec.title}</h4>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${rec.dot}`} aria-hidden />
                    </div>
                    <p className="mt-0.5 text-xs opacity-80">{rec.description}</p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Derived Irrigation Alerts
// ============================================================

function IrrigationAlerts({ alerts }: { alerts: DerivedAlert[] }) {
  if (alerts.length === 0) return null;

  return (
    <Card className="border-amber-500/25 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Bell className="h-4 w-4 text-amber-500" aria-hidden />
            Active Alerts
          </CardTitle>
          <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300">
            {alerts.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={`rounded-xl border-l-4 p-3 ${
              alert.severity === "high"
                ? "border-l-red-500 bg-red-500/5"
                : alert.severity === "medium"
                ? "border-l-amber-500 bg-amber-500/5"
                : "border-l-blue-500 bg-blue-500/5"
            }`}
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <h4 className="text-sm font-semibold">{alert.title}</h4>
                <p className="mt-0.5 text-xs text-muted-foreground">{alert.message}</p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Schedule Modal (create + edit)
// ============================================================

interface ScheduleForm {
  name: string;
  farmId: string;
  zone: string;
  frequency: string;
  customDays: number[];
  startTime: string;
  duration: string;
  waterAmount: string;
  waterSource: string;
  soilMoistureTarget: string;
  weatherDependent: boolean;
}

/** Normalized payload handed to create/update handlers (numeric duration/water). */
interface SchedulePayload {
  name: string;
  farmId: string;
  zone: string;
  frequency: string;
  customDays: number[];
  startTime: string;
  duration: number;
  waterAmount: number;
  waterSource: string;
  soilMoistureTarget: string;
  weatherDependent: boolean;
}

function ScheduleModal({
  isOpen,
  onClose,
  farms,
  schedule,
  defaultFarmId,
  isSubmitting,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  farms: { _id: string; name: string }[];
  schedule: ScheduleDoc | null;
  defaultFarmId: string;
  isSubmitting: boolean;
  onSubmit: (data: SchedulePayload) => Promise<void>;
}) {
  const [form, setForm] = useState<ScheduleForm>({
    name: schedule?.name ?? "",
    farmId: schedule?.farmId ?? defaultFarmId,
    zone: schedule?.zone ?? "",
    frequency: schedule?.frequency ?? "daily",
    customDays: schedule?.customDays ?? [1, 3, 5],
    startTime: schedule?.startTime ?? "06:00",
    duration: schedule ? String(schedule.duration) : "30",
    waterAmount: schedule ? String(schedule.waterAmount) : "200",
    waterSource: schedule?.waterSource ?? "",
    soilMoistureTarget: schedule?.soilMoistureTarget !== undefined ? String(schedule.soilMoistureTarget) : "",
    weatherDependent: schedule?.weatherDependent ?? true,
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Sync form when switching between create/edit targets
  useEffect(() => {
    setForm({
      name: schedule?.name ?? "",
      farmId: schedule?.farmId ?? defaultFarmId,
      zone: schedule?.zone ?? "",
      frequency: schedule?.frequency ?? "daily",
      customDays: schedule?.customDays ?? [1, 3, 5],
      startTime: schedule?.startTime ?? "06:00",
      duration: schedule ? String(schedule.duration) : "30",
      waterAmount: schedule ? String(schedule.waterAmount) : "200",
      waterSource: schedule?.waterSource ?? "",
      soilMoistureTarget: schedule?.soilMoistureTarget !== undefined ? String(schedule.soilMoistureTarget) : "",
      weatherDependent: schedule?.weatherDependent ?? true,
    });
    setFormError(null);
  }, [schedule, defaultFarmId, isOpen]);

  const toggleDay = (day: number) => {
    setForm((f) => ({
      ...f,
      customDays: f.customDays.includes(day)
        ? f.customDays.filter((d) => d !== day)
        : [...f.customDays, day].sort(),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.name.trim()) return setFormError("Please enter a schedule name.");
    if (!form.farmId) return setFormError("Please select a farm.");
    const duration = Number(form.duration);
    const waterAmount = Number(form.waterAmount);
    if (!duration || duration < 1 || duration > 600) return setFormError("Duration must be between 1 and 600 minutes.");
    if (!waterAmount || waterAmount < 1 || waterAmount > 100000) return setFormError("Water amount must be between 1 and 100,000 liters.");
    if (form.frequency === "custom" && form.customDays.length === 0)
      return setFormError("Select at least one day for a custom schedule.");
    const target = form.soilMoistureTarget === "" ? undefined : Number(form.soilMoistureTarget);
    if (target !== undefined && (isNaN(target) || target < 0 || target > 100))
      return setFormError("Soil moisture target must be between 0 and 100.");

    try {
      await onSubmit({ ...form, duration, waterAmount, soilMoistureTarget: target === undefined ? "" : String(target) });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save schedule.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{schedule ? "Edit Irrigation Schedule" : "Add Irrigation Schedule"}</DialogTitle>
          <DialogDescription>
            {schedule ? "Update the details of this irrigation schedule." : "Create a new irrigation schedule for one of your farms."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sch-name">Schedule Name *</Label>
            <Input
              id="sch-name"
              placeholder="e.g. Vegetable Garden Drip"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sch-farm">Farm *</Label>
              <Select value={form.farmId} onValueChange={(v) => setForm((f) => ({ ...f, farmId: v }))}>
                <SelectTrigger id="sch-farm">
                  <SelectValue placeholder="Select farm" />
                </SelectTrigger>
                <SelectContent>
                  {farms.map((farm) => (
                    <SelectItem key={farm._id} value={farm._id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-zone">Zone</Label>
              <Input
                id="sch-zone"
                placeholder="e.g. Zone A - Vegetables"
                value={form.zone}
                onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sch-frequency">Frequency *</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm((f) => ({ ...f, frequency: v }))}>
                <SelectTrigger id="sch-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="alternate_days">Alternate days</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="custom">Custom days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-time">Start Time *</Label>
              <Input
                id="sch-time"
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
              />
            </div>
          </div>

          {form.frequency === "custom" && (
            <div className="space-y-2">
              <Label>Days of the week</Label>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    aria-pressed={form.customDays.includes(day)}
                    className={`h-10 w-10 rounded-lg text-xs font-medium transition-all focus-visible:ring-2 focus-visible:ring-ring/60 ${
                      form.customDays.includes(day)
                        ? "bg-brand text-brand-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sch-duration">Duration (min) *</Label>
              <Input
                id="sch-duration"
                type="number"
                min="1"
                max="600"
                value={form.duration}
                onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-water">Water (L) *</Label>
              <Input
                id="sch-water"
                type="number"
                min="1"
                value={form.waterAmount}
                onChange={(e) => setForm((f) => ({ ...f, waterAmount: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="sch-source">Method</Label>
              <Select value={form.waterSource} onValueChange={(v) => setForm((f) => ({ ...f, waterSource: v }))}>
                <SelectTrigger id="sch-source">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drip">Drip</SelectItem>
                  <SelectItem value="sprinkler">Sprinkler</SelectItem>
                  <SelectItem value="flood">Flood</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sch-target">Soil Moisture Target (%)</Label>
              <Input
                id="sch-target"
                type="number"
                min="0"
                max="100"
                placeholder="e.g. 65"
                value={form.soilMoistureTarget}
                onChange={(e) => setForm((f) => ({ ...f, soilMoistureTarget: e.target.value }))}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.weatherDependent}
              onChange={(e) => setForm((f) => ({ ...f, weatherDependent: e.target.checked }))}
              className="rounded border-input"
            />
            Pause automatically when significant rain is forecast
          </label>

          {formError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" aria-hidden /> {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              {isSubmitting ? "Saving..." : schedule ? "Save Changes" : "Create Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Record Irrigation Modal
// ============================================================

function RecordIrrigationModal({
  schedule,
  isOpen,
  onClose,
  isSubmitting,
  onSubmit,
}: {
  schedule: ScheduleDoc | null;
  isOpen: boolean;
  onClose: () => void;
  isSubmitting: boolean;
  onSubmit: (data: {
    date: number;
    duration: number;
    waterAmount: number;
    method?: string;
    status: "completed" | "skipped" | "manual";
    notes?: string;
  }) => Promise<void>;
}) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState("");
  const [waterAmount, setWaterAmount] = useState("");
  const [method, setMethod] = useState("");
  const [status, setStatus] = useState<"completed" | "manual">("completed");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (schedule) {
      setDuration(String(schedule.duration));
      setWaterAmount(String(schedule.waterAmount));
      setMethod(schedule.waterSource ?? "");
      setStatus("completed");
      setNotes("");
      setFormError(null);
    }
  }, [schedule, isOpen]);

  if (!schedule) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const dur = Number(duration);
    const water = Number(waterAmount);
    if (!dur || dur < 1 || dur > 600) return setFormError("Duration must be between 1 and 600 minutes.");
    if (!water || water < 1) return setFormError("Water amount must be greater than 0.");
    if (!date) return setFormError("Select a date.");

    try {
      await onSubmit({
        date: new Date(date + "T" + (schedule.startTime || "06:00")).getTime(),
        duration: dur,
        waterAmount: water,
        method: method || undefined,
        status,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to record irrigation.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Droplets className="h-4 w-4" />
            </span>
            Record Irrigation — {schedule.name}
          </DialogTitle>
          <DialogDescription>
            Record that this schedule was run, skipped, or completed manually.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="run-date">Date *</Label>
              <Input id="run-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-status">Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as "completed" | "manual")}>
                <SelectTrigger id="run-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="skipped">Skipped</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="run-duration">Duration (min) *</Label>
              <Input id="run-duration" type="number" min="1" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="run-water">Water (L) *</Label>
              <Input id="run-water" type="number" min="1" value={waterAmount} onChange={(e) => setWaterAmount(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="run-method">Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v)}>
              <SelectTrigger id="run-method">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="drip">Drip</SelectItem>
                <SelectItem value="sprinkler">Sprinkler</SelectItem>
                <SelectItem value="flood">Flood</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="run-notes">Notes</Label>
            <Input id="run-notes" placeholder="e.g. Split into two passes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {formError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" aria-hidden /> {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Droplets className="mr-1.5 h-4 w-4" />}
              {isSubmitting ? "Saving..." : "Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Soil Test Modal (record real lab/field soil measurements)
// ============================================================

interface SoilTestForm {
  ph: string;
  organicMatter: string;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
  soilMoisture: string;
  drainage: string;
  texture: string;
}

function SoilTestModal({
  isOpen,
  onClose,
  farmName,
  isSubmitting,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  farmName: string;
  isSubmitting: boolean;
  onSubmit: (data: {
    ph: number;
    organicMatter: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    soilMoisture: number;
    drainage: string;
    texture: string;
  }) => Promise<void>;
}) {
  const [form, setForm] = useState<SoilTestForm>({
    ph: "",
    organicMatter: "",
    nitrogen: "",
    phosphorus: "",
    potassium: "",
    soilMoisture: "",
    drainage: "well_drained",
    texture: "loamy",
  });
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setForm({
        ph: "",
        organicMatter: "",
        nitrogen: "",
        phosphorus: "",
        potassium: "",
        soilMoisture: "",
        drainage: "well_drained",
        texture: "loamy",
      });
      setFormError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const ph = Number(form.ph);
    const organicMatter = Number(form.organicMatter);
    const nitrogen = Number(form.nitrogen);
    const phosphorus = Number(form.phosphorus);
    const potassium = Number(form.potassium);
    const soilMoisture = Number(form.soilMoisture);

    if (form.ph === "" || isNaN(ph) || ph < 0 || ph > 14)
      return setFormError("Soil pH must be between 0 and 14.");
    if (form.organicMatter === "" || isNaN(organicMatter) || organicMatter < 0 || organicMatter > 50)
      return setFormError("Organic matter must be between 0 and 50%.");
    if (form.nitrogen === "" || isNaN(nitrogen) || nitrogen < 0 || nitrogen > 5)
      return setFormError("Nitrogen must be between 0 and 5%.");
    if (form.phosphorus === "" || isNaN(phosphorus) || phosphorus < 0 || phosphorus > 500)
      return setFormError("Phosphorus must be between 0 and 500 ppm.");
    if (form.potassium === "" || isNaN(potassium) || potassium < 0 || potassium > 2000)
      return setFormError("Potassium must be between 0 and 2000 ppm.");
    if (form.soilMoisture === "" || isNaN(soilMoisture) || soilMoisture < 0 || soilMoisture > 100)
      return setFormError("Soil moisture must be between 0 and 100%.");

    try {
      await onSubmit({
        ph,
        organicMatter,
        nitrogen,
        phosphorus,
        potassium,
        soilMoisture,
        drainage: form.drainage,
        texture: form.texture,
      });
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save soil data.");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand-foreground dark:text-brand">
              <Sprout className="h-4 w-4" />
            </span>
            Record Soil Test{farmName ? ` — ${farmName}` : ""}
          </DialogTitle>
          <DialogDescription>
            Enter the results of a lab or field soil test. These real measurements power soil
            analysis, fertility ratings, and irrigation recommendations.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="soil-ph">Soil pH *</Label>
              <Input
                id="soil-ph"
                type="number"
                step="0.1"
                min="0"
                max="14"
                placeholder="e.g. 6.2"
                value={form.ph}
                onChange={(e) => setForm((f) => ({ ...f, ph: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soil-om">Organic Matter (%) *</Label>
              <Input
                id="soil-om"
                type="number"
                step="0.1"
                min="0"
                max="50"
                placeholder="e.g. 3.5"
                value={form.organicMatter}
                onChange={(e) => setForm((f) => ({ ...f, organicMatter: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soil-n">Nitrogen (%) *</Label>
              <Input
                id="soil-n"
                type="number"
                step="0.01"
                min="0"
                max="5"
                placeholder="e.g. 0.15"
                value={form.nitrogen}
                onChange={(e) => setForm((f) => ({ ...f, nitrogen: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soil-p">Phosphorus (ppm) *</Label>
              <Input
                id="soil-p"
                type="number"
                min="0"
                max="500"
                placeholder="e.g. 25"
                value={form.phosphorus}
                onChange={(e) => setForm((f) => ({ ...f, phosphorus: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soil-k">Potassium (ppm) *</Label>
              <Input
                id="soil-k"
                type="number"
                min="0"
                max="2000"
                placeholder="e.g. 180"
                value={form.potassium}
                onChange={(e) => setForm((f) => ({ ...f, potassium: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soil-moist">Soil Moisture (%) *</Label>
              <Input
                id="soil-moist"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="e.g. 45"
                value={form.soilMoisture}
                onChange={(e) => setForm((f) => ({ ...f, soilMoisture: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soil-drain">Drainage *</Label>
              <Select value={form.drainage} onValueChange={(v) => setForm((f) => ({ ...f, drainage: v }))}>
                <SelectTrigger id="soil-drain">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="well_drained">Well drained</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                  <SelectItem value="excessive">Excessive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="soil-texture">Texture *</Label>
              <Select value={form.texture} onValueChange={(v) => setForm((f) => ({ ...f, texture: v }))}>
                <SelectTrigger id="soil-texture">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandy">Sandy</SelectItem>
                  <SelectItem value="loamy">Loamy</SelectItem>
                  <SelectItem value="clay">Clay</SelectItem>
                  <SelectItem value="silt">Silt</SelectItem>
                  <SelectItem value="sandy_loam">Sandy loam</SelectItem>
                  <SelectItem value="clay_loam">Clay loam</SelectItem>
                  <SelectItem value="silty_loam">Silty loam</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {formError && (
            <p className="flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" aria-hidden /> {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
            >
              {isSubmitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Sprout className="mr-1.5 h-4 w-4" />}
              {isSubmitting ? "Saving..." : "Save Soil Test"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Schedule Card
// ============================================================

function ScheduleCard({
  schedule,
  farmName,
  isBusy,
  onToggle,
  onEdit,
  onDelete,
  onRecord,
}: {
  schedule: ScheduleDoc;
  farmName: string;
  isBusy: boolean;
  onToggle: (schedule: ScheduleDoc) => void;
  onEdit: (schedule: ScheduleDoc) => void;
  onDelete: (schedule: ScheduleDoc) => void;
  onRecord: (schedule: ScheduleDoc) => void;
}) {
  const overdue = schedule.nextRunAt < Date.now() && schedule.isActive;

  return (
    <Card className={`border-border/60 transition-all hover:border-brand/40 hover:shadow-md hover:shadow-brand/5 ${!schedule.isActive ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand-foreground dark:text-brand">
                <Droplets className="h-4 w-4" />
              </span>
              <h3 className="truncate text-sm font-semibold">{schedule.name}</h3>
            </div>
            <p className="mt-1 flex items-center gap-1 truncate pl-10 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden />
              {schedule.zone || farmName}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant="secondary" className="border-border/60 text-[10px]">
              {FREQUENCY_LABELS[schedule.frequency] ?? schedule.frequency}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 touch-target"
              disabled={isBusy}
              onClick={() => onToggle(schedule)}
              aria-label={schedule.isActive ? "Disable schedule" : "Enable schedule"}
            >
              {schedule.isActive ? (
                <Power className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <PowerOff className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-border/60 bg-muted/30 px-2 py-2.5 text-center">
            <Clock className="mx-auto mb-1 h-4 w-4 text-muted-foreground" aria-hidden />
            <p className="text-xs font-medium">{schedule.startTime}</p>
            <p className="text-[10px] text-muted-foreground">{schedule.duration} min</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 px-2 py-2.5 text-center">
            <Droplets className="mx-auto mb-1 h-4 w-4 text-blue-400" aria-hidden />
            <p className="truncate text-xs font-medium">{schedule.waterAmount.toLocaleString()} L</p>
            <p className="text-[10px] text-muted-foreground">per session</p>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/30 px-2 py-2.5 text-center">
            <Leaf className="mx-auto mb-1 h-4 w-4 text-green-500" aria-hidden />
            <p className="text-xs font-medium">
              {schedule.soilMoistureTarget !== undefined ? `${schedule.soilMoistureTarget}%` : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground">target</p>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">Last: {formatDate(schedule.lastRunAt)}</span>
          </span>
          <span className={`shrink-0 font-medium ${overdue ? "text-amber-600 dark:text-amber-400" : ""}`}>
            Next: {formatDateTime(schedule.nextRunAt)}
          </span>
        </div>

        {schedule.weatherDependent && (
          <Badge variant="outline" className="mb-3 w-full justify-center text-[10px]">
            <Cloud className="mr-1 h-3 w-3" aria-hidden />
            Weather-aware
          </Badge>
        )}

        <div className="mt-1 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => onEdit(schedule)}>
            <Edit className="mr-1 h-3.5 w-3.5" aria-hidden />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="flex-1 rounded-full" onClick={() => onRecord(schedule)}>
            <Droplets className="mr-1 h-3.5 w-3.5" aria-hidden />
            Record
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 rounded-full p-0 touch-target"
            disabled={isBusy}
            onClick={() => onDelete(schedule)}
            aria-label={`Delete schedule ${schedule.name}`}
          >
            {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 text-destructive" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Irrigation Page
// ============================================================

export default function Irrigation() {
  const variants = useEntranceVariants();
  const haptic = useHaptic();
  const { data: weatherData } = useWeather();
  const [selectedFarmId, setSelectedFarmId] = useState<Id<"farms"> | undefined>(undefined);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleDoc | null>(null);
  const [recordingSchedule, setRecordingSchedule] = useState<ScheduleDoc | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState<Id<"irrigationSchedules"> | null>(null);
  const [togglingId, setTogglingId] = useState<Id<"irrigationSchedules"> | null>(null);
  const [view, setView] = useState<"schedules" | "history">("schedules");
  const [soilTestFarmId, setSoilTestFarmId] = useState<Id<"farms"> | undefined>(undefined);

  const storeSoilData = useMutation(api.soil.storeSoilData);

  const {
    schedules,
    history,
    alerts,
    soil,
    farms,
    isLoading,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    enableSchedule,
    disableSchedule,
    recordIrrigation,
  } = useIrrigation(selectedFarmId);

  const farmMap = useMemo(() => {
    const map = new Map<string, string>();
    farms.forEach((f) => map.set(f._id, f.name));
    return map;
  }, [farms]);

  const soilMoisture = useMemo(() => {
    if (!soil || typeof soil.soilMoisture !== "number") return null;
    return soil.soilMoisture;
  }, [soil]);

  const soilSource = useMemo(() => {
    if (!soil) return null;
    return (soil as { lastUpdated?: number | null }).lastUpdated ? "measured" : "estimated";
  }, [soil]);

  const alertsList = useMemo<DerivedAlert[]>(() => alerts, [alerts]);

  // ============================================================
  // Handlers
  // ============================================================

  const handleCreate = async (data: SchedulePayload) => {
    setIsSubmitting(true);
    try {
      await createSchedule({
        farmId: data.farmId as Id<"farms">,
        name: data.name.trim(),
        frequency: data.frequency,
        customDays: data.frequency === "custom" ? data.customDays : undefined,
        startTime: data.startTime,
        duration: data.duration,
        waterAmount: data.waterAmount,
        waterSource: data.waterSource || undefined,
        zone: data.zone.trim() || undefined,
        soilMoistureTarget: data.soilMoistureTarget === "" ? undefined : Number(data.soilMoistureTarget),
        weatherDependent: data.weatherDependent,
      });
      toast.success("Irrigation schedule created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create schedule");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (data: SchedulePayload) => {
    if (!editingSchedule) return;
    setIsSubmitting(true);
    try {
      await updateSchedule({
        scheduleId: editingSchedule._id,
        farmId: data.farmId as Id<"farms">,
        name: data.name.trim(),
        frequency: data.frequency,
        customDays: data.frequency === "custom" ? data.customDays : undefined,
        startTime: data.startTime,
        duration: data.duration,
        waterAmount: data.waterAmount,
        waterSource: data.waterSource || undefined,
        zone: data.zone.trim() || undefined,
        soilMoistureTarget: data.soilMoistureTarget === "" ? undefined : Number(data.soilMoistureTarget),
        weatherDependent: data.weatherDependent,
      });
      toast.success("Irrigation schedule updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update schedule");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (schedule: ScheduleDoc) => {
    haptic.light();
    setTogglingId(schedule._id);
    try {
      if (schedule.isActive) {
        await disableSchedule({ scheduleId: schedule._id });
        toast.success("Schedule disabled");
      } else {
        await enableSchedule({ scheduleId: schedule._id });
        toast.success("Schedule enabled");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update schedule");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async (schedule: ScheduleDoc) => {
    if (!window.confirm(`Delete irrigation schedule "${schedule.name}"? This cannot be undone.`)) return;
    setIsDeleting(schedule._id);
    try {
      await deleteSchedule({ scheduleId: schedule._id });
      toast.success("Schedule deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete schedule");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRecord = async (data: {
    date: number;
    duration: number;
    waterAmount: number;
    method?: string;
    status: "completed" | "skipped" | "manual";
    notes?: string;
  }) => {
    if (!recordingSchedule) return;
    setIsSubmitting(true);
    try {
      await recordIrrigation({
        scheduleId: recordingSchedule._id,
        ...data,
      });
      toast.success("Irrigation recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record irrigation");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStoreSoil = async (data: {
    ph: number;
    organicMatter: number;
    nitrogen: number;
    phosphorus: number;
    potassium: number;
    soilMoisture: number;
    drainage: string;
    texture: string;
  }) => {
    if (!soilTestFarmId) return;
    setIsSubmitting(true);
    try {
      await storeSoilData({ farmId: soilTestFarmId, ...data });
      toast.success("Soil test recorded — analysis updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record soil test");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-[1400px] p-3 sm:p-4 md:p-6 lg:p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-5 sm:mb-7"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-3 text-2xl font-bold tracking-tight sm:text-3xl">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-deep text-brand sm:h-12 sm:w-12">
                  <Droplets className="h-6 w-6" aria-hidden />
                </span>
                Irrigation Scheduling
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Plan irrigation runs for your farms with weather and soil awareness
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-full border border-border/60 bg-muted/40 p-1">
                {(
                  [
                    { id: "schedules" as const, label: "Schedules", icon: Droplets },
                    { id: "history" as const, label: "History", icon: History },
                  ]
                ).map((tab) => (
                  <Button
                    key={tab.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      haptic.selection();
                      setView(tab.id);
                    }}
                    className={`rounded-full px-3.5 ${
                      view === tab.id
                        ? "bg-brand text-brand-foreground hover:bg-brand/90"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <tab.icon className="mr-1.5 h-4 w-4" aria-hidden />
                    {tab.label}
                    {tab.id === "schedules" && schedules.length > 0 && (
                      <span
                        className={`ml-1 rounded-full px-1.5 text-[10px] font-semibold ${
                          view === tab.id ? "bg-white/20" : "bg-muted"
                        }`}
                      >
                        {schedules.length}
                      </span>
                    )}
                  </Button>
                ))}
              </div>
              <Button
                className="rounded-full bg-brand text-brand-foreground hover:bg-brand/90 touch-target"
                onClick={() => {
                  haptic.selection();
                  setEditingSchedule(null);
                  setShowAddModal(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" />
                Add Schedule
              </Button>
            </div>
          </div>

          {/* Farm filter */}
          <div className="mt-4 max-w-xs">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Select
                value={selectedFarmId ?? "all"}
                onValueChange={(v) => {
                  haptic.selection();
                  setSelectedFarmId(v === "all" ? undefined : (v as Id<"farms">));
                }}
              >
                <SelectTrigger className="pl-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All farms</SelectItem>
                  {farms.map((farm) => (
                    <SelectItem key={farm._id} value={farm._id}>
                      {farm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        <motion.div variants={variants.container} initial="hidden" animate="visible" className="space-y-4 sm:space-y-6">
          {/* Water Usage Stats */}
          <motion.div variants={variants.item}>
            <WaterUsageStats
              history={history as unknown as HistoryRow[]}
              soilMoisture={soilMoisture}
              soilSource={soilSource}
            />
          </motion.div>

          {/* Derived Alerts */}
          <motion.div variants={variants.item}>
            <IrrigationAlerts alerts={alertsList} />
          </motion.div>

          {view === "schedules" ? (
            <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
              {/* Schedules */}
              <motion.div variants={variants.item} className="space-y-4 lg:col-span-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold sm:text-lg">Schedules</h2>
                  <Badge variant="secondary" className="border-border/60">{schedules.length}</Badge>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {[1, 2].map((i) => (
                      <Skeleton key={i} className="h-56 rounded-2xl" />
                    ))}
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand-foreground dark:text-brand">
                      <Droplets className="h-7 w-7" />
                    </div>
                    <p className="mt-4 text-base font-semibold">
                      {farms.length === 0 ? "No farms registered" : "No irrigation schedules yet"}
                    </p>
                    <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                      {farms.length === 0
                        ? "Register a farm first, then create irrigation schedules for it."
                        : "Create your first irrigation schedule to start tracking water usage."}
                    </p>
                    {farms.length > 0 && (
                      <Button
                        className="mt-5 rounded-full bg-brand text-brand-foreground hover:bg-brand/90"
                        size="sm"
                        onClick={() => {
                          haptic.selection();
                          setEditingSchedule(null);
                          setShowAddModal(true);
                        }}
                      >
                        <Plus className="mr-1.5 h-4 w-4" />
                        Add Schedule
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {schedules.map((schedule) => (
                      <ScheduleCard
                        key={schedule._id}
                        schedule={schedule}
                        farmName={farmMap.get(schedule.farmId) ?? "Unknown farm"}
                        isBusy={isDeleting === schedule._id || togglingId === schedule._id}
                        onToggle={handleToggle}
                        onEdit={(s) => {
                          setEditingSchedule(s);
                          setShowAddModal(true);
                        }}
                        onDelete={handleDelete}
                        onRecord={setRecordingSchedule}
                      />
                    ))}
                  </div>
                )}
              </motion.div>

              {/* Recommendations + Soil */}
              <motion.div variants={variants.item} className="space-y-4 sm:space-y-6">
                <SmartRecommendations weather={weatherData} soilMoisture={soilMoisture} />

                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand-foreground dark:text-brand">
                        <Sprout className="h-4 w-4" />
                      </span>
                      <CardTitle className="text-sm">Soil Status</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {selectedFarmId === undefined ? (
                      <p className="text-sm text-muted-foreground">
                        Select a farm to view its soil analysis.
                      </p>
                    ) : soil === undefined ? (
                      <Skeleton className="h-20 rounded-xl" />
                    ) : soil ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Moisture</span>
                          <span className={`text-lg font-bold ${soilMoisture !== null && soilMoisture < 40 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}`}>
                            {soilMoisture !== null ? `${Math.round(soilMoisture)}%` : "—"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Drainage</p>
                            <p className="mt-0.5 text-sm font-semibold capitalize">{soil.drainage ?? "—"}</p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Texture</p>
                            <p className="mt-0.5 text-sm font-semibold capitalize">{soil.texture ?? "—"}</p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Fertility</p>
                            <p className="mt-0.5 text-sm font-semibold capitalize">{soil.fertility ?? "—"}</p>
                          </div>
                          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">pH</p>
                            <p className="mt-0.5 text-sm font-semibold">{soil.ph ?? "—"}</p>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {soilSource === "estimated"
                            ? "Soil values are estimated from the farm's location — not from a lab or sensor."
                            : "Soil values from the latest soil analysis."}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No soil analysis available for this farm yet. Record a lab or field soil
                        test to enable moisture-based irrigation recommendations.
                      </p>
                    )}
                    {selectedFarmId !== undefined && soil !== undefined && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3 w-full rounded-full"
                        onClick={() => {
                          haptic.selection();
                          setSoilTestFarmId(selectedFarmId);
                        }}
                      >
                        <Sprout className="mr-1 h-3.5 w-3.5" aria-hidden />
                        {soil ? "Update Soil Test" : "Record Soil Test"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          ) : (
            /* History view */
            <motion.div variants={variants.item}>
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <History className="h-4 w-4" />
                    </span>
                    <CardTitle className="text-base">Irrigation History</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 py-12 text-center">
                      <Inbox className="mx-auto mb-3 h-12 w-12 text-muted-foreground/30" aria-hidden />
                      <p className="font-medium">No irrigation records yet</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Record an irrigation run from a schedule card to start building history.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {history.map((run) => (
                        <div
                          key={run._id}
                          className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3 transition-colors hover:border-brand/40 hover:bg-muted/30 sm:gap-4 sm:p-3.5"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            <Droplets className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{run.scheduleName}</p>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {new Date(run.date).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
                              {" • "}
                              {titleCase(run.status)}
                              {run.method ? ` • ${titleCase(run.method)}` : ""}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold tabular-nums">{run.waterAmount.toLocaleString()} L</p>
                            <p className="text-xs text-muted-foreground">{run.duration} min</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Modals */}
      <ScheduleModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        farms={farms}
        schedule={editingSchedule}
        defaultFarmId={farms[0]?._id ?? ""}
        isSubmitting={isSubmitting}
        onSubmit={editingSchedule ? handleUpdate : handleCreate}
      />
      <RecordIrrigationModal
        schedule={recordingSchedule}
        isOpen={recordingSchedule !== null}
        onClose={() => setRecordingSchedule(null)}
        isSubmitting={isSubmitting}
        onSubmit={handleRecord}
      />
      <SoilTestModal
        isOpen={soilTestFarmId !== undefined}
        onClose={() => setSoilTestFarmId(undefined)}
        farmName={soilTestFarmId ? (farmMap.get(soilTestFarmId) ?? "") : ""}
        isSubmitting={isSubmitting}
        onSubmit={handleStoreSoil}
      />
    </AppLayout>
  );
}
