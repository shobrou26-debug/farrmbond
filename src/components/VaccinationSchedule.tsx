import { useState } from "react";
import { motion } from "framer-motion";
import {
  Syringe,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  History,
  Filter,
  Loader2,
  FileText,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

interface LivestockDoc {
  _id: string;
  name: string;
  type: string;
  breed?: string;
  quantity: number;
  unit: string;
  status: string;
  farmId: string;
  nextVaccination?: number;
  lastVaccination?: number;
}

interface VaccinationScheduleTabProps {
  livestock: LivestockDoc[];
  scheduleVaccination: (args: any) => Promise<any>;
  completeVaccination: (args: any) => Promise<any>;
}

const VACCINE_TYPES = [
  "FMD", "Anthrax", "Brucellosis", "Rift Valley Fever",
  "Newcastle Disease", "Gumboro", "Rabies", "Blackleg",
  "PPR", "CBPP", "Pasteurellosis", "Trypanosomiasis",
];

const PIE_COLORS = [
  "#16a34a", "#2563eb", "#d97706", "#dc2626", "#7c3aed",
  "#0891b2", "#c026d3", "#65a30d", "#e11d48", "#0d9488",
];

export function VaccinationScheduleTab({
  livestock,
  scheduleVaccination,
  completeVaccination,
}: VaccinationScheduleTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<"schedule" | "history" | "analytics">("schedule");
  const [animalToSchedule, setAnimalToSchedule] = useState<LivestockDoc | null>(null);
  const [animalToComplete, setAnimalToComplete] = useState<LivestockDoc | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [completeNotes, setCompleteNotes] = useState("");
  const [completeCost, setCompleteCost] = useState("");
  const [completeVaccineType, setCompleteVaccineType] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // History filters
  const [historyStartDate, setHistoryStartDate] = useState("");
  const [historyEndDate, setHistoryEndDate] = useState("");
  const [historyAnimalType, setHistoryAnimalType] = useState("all");

  const animalTypes = [...new Set(livestock.map((l) => l.type))];

  // Queries
  const vaccinationHistory = useQuery(api.livestock.getVaccinationHistory, {
    startDate: historyStartDate ? new Date(historyStartDate).getTime() : undefined,
    endDate: historyEndDate ? new Date(historyEndDate + "T23:59:59").getTime() : undefined,
    animalType: historyAnimalType !== "all" ? historyAnimalType : undefined,
  });

  const costAnalytics = useQuery(api.livestock.getVaccinationCostAnalytics);
  const vaccineCoverage = useQuery(api.livestock.getVaccineCoverage);

  const now = Date.now();
  const upcomingVaccinations = livestock
    .filter((l) => l.nextVaccination && l.nextVaccination > now)
    .sort((a, b) => (a.nextVaccination || 0) - (b.nextVaccination || 0));

  const overdueVaccinations = livestock
    .filter((l) => l.nextVaccination && l.nextVaccination <= now)
    .sort((a, b) => (a.nextVaccination || 0) - (b.nextVaccination || 0));

  const unscheduled = livestock.filter(
    (l) => !l.nextVaccination && l.status !== "harvested"
  );

  const handleSchedule = async () => {
    if (!animalToSchedule || !scheduleDate) return;
    setIsSubmitting(true);
    try {
      await scheduleVaccination({
        livestockId: animalToSchedule._id,
        scheduledDate: new Date(scheduleDate).getTime(),
      });
      toast.success(`Vaccination scheduled for ${animalToSchedule.name}`);
      setAnimalToSchedule(null);
      setScheduleDate("");
    } catch (error) {
      console.error("Failed to schedule vaccination:", error);
      toast.error("Failed to schedule vaccination");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = async () => {
    if (!animalToComplete) return;
    setIsSubmitting(true);
    try {
      await completeVaccination({
        livestockId: animalToComplete._id,
        notes: completeNotes || undefined,
        cost: completeCost ? parseFloat(completeCost) : undefined,
        vaccineType: completeVaccineType || undefined,
      });
      toast.success(`Vaccination completed for ${animalToComplete.name}`);
      setAnimalToComplete(null);
      setCompleteNotes("");
      setCompleteCost("");
      setCompleteVaccineType("");
    } catch (error) {
      console.error("Failed to complete vaccination:", error);
      toast.error("Failed to complete vaccination");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDaysUntil = (timestamp: number) => {
    return Math.ceil((timestamp - now) / (24 * 60 * 60 * 1000));
  };

  const clearHistoryFilters = () => {
    setHistoryStartDate("");
    setHistoryEndDate("");
    setHistoryAnimalType("all");
  };

  const hasActiveFilters = historyStartDate || historyEndDate || historyAnimalType !== "all";

  // Chart configs
  const typeChartConfig = Object.fromEntries(
    (costAnalytics?.byType || []).map((item, i) => [
      item.type,
      { label: item.type, color: PIE_COLORS[i % PIE_COLORS.length] },
    ])
  ) satisfies ChartConfig;

  const farmChartConfig = Object.fromEntries(
    (costAnalytics?.byFarm || []).map((item, i) => [
      item.farm,
      { label: item.farm, color: PIE_COLORS[i % PIE_COLORS.length] },
    ])
  ) satisfies ChartConfig;

  const trendChartConfig = {
    cost: {
      label: "Vaccination Cost",
      color: "#16a34a",
    },
  } satisfies ChartConfig;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {[
          { id: "schedule" as const, label: "Schedule", icon: Calendar },
          { id: "history" as const, label: "History", icon: History },
          { id: "analytics" as const, label: "Analytics", icon: BarChart3 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === tab.id
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========== SCHEDULE TAB ========== */}
      {activeSubTab === "schedule" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-50">
                    <Clock className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{upcomingVaccinations.length}</p>
                    <p className="text-xs text-muted-foreground">Upcoming</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-50">
                    <AlertTriangle className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{overdueVaccinations.length}</p>
                    <p className="text-xs text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50">
                    <Syringe className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{unscheduled.length}</p>
                    <p className="text-xs text-muted-foreground">Unscheduled</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {overdueVaccinations.length > 0 && (
            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-red-600 text-base">
                  <AlertTriangle className="w-5 h-5" />
                  Overdue Vaccinations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {overdueVaccinations.map((animal) => {
                  const daysOverdue = Math.abs(getDaysUntil(animal.nextVaccination!));
                  return (
                    <div
                      key={animal._id}
                      className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100"
                    >
                      <div className="flex items-center gap-3">
                        <Syringe className="w-4 h-4 text-red-500" />
                        <div>
                          <p className="font-medium">{animal.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {animal.type} · {animal.quantity} {animal.unit}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="destructive">{daysOverdue}d overdue</Badge>
                        <Button
                          size="sm"
                          onClick={() => setAnimalToComplete(animal)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Calendar className="w-5 h-5 text-emerald-600" />
                Upcoming Vaccinations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingVaccinations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Syringe className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No upcoming vaccinations scheduled</p>
                </div>
              ) : (
                upcomingVaccinations.map((animal) => {
                  const daysUntil = getDaysUntil(animal.nextVaccination!);
                  const isUrgent = daysUntil <= 3;
                  return (
                    <div
                      key={animal._id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isUrgent ? "bg-amber-50 border-amber-200" : "bg-background"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Syringe className={`w-4 h-4 ${isUrgent ? "text-amber-600" : "text-emerald-600"}`} />
                        <div>
                          <p className="font-medium">{animal.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {animal.type} · Due{" "}
                            {new Date(animal.nextVaccination!).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={isUrgent ? "destructive" : "secondary"}>
                          {daysUntil === 0 ? "Today" : `${daysUntil}d`}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setAnimalToSchedule(animal)}
                        >
                          <Calendar className="w-4 h-4 mr-1" />
                          Reschedule
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setAnimalToComplete(animal)}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          Complete
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {unscheduled.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Syringe className="w-5 h-5 text-blue-600" />
                  Animals Without Vaccination Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {unscheduled.slice(0, 10).map((animal) => (
                  <div
                    key={animal._id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex items-center gap-3">
                      <Syringe className="w-4 h-4 text-blue-500" />
                      <div>
                        <p className="font-medium">{animal.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {animal.type} · {animal.quantity} {animal.unit}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAnimalToSchedule(animal)}
                    >
                      <Calendar className="w-4 h-4 mr-1" />
                      Schedule
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ========== HISTORY TAB ========== */}
      {activeSubTab === "history" && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="w-5 h-5 text-emerald-600" />
                Filter Vaccination History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="hist-start">Start Date</Label>
                  <Input
                    id="hist-start"
                    type="date"
                    value={historyStartDate}
                    onChange={(e) => setHistoryStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="hist-end">End Date</Label>
                  <Input
                    id="hist-end"
                    type="date"
                    value={historyEndDate}
                    onChange={(e) => setHistoryEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="hist-type">Animal Type</Label>
                  <Select value={historyAnimalType} onValueChange={setHistoryAnimalType}>
                    <SelectTrigger id="hist-type" className="mt-1">
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {animalTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  {hasActiveFilters && (
                    <Button variant="outline" onClick={clearHistoryFilters} className="w-full">
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="w-5 h-5 text-emerald-600" />
                  Vaccination History
                </CardTitle>
                {vaccinationHistory && (
                  <Badge variant="secondary">{vaccinationHistory.length} records</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {vaccinationHistory === undefined ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
                  <p>Loading vaccination history...</p>
                </div>
              ) : vaccinationHistory.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>No vaccination records found</p>
                  {hasActiveFilters && (
                    <Button variant="link" onClick={clearHistoryFilters} className="mt-2">
                      Clear filters to see all records
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-4 text-sm text-muted-foreground pb-3 border-b">
                    <span>
                      Total: <strong className="text-foreground">{vaccinationHistory.length}</strong> vaccinations
                    </span>
                    <span>
                      Total cost:{" "}
                      <strong className="text-foreground">
                        ${vaccinationHistory.reduce((sum, r) => sum + (r.cost || 0), 0).toFixed(2)}
                      </strong>
                    </span>
                  </div>
                  {vaccinationHistory.map((record, idx) => (
                    <div
                      key={`${record.livestockId}-${record.date}-${idx}`}
                      className="flex items-start justify-between p-3 rounded-lg border bg-background"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-emerald-50">
                          <Syringe className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-medium">{record.livestockName}</p>
                          <p className="text-sm text-muted-foreground">
                            {record.livestockType} · {record.farmName}
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">{record.description}</p>
                          {record.treatment !== "Vaccination" && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Treatment: {record.treatment}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-sm font-medium">
                          {new Date(record.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                        {record.cost !== undefined && record.cost > 0 && (
                          <p className="text-sm text-muted-foreground">${record.cost.toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* ========== ANALYTICS TAB ========== */}
      {activeSubTab === "analytics" && (
        <>
          {costAnalytics === undefined ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin opacity-50" />
                <p>Loading analytics...</p>
              </CardContent>
            </Card>
          ) : costAnalytics.recordCount === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium mb-2">No vaccination cost data yet</p>
                <p className="text-sm">
                  Complete vaccinations with costs to see analytics here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-50">
                        <TrendingUp className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          ${costAnalytics.totalCost.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">Total Vaccination Cost</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-50">
                        <FileText className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{costAnalytics.recordCount}</p>
                        <p className="text-xs text-muted-foreground">Total Records</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-amber-50">
                        <Syringe className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          ${costAnalytics.recordCount > 0
                            ? (costAnalytics.totalCost / costAnalytics.recordCount).toFixed(2)
                            : "0.00"}
                        </p>
                        <p className="text-xs text-muted-foreground">Avg. Cost per Vaccination</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Monthly Spending Trend */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Monthly Spending Trend
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={trendChartConfig} className="h-[300px] w-full">
                    <AreaChart data={costAnalytics.monthlySpending}>
                      <defs>
                        <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
                          />
                        }
                      />
                      <Area
                        type="monotone"
                        dataKey="cost"
                        stroke="#16a34a"
                        strokeWidth={2}
                        fill="url(#costGradient)"
                      />
                    </AreaChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              {/* Cost by Animal Type + Cost by Farm */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Pie Chart: Cost by Animal Type */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Syringe className="w-5 h-5 text-emerald-600" />
                      Cost by Animal Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {costAnalytics.byType.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No cost data by type</p>
                      </div>
                    ) : (
                      <>
                        <ChartContainer config={typeChartConfig} className="h-[250px] w-full">
                          <PieChart>
                            <ChartTooltip
                              content={
                                <ChartTooltipContent
                                  formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
                                />
                              }
                            />
                            <Pie
                              data={costAnalytics.byType}
                              dataKey="cost"
                              nameKey="type"
                              cx="50%"
                              cy="50%"
                              outerRadius={90}
                              innerRadius={50}
                              paddingAngle={3}
                            >
                              {costAnalytics.byType.map((_, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={PIE_COLORS[index % PIE_COLORS.length]}
                                />
                              ))}
                            </Pie>
                          </PieChart>
                        </ChartContainer>
                        {/* Legend */}
                        <div className="flex flex-wrap gap-3 mt-4 justify-center">
                          {costAnalytics.byType.map((item, i) => (
                            <div key={item.type} className="flex items-center gap-2 text-sm">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                              />
                              <span className="text-muted-foreground">{item.type}</span>
                              <span className="font-medium">${item.cost.toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Bar Chart: Cost by Farm */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="w-5 h-5 text-emerald-600" />
                      Cost by Farm
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {costAnalytics.byFarm.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No cost data by farm</p>
                      </div>
                    ) : (
                      <ChartContainer config={farmChartConfig} className="h-[300px] w-full">
                        <BarChart
                          data={costAnalytics.byFarm}
                          layout="vertical"
                          margin={{ left: 10 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" horizontal={false} />
                          <XAxis
                            type="number"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(value) => `$${value}`}
                          />
                          <YAxis
                            type="category"
                            dataKey="farm"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            width={120}
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
                              />
                            }
                          />
                          <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                            {costAnalytics.byFarm.map((_, index) => (
                              <Cell
                                key={`farm-${index}`}
                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}

      {/* ========== DIALOGS ========== */}

      {/* Schedule Vaccination Dialog */}
      <Dialog
        open={animalToSchedule !== null}
        onOpenChange={() => setAnimalToSchedule(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-emerald-600" />
              Schedule Vaccination — {animalToSchedule?.name}
            </DialogTitle>
            <DialogDescription>
              Set the next vaccination date for this animal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="schedule-date">Vaccination Date *</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnimalToSchedule(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              disabled={isSubmitting || !scheduleDate}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4 mr-2" />
              )}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Vaccination Dialog */}
      <Dialog
        open={animalToComplete !== null}
        onOpenChange={() => setAnimalToComplete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Complete Vaccination — {animalToComplete?.name}
            </DialogTitle>
            <DialogDescription>
              Mark this vaccination as completed. The next vaccination will be auto-scheduled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="complete-notes">Notes (optional)</Label>
              <Input
                id="complete-notes"
                placeholder="e.g. Given Ivermectin 10ml"
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="complete-vaccine-type">Vaccine Type *</Label>
              <Select value={completeVaccineType} onValueChange={setCompleteVaccineType}>
                <SelectTrigger id="complete-vaccine-type" className="mt-1">
                  <SelectValue placeholder="Select vaccine type" />
                </SelectTrigger>
                <SelectContent>
                  {VACCINE_TYPES.map((vax) => (
                    <SelectItem key={vax} value={vax}>
                      {vax}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="complete-cost">Cost (optional)</Label>
              <Input
                id="complete-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={completeCost}
                onChange={(e) => setCompleteCost(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnimalToComplete(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleComplete}
              disabled={isSubmitting || !completeVaccineType}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
