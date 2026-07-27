import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useWeather } from "@/hooks/use-weather";
import {
  Droplets,
  Plus,
  Clock,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Sun,
  Cloud,
  CloudRain,
  Thermometer,
  Wind,
  Leaf,
  Power,
  PowerOff,
  Settings,
  TrendingDown,
  TrendingUp,
  Activity,
  Bell,
  Trash2,
  Edit,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface IrrigationSchedule {
  id: string;
  name: string;
  zone: string;
  frequency: "daily" | "alternate_days" | "weekly" | "custom";
  startTime: string;
  duration: number; // minutes
  waterAmount: number; // liters
  isActive: boolean;
  lastRun?: Date;
  nextRun: Date;
  soilMoistureTarget: number; // percentage
  weatherDependent: boolean;
}

interface IrrigationAlert {
  id: string;
  type: "low_moisture" | "high_moisture" | "rain_expected" | "schedule_due" | "system_error";
  severity: "high" | "medium" | "low";
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

// ============================================================
// Mock Data
// ============================================================

const mockSchedules: IrrigationSchedule[] = [
  {
    id: "1",
    name: "Vegetable Garden Drip",
    zone: "Zone A - Vegetables",
    frequency: "daily",
    startTime: "06:00",
    duration: 30,
    waterAmount: 200,
    isActive: true,
    lastRun: new Date(2026, 6, 26, 6, 0),
    nextRun: new Date(2026, 6, 27, 6, 0),
    soilMoistureTarget: 65,
    weatherDependent: true,
  },
  {
    id: "2",
    name: "Maize Field Sprinkler",
    zone: "Zone B - Maize",
    frequency: "alternate_days",
    startTime: "05:30",
    duration: 45,
    waterAmount: 500,
    isActive: true,
    lastRun: new Date(2026, 6, 25, 5, 30),
    nextRun: new Date(2026, 6, 27, 5, 30),
    soilMoistureTarget: 55,
    weatherDependent: true,
  },
  {
    id: "3",
    name: "Tomato Bed Micro-Sprinkler",
    zone: "Zone C - Tomatoes",
    frequency: "daily",
    startTime: "06:30",
    duration: 20,
    waterAmount: 150,
    isActive: false,
    lastRun: new Date(2026, 6, 20, 6, 30),
    nextRun: new Date(2026, 6, 27, 6, 30),
    soilMoistureTarget: 70,
    weatherDependent: true,
  },
  {
    id: "4",
    name: "Livestock Watering",
    zone: "Livestock Area",
    frequency: "daily",
    startTime: "07:00",
    duration: 15,
    waterAmount: 100,
    isActive: true,
    lastRun: new Date(2026, 6, 26, 7, 0),
    nextRun: new Date(2026, 6, 27, 7, 0),
    soilMoistureTarget: 0,
    weatherDependent: false,
  },
];

const mockAlerts: IrrigationAlert[] = [
  {
    id: "1",
    type: "low_moisture",
    severity: "high",
    title: "Low Soil Moisture - Zone A",
    message: "Soil moisture dropped to 28%. Immediate irrigation recommended.",
    timestamp: new Date(2026, 6, 26, 14, 30),
    acknowledged: false,
  },
  {
    id: "2",
    type: "rain_expected",
    severity: "medium",
    title: "Rain Expected Tomorrow",
    message: "Heavy rain forecasted. Consider skipping scheduled irrigation.",
    timestamp: new Date(2026, 6, 26, 10, 0),
    acknowledged: false,
  },
  {
    id: "3",
    type: "schedule_due",
    severity: "low",
    title: "Irrigation Due in 30 Minutes",
    message: "Zone B - Maize scheduled irrigation at 05:30.",
    timestamp: new Date(2026, 6, 26, 5, 0),
    acknowledged: true,
  },
];

// ============================================================
// Water Usage Stats
// ============================================================

function WaterUsageStats({ soilMoisture }: { soilMoisture: number }) {
  const stats = [
    { label: "Today's Usage", value: "850 L", change: "-12%", trend: "down", icon: Droplets, color: "bg-blue-500" },
    { label: "Weekly Usage", value: "5.2 kL", change: "+8%", trend: "up", icon: Activity, color: "bg-cyan-500" },
    { label: "Monthly Usage", value: "18.5 kL", change: "-5%", trend: "down", icon: TrendingDown, color: "bg-indigo-500" },
    { label: "Soil Moisture", value: `${soilMoisture}%`, change: soilMoisture < 40 ? "Low" : "Optimal", trend: soilMoisture < 40 ? "down" : "stable", icon: Leaf, color: soilMoisture < 40 ? "bg-amber-500" : "bg-green-500" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <Card key={i} className="border-border/50 card-hover">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <div className="flex items-center gap-1">
                    {stat.trend === "up" ? (
                      <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5 text-green-500" />
                    )}
                    <span className="text-xs text-green-500">{stat.change}</span>
                  </div>
                </div>
                <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${stat.color}`}>
                  <Icon className="w-5 h-5 text-white" />
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
// Smart Recommendations
// ============================================================

function SmartRecommendations({
  weather,
  soilMoisture,
}: {
  weather: ReturnType<typeof useWeather>["data"];
  soilMoisture: number;
}) {
  const recommendations = useMemo(() => {
    const recs: Array<{
      title: string;
      description: string;
      priority: "high" | "medium" | "low";
      icon: typeof Droplets;
      color: string;
    }> = [];

    // Rain expected - skip irrigation
    if (weather?.daily.some((d) => d.precipitationSum > 10)) {
      recs.push({
        title: "Skip Tomorrow's Irrigation",
        description: "Heavy rain expected. Watering now would waste resources and may cause waterlogging.",
        priority: "high",
        icon: CloudRain,
        color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      });
    }

    // Low soil moisture
    if (soilMoisture < 30) {
      recs.push({
        title: "Increase Irrigation Frequency",
        description: "Soil moisture is critically low. Consider watering twice daily until levels recover.",
        priority: "high",
        icon: Droplets,
        color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      });
    } else if (soilMoisture < 40) {
      recs.push({
        title: "Extend Irrigation Duration",
        description: "Soil moisture is below optimal. Add 10 minutes to your next irrigation cycle.",
        priority: "medium",
        icon: Droplets,
        color: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      });
    }

    // High UV - water early
    if (weather?.current.uvIndex && weather.current.uvIndex > 7) {
      recs.push({
        title: "Water Early Morning",
        description: "High UV index expected. Water before 6 AM to minimize evaporation losses.",
        priority: "medium",
        icon: Sun,
        color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      });
    }

    // Optimal conditions
    if (soilMoisture >= 50 && soilMoisture <= 70) {
      recs.push({
        title: "Conditions Optimal",
        description: "Soil moisture levels are healthy. Continue current irrigation schedule.",
        priority: "low",
        icon: CheckCircle2,
        color: "bg-green-500/10 text-green-600 border-green-500/20",
      });
    }

    // High wind - reduce spray
    if (weather?.current.windSpeed && weather.current.windSpeed > 20) {
      recs.push({
        title: "Reduce Spray Irrigation",
        description: "Strong winds detected. Switch to drip irrigation to prevent water drift.",
        priority: "medium",
        icon: Wind,
        color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      });
    }

    return recs;
  }, [weather, soilMoisture]);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Leaf className="w-4 h-4 text-green-500" />
          Smart Recommendations
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {recommendations.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">All systems operating normally</p>
          </div>
        ) : (
          recommendations.map((rec, i) => {
            const Icon = rec.icon;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`p-3 rounded-xl border ${rec.color}`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold">{rec.title}</h4>
                    <p className="text-xs mt-0.5 opacity-80">{rec.description}</p>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Schedule Card
// ============================================================

function ScheduleCard({
  schedule,
  onToggle,
  onDelete,
}: {
  schedule: IrrigationSchedule;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className={`border-border/50 card-hover ${!schedule.isActive ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold">{schedule.name}</h3>
            <p className="text-xs text-muted-foreground">{schedule.zone}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {schedule.frequency.replace("_", " ")}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onToggle(schedule.id)}
            >
              {schedule.isActive ? (
                <Power className="w-4 h-4 text-green-500" />
              ) : (
                <PowerOff className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center mb-3">
          <div className="p-2 rounded-lg bg-muted/30">
            <Clock className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs font-medium">{schedule.startTime}</p>
            <p className="text-[10px] text-muted-foreground">{schedule.duration} min</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <Droplets className="w-4 h-4 mx-auto text-blue-400 mb-1" />
            <p className="text-xs font-medium">{schedule.waterAmount} L</p>
            <p className="text-[10px] text-muted-foreground">per session</p>
          </div>
          <div className="p-2 rounded-lg bg-muted/30">
            <Leaf className="w-4 h-4 mx-auto text-green-400 mb-1" />
            <p className="text-xs font-medium">{schedule.soilMoistureTarget}%</p>
            <p className="text-[10px] text-muted-foreground">target</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
          <span>Last: {schedule.lastRun?.toLocaleDateString() || "Never"}</span>
          <span>Next: {schedule.nextRun.toLocaleDateString()}</span>
        </div>

        {schedule.weatherDependent && (
          <Badge variant="outline" className="text-[10px] w-full justify-center">
            <Cloud className="w-3 h-3 mr-1" />
            Weather-dependent
          </Badge>
        )}

        <div className="flex gap-2 mt-3">
          <Button variant="outline" size="sm" className="flex-1">
            <Edit className="w-3.5 h-3.5 mr-1" />
            Edit
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(schedule.id)}>
            <Trash2 className="w-3.5 h-3.5 text-destructive" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Irrigation Alerts
// ============================================================

function IrrigationAlerts({
  alerts,
  onAcknowledge,
}: {
  alerts: IrrigationAlert[];
  onAcknowledge: (id: string) => void;
}) {
  const unacknowledged = alerts.filter((a) => !a.acknowledged);

  if (unacknowledged.length === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-500" />
            Active Alerts
          </CardTitle>
          <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
            {unacknowledged.length} New
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {unacknowledged.map((alert) => (
          <div
            key={alert.id}
            className={`p-3 rounded-xl border-l-4 ${
              alert.severity === "high"
                ? "border-red-500 bg-red-500/5"
                : alert.severity === "medium"
                ? "border-amber-500 bg-amber-500/5"
                : "border-blue-500 bg-blue-500/5"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-sm font-semibold">{alert.title}</h4>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAcknowledge(alert.id)}
                className="text-xs"
              >
                Dismiss
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Main Irrigation Page
// ============================================================

export default function Irrigation() {
  const { data: weatherData } = useWeather();
  const [schedules, setSchedules] = useState(mockSchedules);
  const [alerts, setAlerts] = useState(mockAlerts);

  // Simulated soil moisture (in real app, would come from sensors/API)
  const [soilMoisture, setSoilMoisture] = useState(38);

  const handleToggle = (id: string) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, isActive: !s.isActive } : s))
    );
  };

  const handleDelete = (id: string) => {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  };

  const handleAcknowledgeAlert = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
    );
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Irrigation Scheduling</h1>
              <p className="text-muted-foreground mt-1">
                Smart irrigation based on soil moisture and weather data
              </p>
            </div>
            <Button className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Add Schedule
            </Button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-6"
        >
          {/* Water Usage Stats */}
          <WaterUsageStats soilMoisture={soilMoisture} />

          {/* Alerts */}
          <IrrigationAlerts alerts={alerts} onAcknowledge={handleAcknowledgeAlert} />

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Schedules */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Active Schedules</h2>
                <Badge variant="secondary">{schedules.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {schedules.map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>

            {/* Recommendations */}
            <div className="space-y-6">
              <SmartRecommendations weather={weatherData} soilMoisture={soilMoisture} />

              {/* Quick Moisture Adjust */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Adjust Soil Moisture Target</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Level</span>
                      <span className={`text-lg font-bold ${soilMoisture < 40 ? "text-amber-500" : "text-green-500"}`}>
                        {soilMoisture}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={soilMoisture}
                      onChange={(e) => setSoilMoisture(parseInt(e.target.value))}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Dry</span>
                      <span>Optimal (50-70%)</span>
                      <span>Wet</span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSoilMoisture(Math.max(0, soilMoisture - 10))}
                      >
                        -10%
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => setSoilMoisture(Math.min(100, soilMoisture + 10))}
                      >
                        +10%
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
