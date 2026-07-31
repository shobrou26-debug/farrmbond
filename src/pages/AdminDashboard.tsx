import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  Shield,
  ArrowUpRight,
  ArrowDownRight,
  Server,
  Database,
  Wifi,
  Cpu,
  Sprout,
  BookOpen,
  RefreshCw,
  Settings,
  FileText,
  Bell,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seedingKb, setSeedingKb] = useState(false);
  const [kbResult, setKbResult] = useState<string | null>(null);
  const seedMarketplace = useMutation(api.seedData.seedMarketplace);
  const seedKnowledgeArticles = useMutation(api.seedData.seedKnowledgeArticles);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const result = await seedMarketplace();
      setSeedResult(
        `Seeded: ${result.agronomists} agronomists, ${result.companies} companies, ${result.seeds} seeds`
      );
    } catch (err) {
      setSeedResult("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSeeding(false);
    }
  };

  const handleSeedKb = async () => {
    setSeedingKb(true);
    setKbResult(null);
    try {
      const result = await seedKnowledgeArticles();
      setKbResult(result.message);
    } catch (err) {
      setKbResult("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSeedingKb(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-muted-foreground mt-1">Manage your FarmBond platform</p>
            </div>
            <Badge variant="secondary" className="text-sm w-fit">
              <Shield className="w-4 h-4 mr-1 text-green-500" />
              Super Admin
            </Badge>
          </div>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Users", value: "2,847", change: "+12.5%", up: true, icon: Users, color: "text-blue-500" },
              { label: "Monthly Revenue", value: "$45,280", change: "+8.2%", up: true, icon: DollarSign, color: "text-green-500" },
              { label: "Active Subscriptions", value: "1,432", change: "+5.3%", up: true, icon: TrendingUp, color: "text-purple-500" },
              { label: "Support Tickets", value: "23", change: "-15%", up: false, icon: Activity, color: "text-amber-500" },
            ].map((stat, i) => (
              <motion.div key={i} variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-bold mt-1">{stat.value}</p>
                      </div>
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      {stat.up ? (
                        <ArrowUpRight className="w-3 h-3 text-green-500" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3 text-red-500" />
                      )}
                      <span className={`text-xs font-medium ${stat.up ? "text-green-500" : "text-red-500"}`}>
                        {stat.change}
                      </span>
                      <span className="text-xs text-muted-foreground">vs last month</span>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* System Health, Quick Actions & Seed Data */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={itemVariants}>
              <Card className="border-border/50 h-full">
                <CardHeader className="pb-3"><CardTitle className="text-base">System Health</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "API Server", status: "Operational", icon: Server, ok: true },
                    { label: "Database", status: "Operational", icon: Database, ok: true },
                    { label: "CDN", status: "Operational", icon: Wifi, ok: true },
                    { label: "AI Services", status: "Operational", icon: Cpu, ok: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
                      <div className="flex items-center gap-2">
                        <item.icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <Badge variant={item.ok ? "default" : "destructive"} className="text-xs">
                        {item.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-border/50 h-full">
                <CardHeader className="pb-3"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "Manage Users", icon: Users },
                    { label: "Review Reports", icon: FileText },
                    { label: "System Settings", icon: Settings },
                    { label: "Send Announcements", icon: Bell },
                    { label: "Seed Management", icon: Sprout, href: "/admin/seeds" },
                  ].map((action, i) => {
                    const Icon = action.icon;
                    return (
                      <Button key={i} variant="ghost" className="w-full justify-start" onClick={() => navigate((action as any).href || "/")}>
                        <Icon className="w-4 h-4 mr-2" />{action.label}
                      </Button>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-border/50 h-full">
                <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Sprout className="w-4 h-4 text-green-500" /> Data Management</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Seed sample data for the marketplace and knowledge base.
                  </p>
                  <Button
                    onClick={handleSeed}
                    disabled={seeding}
                    className="w-full gradient-primary"
                  >
                    {seeding ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Seeding...</>
                    ) : (
                      <><Sprout className="w-4 h-4 mr-2" /> Seed Marketplace</>
                    )}
                  </Button>
                  {seedResult && (
                    <p className={"text-sm " + (seedResult.startsWith("Error") ? "text-red-500" : "text-green-600")}>
                      {seedResult}
                    </p>
                  )}
                  <Button
                    onClick={handleSeedKb}
                    disabled={seedingKb}
                    variant="outline"
                    className="w-full"
                  >
                    {seedingKb ? (
                      <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Seeding...</>
                    ) : (
                      <><BookOpen className="w-4 h-4 mr-2" /> Seed Knowledge Articles</>
                    )}
                  </Button>
                  {kbResult && (
                    <p className={"text-sm " + (kbResult.startsWith("Error") ? "text-red-500" : "text-green-600")}>
                      {kbResult}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Recent Activity */}
          <motion.div variants={itemVariants}>
            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-base">Recent Activity</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {[
                  { action: "New user registered", user: "John Kamau", time: "2 min ago" },
                  { action: "Subscription upgraded to Pro", user: "Mary Wanjiru", time: "15 min ago" },
                  { action: "Support ticket resolved", user: "Ticket #1247", time: "1 hour ago" },
                  { action: "New agronomist application", user: "Dr. Peter Odhiambo", time: "3 hours ago" },
                  { action: "Payment received", user: "$29.99 - Pro Plan", time: "5 hours ago" },
                ].map((activity, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.action}</p>
                      <p className="text-xs text-muted-foreground">{activity.user}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
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
