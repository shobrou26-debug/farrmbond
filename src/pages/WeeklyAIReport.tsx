import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generatePDF } from "@/lib/exports";
import { useCurrency } from "@/hooks/use-currency";
import {
  FileText,
  Download,
  Sprout,
  Beef,
  DollarSign,
  Lightbulb,
  ArrowRight,
  Loader2,
  Inbox,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Shield,
  TrendingUp,
  TrendingDown,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ============================================================
// Parsing helpers — the backend stores report sections as JSON strings
// ============================================================

function tryParse<T>(value: string | undefined | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

interface ParsedFinancial {
  income: number;
  expenses: number;
  profit: number;
}

function parseFinancialText(text: string | undefined): ParsedFinancial {
  const result: ParsedFinancial = { income: 0, expenses: 0, profit: 0 };
  if (!text) return result;
  const incomeMatch = text.match(/Income:?\s*([\d.]+)/i);
  const expensesMatch = text.match(/Expenses:?\s*([\d.]+)/i);
  const netMatch = text.match(/Net:?\s*(-?[\d.]+)/i);
  if (incomeMatch) result.income = parseFloat(incomeMatch[1]) || 0;
  if (expensesMatch) result.expenses = parseFloat(expensesMatch[1]) || 0;
  if (netMatch) result.profit = parseFloat(netMatch[1]) || 0;
  return result;
}

interface ReportCrops {
  total?: number;
  healthy?: number;
  needsAttention?: number;
}

interface ReportLivestock {
  total?: number;
  healthy?: number;
  needsVaccination?: number;
}

interface ReportRisk {
  risk: string;
  level: string;
  mitigation: string;
}

interface ReportRecommendation {
  category: string;
  title: string;
  description: string;
  priority: string;
  confidence: number;
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

// ============================================================
// Page
// ============================================================

export default function WeeklyAIReport() {
  const { currency } = useCurrency();
  const [selectedSection, setSelectedSection] = useState<"overview" | "crops" | "livestock" | "finance" | "recommendations">("overview");
  const [selectedFarmId, setSelectedFarmId] = useState<Id<"farms"> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [appliedRecs, setAppliedRecs] = useState<Set<string>>(new Set());

  const farmsData = useQuery(api.farms.listUserFarms, {});
  const farms = farmsData?.page ?? [];

  const latest = useQuery(
    api.weeklyReport.getLatestReport,
    selectedFarmId ? { farmId: selectedFarmId } : "skip"
  );
  const history = useQuery(
    api.weeklyReport.getReportHistory,
    selectedFarmId ? { farmId: selectedFarmId, limit: 10 } : "skip"
  );

  const generateReport = useAction(api.weeklyReport.generateWeeklyReport);
  const applyRec = useMutation(api.weeklyReport.applyRecommendation);

  // Default to the first farm once loaded
  useEffect(() => {
    if (!selectedFarmId && farms.length > 0) {
      setSelectedFarmId(farms[0]._id);
    }
  }, [farms, selectedFarmId]);

  // ============================================================
  // Derived report content
  // ============================================================
  const summaryObj = useMemo(
    () => tryParse<{ overallHealth?: number; cropHealth?: number; livestockHealth?: number; soilHealth?: number; weatherRisk?: number }>(latest?.summary, {}),
    [latest]
  );
  const cropsObj = useMemo(() => tryParse<ReportCrops | null>(latest?.crops, null), [latest]);
  const livestockObj = useMemo(() => tryParse<ReportLivestock | null>(latest?.livestock, null), [latest]);
  const risks = useMemo(() => tryParse<ReportRisk[]>(latest?.riskAnalysis, []), [latest]);
  const recommendations = useMemo<ReportRecommendation[]>(() => latest?.recommendations ?? [], [latest]);
  const financial = useMemo(() => parseFinancialText(latest?.financial), [latest]);

  const sortedRecommendations = useMemo(
    () => [...recommendations].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9)),
    [recommendations]
  );

  const highlights = useMemo(() => {
    const list: { type: "success" | "warning" | "info"; title: string; description: string }[] = [];
    sortedRecommendations.slice(0, 2).forEach((rec) => {
      list.push({
        type: rec.priority === "high" ? "warning" : rec.priority === "medium" ? "info" : "success",
        title: rec.title,
        description: rec.description,
      });
    });
    risks.slice(0, 2).forEach((r) => {
      list.push({
        type: r.level === "high" ? "warning" : "info",
        title: `Risk: ${r.risk}`,
        description: r.mitigation || "Monitor this risk closely.",
      });
    });
    return list;
  }, [sortedRecommendations, risks]);

  const weekLabel = useMemo(() => {
    if (!latest?.generatedAt) return null;
    const end = new Date(latest.generatedAt);
    const start = new Date(latest.generatedAt - 7 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(start)} - ${fmt(end)}, ${end.getFullYear()}`;
  }, [latest?.generatedAt]);

  const isLoading = farmsData === undefined;
  const reportLoading = latest === undefined;

  // ============================================================
  // Actions
  // ============================================================
  const handleGenerate = async () => {
    if (!selectedFarmId || isGenerating) return;
    setIsGenerating(true);
    try {
      await generateReport({ farmId: selectedFarmId });
      toast.success("Weekly report generated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApply = async (rec: ReportRecommendation) => {
    if (!selectedFarmId) return;
    try {
      await applyRec({
        farmId: selectedFarmId,
        title: rec.title,
        description: rec.description,
        priority: rec.priority,
      });
      setAppliedRecs((prev) => new Set(prev).add(rec.title));
      toast.success("Added to your farm calendar");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply recommendation");
    }
  };

  const handleExportPDF = () => {
    if (!latest) {
      toast.info("Generate a report first to export it.");
      return;
    }
    const rows: Record<string, unknown>[] = [
      { section: "Report Period", value: weekLabel ?? new Date(latest.generatedAt).toLocaleDateString() },
      { section: "Health Score", value: latest.healthScore != null ? `${latest.healthScore}%` : "Not available yet" },
      {
        section: "Crops",
        value: cropsObj
          ? `${cropsObj.total ?? 0} tracked • ${cropsObj.healthy ?? 0} healthy • ${cropsObj.needsAttention ?? 0} need attention`
          : latest.crops || "No crop data",
      },
      {
        section: "Livestock",
        value: livestockObj
          ? `${livestockObj.total ?? 0} managed • ${livestockObj.healthy ?? 0} healthy • ${livestockObj.needsVaccination ?? 0} need vaccination`
          : latest.livestock || "No livestock data",
      },
      {
        section: "Finance",
        value:
          financial.income > 0 || financial.expenses > 0
            ? `Income: ${financial.income} ${currency} • Expenses: ${financial.expenses} ${currency} • Net: ${financial.profit} ${currency}`
            : "No financial data this week",
      },
      ...risks.map((r) => ({ section: `Risk (${r.level})`, value: `${r.risk} — ${r.mitigation}` })),
      ...sortedRecommendations.map((rec) => ({
        section: `Recommendation (${rec.priority}, ${rec.confidence}% confidence)`,
        value: `${rec.title} — ${rec.description}`,
      })),
    ];

    const filename = `weekly-ai-report-${new Date().toISOString().split("T")[0]}`;
    generatePDF({
      title: "Weekly AI Report",
      subtitle: weekLabel ?? `Generated ${new Date(latest.generatedAt).toLocaleDateString()}`,
      filename,
      columns: [
        { header: "Section", key: "section", width: 35 },
        { header: "Details", key: "value", width: 65 },
      ],
      data: rows,
    });
    toast.success("PDF exported");
  };

  const sections = [
    { id: "overview" as const, label: "Overview", icon: FileText },
    { id: "crops" as const, label: "Crops", icon: Sprout },
    { id: "livestock" as const, label: "Livestock", icon: Beef },
    { id: "finance" as const, label: "Finance", icon: DollarSign },
    { id: "recommendations" as const, label: "AI Recommendations", icon: Lightbulb },
  ];

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Weekly AI Report</h1>
              <p className="text-muted-foreground mt-1">
                {weekLabel
                  ? `AI-generated insights for the week of ${weekLabel}`
                  : "AI-generated insights and recommendations for your farm"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleExportPDF} disabled={!latest}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button className="gradient-primary" onClick={handleGenerate} disabled={!selectedFarmId || isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? "Generating..." : "Generate Report"}
              </Button>
            </div>
          </div>

          {/* Farm selector */}
          <div className="mt-4 max-w-xs">
            <Select
              value={selectedFarmId ?? undefined}
              onValueChange={(v) => setSelectedFarmId(v as Id<"farms">)}
              disabled={farms.length <= 1}
            >
              <SelectTrigger>
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
        </motion.div>

        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="h-64 bg-muted/50 rounded-xl animate-pulse" />
          </div>
        ) : farms.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Inbox className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium">No farms registered</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Register a farm first to generate weekly AI reports.
              </p>
            </CardContent>
          </Card>
        ) : reportLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="h-64 bg-muted/50 rounded-xl animate-pulse" />
          </div>
        ) : !latest ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium">No report for this week yet</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Generate a weekly AI report to see farm health, crop progress, livestock status, and AI recommendations.
              </p>
              <Button className="mt-4 gradient-primary" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {isGenerating ? "Generating..." : "Generate Report"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Section Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit mb-6 overflow-x-auto">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setSelectedSection(section.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    selectedSection === section.id
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <section.icon className="w-4 h-4" />
                  {section.label}
                </button>
              ))}
            </div>

            {/* Overview Section */}
            {selectedSection === "overview" && (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <motion.div variants={itemVariants}>
                    <Card className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Health Score</p>
                            <p className="text-2xl font-bold">{latest.healthScore != null ? `${latest.healthScore}%` : "—"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <Card className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Weekly Profit</p>
                            <p className="text-2xl font-bold text-green-600">
                              {financial.income > 0 ? `+${financial.profit.toFixed(2)}` : "—"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <Card className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                            <Sprout className="w-5 h-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Crops Tracked</p>
                            <p className="text-2xl font-bold">{cropsObj?.total ?? "—"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                  <motion.div variants={itemVariants}>
                    <Card className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Beef className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Livestock</p>
                            <p className="text-2xl font-bold">{livestockObj?.total ?? "—"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* Key Highlights */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle>Key Highlights This Week</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {highlights.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No highlights this week.
                        </p>
                      ) : (
                        highlights.map((highlight, idx) => (
                          <div
                            key={idx}
                            className={`p-4 rounded-xl border ${
                              highlight.type === "success"
                                ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                                : highlight.type === "warning"
                                ? "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800"
                                : "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium">{highlight.title}</h4>
                                <p className="text-sm text-muted-foreground mt-1">{highlight.description}</p>
                              </div>
                              {highlight.type === "warning" && (
                                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}

            {/* Crops Section */}
            {selectedSection === "crops" && (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                {cropsObj ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <motion.div variants={itemVariants}>
                      <Card className="border-border/50">
                        <CardContent className="p-5 text-center">
                          <Sprout className="w-6 h-6 text-green-600 mx-auto mb-2" />
                          <p className="text-3xl font-bold">{cropsObj.total ?? 0}</p>
                          <p className="text-sm text-muted-foreground">Crops Tracked</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                      <Card className="border-border/50">
                        <CardContent className="p-5 text-center">
                          <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-2" />
                          <p className="text-3xl font-bold">{cropsObj.healthy ?? 0}</p>
                          <p className="text-sm text-muted-foreground">Healthy</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                      <Card className="border-border/50">
                        <CardContent className="p-5 text-center">
                          <TrendingDown className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                          <p className="text-3xl font-bold">{cropsObj.needsAttention ?? 0}</p>
                          <p className="text-sm text-muted-foreground">Need Attention</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>
                ) : (
                  <Card className="border-border/50">
                    <CardContent className="py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        {latest.crops || "No crop data in this report."}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}

            {/* Livestock Section */}
            {selectedSection === "livestock" && (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                {livestockObj ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <motion.div variants={itemVariants}>
                      <Card className="border-border/50">
                        <CardContent className="p-5 text-center">
                          <Beef className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                          <p className="text-3xl font-bold">{livestockObj.total ?? 0}</p>
                          <p className="text-sm text-muted-foreground">Livestock Managed</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                      <Card className="border-border/50">
                        <CardContent className="p-5 text-center">
                          <Shield className="w-6 h-6 text-green-600 mx-auto mb-2" />
                          <p className="text-3xl font-bold">{livestockObj.healthy ?? 0}</p>
                          <p className="text-sm text-muted-foreground">Healthy</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                    <motion.div variants={itemVariants}>
                      <Card className="border-border/50">
                        <CardContent className="p-5 text-center">
                          <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
                          <p className="text-3xl font-bold">{livestockObj.needsVaccination ?? 0}</p>
                          <p className="text-sm text-muted-foreground">Need Vaccination</p>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>
                ) : (
                  <Card className="border-border/50">
                    <CardContent className="py-10 text-center">
                      <p className="text-sm text-muted-foreground">
                        {latest.livestock || "No livestock data in this report."}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            )}

            {/* Finance Section */}
            {selectedSection === "finance" && (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
                <motion.div variants={itemVariants}>
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle>Weekly Financial Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {financial.income > 0 || financial.expenses > 0 ? (
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-4 rounded-xl bg-green-50 dark:bg-green-950/20">
                            <p className="text-sm text-muted-foreground">Income</p>
                            <p className="text-2xl font-bold text-green-600">{financial.income.toFixed(2)}</p>
                          </div>
                          <div className="text-center p-4 rounded-xl bg-red-50 dark:bg-red-950/20">
                            <p className="text-sm text-muted-foreground">Expenses</p>
                            <p className="text-2xl font-bold text-red-600">{financial.expenses.toFixed(2)}</p>
                          </div>
                          <div className="text-center p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                            <p className="text-sm text-muted-foreground">Net Profit</p>
                            <p className="text-2xl font-bold text-blue-600">{financial.profit.toFixed(2)}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground py-8 text-center">
                          No financial data was recorded for this week.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Report history */}
                <motion.div variants={itemVariants}>
                  <Card className="border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Report History</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {history && history.length > 0 ? (
                        history.map((report) => (
                          <div
                            key={report.id}
                            className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {new Date(report.generatedAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </p>
                                <p className="text-xs text-muted-foreground">Weekly report</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {report.overallHealth}% health
                            </Badge>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                          No previous reports yet.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            )}

            {/* Recommendations Section */}
            {selectedSection === "recommendations" && (
              <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
                {sortedRecommendations.length === 0 ? (
                  <Card className="border-border/50">
                    <CardContent className="py-10 text-center">
                      <Lightbulb className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No AI recommendations in this week's report.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  sortedRecommendations.map((rec, idx) => {
                    const isApplied = appliedRecs.has(rec.title);
                    return (
                      <motion.div key={`${rec.title}-${idx}`} variants={itemVariants}>
                        <Card className="border-border/50">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                rec.priority === "high"
                                  ? "bg-red-100"
                                  : rec.priority === "medium"
                                  ? "bg-amber-100"
                                  : "bg-blue-100"
                              }`}>
                                <Lightbulb className={`w-5 h-5 ${
                                  rec.priority === "high"
                                    ? "text-red-600"
                                    : rec.priority === "medium"
                                    ? "text-amber-600"
                                    : "text-blue-600"
                                }`} />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-medium">{rec.title}</h4>
                                  <Badge variant="outline" className={`text-xs ${
                                    rec.priority === "high"
                                      ? "text-red-600 border-red-500/30"
                                      : rec.priority === "medium"
                                      ? "text-amber-600 border-amber-500/30"
                                      : "text-blue-600 border-blue-500/30"
                                  }`}>
                                    {rec.priority} priority
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{rec.description}</p>
                                <div className="flex items-center gap-4 mt-2 text-sm">
                                  <span className="text-muted-foreground">{rec.confidence}% AI confidence</span>
                                  <span className="text-xs text-muted-foreground capitalize">{rec.category}</span>
                                </div>
                              </div>
                              <Button
                                variant={isApplied ? "ghost" : "outline"}
                                size="sm"
                                onClick={() => handleApply(rec)}
                                disabled={isApplied}
                              >
                                {isApplied ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4 mr-1 text-green-600" /> Added
                                  </>
                                ) : (
                                  <>
                                    Apply
                                    <ArrowRight className="w-4 h-4 ml-1" />
                                  </>
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
