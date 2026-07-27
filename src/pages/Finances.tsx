import { useState } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Download,
  PieChart,
  BarChart3,
  Calculator,
  Wallet,
  CreditCard,
  Receipt,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }, as const
};

const mockTransactions = [
  { id: "1", type: "income", category: "Harvest Sale", description: "Maize sale - 5 tons to cooperative", amount: 12000, currency: "KES", date: "2026-07-25", farm: "Sunrise Ranch" },
  { id: "2", type: "expense", category: "Seeds", description: "Bean seeds - Rose Coco variety", amount: 2500, currency: "KES", date: "2026-07-22", farm: "Green Valley Farm" },
  { id: "3", type: "income", category: "Dairy", description: "Milk sales - weekly collection", amount: 8500, currency: "KES", date: "2026-07-20", farm: "Sunrise Ranch" },
  { id: "4", type: "expense", category: "Fertilizer", description: "NPK fertilizer - 200kg", amount: 6800, currency: "KES", date: "2026-07-18", farm: "Green Valley Farm" },
  { id: "5", type: "expense", category: "Labor", description: "Farm workers wages - July", amount: 15000, currency: "KES", date: "2026-07-15", farm: "All Farms" },
  { id: "6", type: "income", category: "Eggs", description: "Egg sales - 30 trays", amount: 4500, currency: "KES", date: "2026-07-14", farm: "Green Valley Farm" },
  { id: "7", type: "expense", category: "Equipment", description: "Drip irrigation repair kit", amount: 3200, currency: "KES", date: "2026-07-10", farm: "Riverside Fields" },
  { id: "8", type: "income", category: "Livestock", description: "Goat sale - 2 head", amount: 18000, currency: "KES", date: "2026-07-08", farm: "Riverside Fields" },
];

export default function Finances() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");

  const totalIncome = mockTransactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalExpenses = mockTransactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  const filtered = mockTransactions.filter((t) => {
    const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || t.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || t.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Finances</h1>
              <p className="text-muted-foreground mt-1">Track income, expenses, and profitability</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline"><Download className="w-4 h-4 mr-2" />Export</Button>
              <Button className="gradient-primary"><Plus className="w-4 h-4 mr-2" />Add Transaction</Button>
            </div>
          </div>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
          {/* Financial Summary */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/50"><CardContent className="p-5 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-500"><TrendingUp className="w-6 h-6 text-white" /></div>
              <div><p className="text-sm text-muted-foreground">Total Income</p><p className="text-2xl font-bold text-green-600">KES {totalIncome.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-5 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500"><TrendingDown className="w-6 h-6 text-white" /></div>
              <div><p className="text-sm text-muted-foreground">Total Expenses</p><p className="text-2xl font-bold text-red-600">KES {totalExpenses.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-5 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-blue-500"><Wallet className="w-6 h-6 text-white" /></div>
              <div><p className="text-sm text-muted-foreground">Net Profit</p><p className={`text-2xl font-bold ${netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>KES {netProfit.toLocaleString()}</p></div>
            </CardContent></Card>
            <Card className="border-border/50"><CardContent className="p-5 flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-500"><Calculator className="w-6 h-6 text-white" /></div>
              <div><p className="text-sm text-muted-foreground">Profit Margin</p><p className="text-2xl font-bold">{((netProfit / totalIncome) * 100).toFixed(1)}%</p></div>
            </CardContent></Card>
          </motion.div>

          {/* Filters */}
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search transactions..." className="pl-10" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <div className="flex gap-2">
              {(["all", "income", "expense"] as const).map((type) => (
                <Button key={type} variant={filterType === type ? "default" : "outline"} size="sm" onClick={() => setFilterType(type)} className="capitalize">{type}</Button>
              ))}
            </div>
          </motion.div>

          {/* Transactions Table */}
          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filtered.map((txn) => (
                    <div key={txn.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${txn.type === "income" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                        {txn.type === "income" ? <ArrowUpRight className="w-5 h-5 text-green-600" /> : <ArrowDownRight className="w-5 h-5 text-red-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{txn.description}</p>
                        <p className="text-xs text-muted-foreground">{txn.category} • {txn.farm} • {txn.date}</p>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${txn.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        {txn.type === "income" ? "+" : "-"}KES {txn.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>
    </AppLayout>
  );
}
