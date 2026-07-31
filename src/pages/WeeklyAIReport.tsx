import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Download,
  Sprout,
  Beef,
  Cloud,
  DollarSign,
  Calendar,
  Lightbulb,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const mockReport = {
  weekRange: "Jul 21 - Jul 27, 2026",
  summary: {
    totalFarms: 3,
    totalLivestock: 145,
    totalCrops: 12,
    healthScore: 87,
    financialSummary: {
      income: 45000,
      expenses: 12500,
      profit: 32500,
      profitMargin: 72,
    },
  },
  highlights: [
    {
      type: "success",
      title: "Vaccination Complete",
      description: "All 45 cattle at Kiambu Farm received FMD vaccination. Coverage now at 95%.",
      confidence: 98,
    },
    {
      type: "warning",
      title: "Low Crop Yield Detected",
      description: "Maize Section B shows 15% lower growth rate. Possible nitrogen deficiency detected.",
      confidence: 82,
    },
    {
      type: "info",
      title: "Weather Advisory",
      description: "Heavy rains expected next week. Consider delaying planting of Section C.",
      confidence: 91,
    },
  ],
  cropHealth: [
    { name: "Maize Field A", status: "healthy", trend: "up", confidence: 94 },
    { name: "Maize Section B", status: "warning", trend: "down", confidence: 78 },
    { name: "Coffee Plot", status: "healthy", trend: "up", confidence: 92 },
    { name: "Vegetable Garden", status: "healthy", trend: "stable", confidence: 88 },
  ],
  livestockHealth: [
    { name: "Kiambu Cattle", status: "healthy", vaccinated: 95, lastCheckup: "2 days ago" },
    { name: "Nyeri Goats", status: "healthy", vaccinated: 88, lastCheckup: "5 days ago" },
    { name: "Nakuru Poultry", status: "monitoring", vaccinated: 72, lastCheckup: "1 day ago" },
  ],
  recommendations: [
    {
      priority: "high",
      title: "Apply Nitrogen Fertilizer to Section B",
      description: "Based on NDVI analysis and soil data, Section B needs immediate nitrogen application.",
      expectedImpact: "+20% yield recovery",
      confidence: 85,
    },
    {
      priority: "medium",
      title: "Schedule Newcastle Vaccination for Poultry",
      description: "It's been 4 months since last Newcastle vaccination. Due now.",
      expectedImpact: "Prevent disease outbreak",
      confidence: 96,
    },
    {
      priority: "low",
      title: "Update Irrigation Schedule",
      description: "With expected rainfall, reduce irrigation for outdoor plots next week.",
      expectedImpact: "Save 30% water costs",
      confidence: 88,
    },
  ],
  financialTrend: [
    { week: "Jun 30", income: 38000, expenses: 15000 },
    { week: "Jul 7", income: 42000, expenses: 11000 },
    { week: "Jul 14", income: 39500, expenses: 13000 },
    { week: "Jul 21", income: 45000, expenses: 12500 },
  ],
};

export default function WeeklyAIReport() {
  const [selectedSection, setSelectedSection] = useState<"overview" | "crops" | "livestock" | "finance" | "recommendations">("overview");

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
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Weekly AI Report</h1>
              <p className="text-muted-foreground mt-1">
                AI-generated insights and recommendations for the week of {mockReport.weekRange}
              </p>
            </div>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </motion.div>

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
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-6"
          >
            {/* Summary Stats */}
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
                        <p className="text-2xl font-bold">{mockReport.summary.healthScore}%</p>
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
                          +KES {mockReport.summary.financialSummary.profit.toLocaleString()}
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
                        <p className="text-sm text-muted-foreground">Active Crops</p>
                        <p className="text-2xl font-bold">{mockReport.summary.totalCrops}</p>
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
                        <p className="text-2xl font-bold">{mockReport.summary.totalLivestock}</p>
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
                  {mockReport.highlights.map((highlight, idx) => (
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
                        <Badge variant="outline" className="text-xs">
                          {highlight.confidence}% confidence
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}

        {/* Crops Section */}
        {selectedSection === "crops" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
            {mockReport.cropHealth.map((crop, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Sprout className="w-5 h-5 text-green-600" />
                        <div>
                          <h4 className="font-medium">{crop.name}</h4>
                          <p className="text-sm text-muted-foreground capitalize">Status: {crop.status}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge
                          variant="outline"
                          className={
                            crop.status === "healthy"
                              ? "text-green-600 border-green-500/30"
                              : crop.status === "warning"
                              ? "text-amber-600 border-amber-500/30"
                              : "text-red-600 border-red-500/30"
                          }
                        >
                          {crop.status === "healthy" ? "Healthy" : crop.status === "warning" ? "Needs Attention" : "Critical"}
                        </Badge>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">AI Confidence</p>
                          <p className="font-medium">{crop.confidence}%</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Livestock Section */}
        {selectedSection === "livestock" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
            {mockReport.livestockHealth.map((animal, idx) => (
              <motion.div key={idx} variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Beef className="w-5 h-5 text-amber-600" />
                        <div>
                          <h4 className="font-medium">{animal.name}</h4>
                          <p className="text-sm text-muted-foreground">Last checkup: {animal.lastCheckup}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Vaccination Rate</p>
                          <p className="font-medium">{animal.vaccinated}%</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            animal.status === "healthy"
                              ? "text-green-600 border-green-500/30"
                              : "text-amber-600 border-amber-500/30"
                          }
                        >
                          {animal.status === "healthy" ? "Healthy" : "Monitoring"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
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
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="text-center p-4 rounded-xl bg-green-50 dark:bg-green-950/20">
                      <p className="text-sm text-muted-foreground">Income</p>
                      <p className="text-2xl font-bold text-green-600">
                        KES {mockReport.summary.financialSummary.income.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-red-50 dark:bg-red-950/20">
                      <p className="text-sm text-muted-foreground">Expenses</p>
                      <p className="text-2xl font-bold text-red-600">
                        KES {mockReport.summary.financialSummary.expenses.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-center p-4 rounded-xl bg-blue-50 dark:bg-blue-950/20">
                      <p className="text-sm text-muted-foreground">Profit Margin</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {mockReport.summary.financialSummary.profitMargin}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        )}

        {/* Recommendations Section */}
        {selectedSection === "recommendations" && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4">
            {mockReport.recommendations.map((rec, idx) => (
              <motion.div key={idx} variants={itemVariants}>
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
                        <div className="flex items-center gap-2">
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
                          <span className="text-green-600 font-medium">{rec.expectedImpact}</span>
                          <span className="text-muted-foreground">{rec.confidence}% AI confidence</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Apply
                        <ArrowRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
