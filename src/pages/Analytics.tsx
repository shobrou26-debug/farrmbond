import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  Leaf,
  Beef,
  DollarSign,
  Droplets,
  ArrowUpRight,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// Mock chart data
const monthlyData = [
  { month: "Jan", income: 18000, expenses: 12000 },
  { month: "Feb", income: 22000, expenses: 14000 },
  { month: "Mar", income: 28000, expenses: 16000 },
  { month: "Apr", income: 35000, expenses: 18000 },
  { month: "May", income: 32000, expenses: 15000 },
  { month: "Jun", income: 42000, expenses: 20000 },
  { month: "Jul", income: 38000, expenses: 17000 },
];

const maxVal = Math.max(...monthlyData.map((d) => Math.max(d.income, d.expenses)));

export default function Analytics() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
              <p className="text-muted-foreground mt-1">Insights and performance metrics for your farms</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline"><Calendar className="w-4 h-4 mr-2" />Last 30 Days</Button>
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Export Report</Button>
            </div>
          </div>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
          {/* Summary Cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Total Revenue", value: "$215,000", change: "+23.5%", icon: DollarSign, color: "bg-green-500" },
              { title: "Crop Yield", value: "18.5 tons", change: "+12.8%", icon: Leaf, color: "bg-emerald-500" },
              { title: "Livestock Health", value: "94%", change: "+2.1%", icon: Beef, color: "bg-amber-500" },
              { title: "Water Usage", value: "45,200 L", change: "-15.3%", icon: Droplets, color: "bg-blue-500" },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <Card key={i} className="border-border/50 card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{stat.title}</p>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <div className="flex items-center gap-1">
                          {stat.change.startsWith("+") ? <TrendingUp className="w-3.5 h-3.5 text-green-500" /> : <TrendingDown className="w-3.5 h-3.5 text-green-500" />}
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
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Revenue Chart */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Revenue vs Expenses</CardTitle>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Income</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" />Expenses</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-2 h-48">
                    {monthlyData.map((d, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full flex gap-0.5 items-end justify-center" style={{ height: "160px" }}>
                          <div
                            className="w-3 bg-green-500 rounded-t-sm transition-all duration-500"
                            style={{ height: `${(d.income / maxVal) * 100}%` }}
                          />
                          <div
                            className="w-3 bg-red-400/70 rounded-t-sm transition-all duration-500"
                            style={{ height: `${(d.expenses / maxVal) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{d.month}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Crop Performance */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-base">Crop Performance</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: "Tomatoes", yield: "2,400 kg", target: "2,500 kg", progress: 96 },
                    { name: "Maize", yield: "7,800 kg", target: "8,000 kg", progress: 97.5 },
                    { name: "Beans", yield: "1,100 kg", target: "1,200 kg", progress: 91.7 },
                    { name: "Kale", yield: "750 kg", target: "800 kg", progress: 93.8 },
                  ].map((crop, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{crop.name}</span>
                        <span className="text-muted-foreground">{crop.yield} / {crop.target}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-green-500 to-emerald-500 rounded-full transition-all duration-700" style={{ width: `${crop.progress}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Top Insights */}
          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-base">Key Insights & Recommendations</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: "Best Performing Crop", desc: "Tomatoes generated 42% of total income. Consider expanding tomato cultivation.", badge: "Revenue", color: "bg-green-500/10 text-green-600" },
                  { title: "Cost Optimization", desc: "Fertilizer costs increased 15%. Consider organic alternatives or bulk purchasing.", badge: "Savings", color: "bg-amber-500/10 text-amber-600" },
                  { title: "Water Efficiency", desc: "Drip irrigation reduced water usage by 32%. Apply same strategy to other farms.", badge: "Efficiency", color: "bg-blue-500/10 text-blue-600" },
                ].map((insight, i) => (
                  <div key={i} className="p-4 rounded-xl bg-muted/30 space-y-2">
                    <Badge className={insight.color}>{insight.badge}</Badge>
                    <h4 className="text-sm font-semibold">{insight.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{insight.desc}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
