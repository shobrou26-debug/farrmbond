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
  AlertTriangle,
  CheckCircle2,
  Clock,
  BarChart3,
  Settings,
  Bell,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  Server,
  Database,
  Wifi,
  Cpu,
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
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">System overview and management</p>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
          {/* Key Metrics */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "Total Users", value: "12,847", change: "+324 this month", trend: "up", icon: Users, color: "bg-blue-500" },
              { title: "Monthly Revenue", value: "$48,250", change: "+18.2%", trend: "up", icon: DollarSign, color: "bg-green-500" },
              { title: "Active Subscriptions", value: "3,421", change: "+156 this week", trend: "up", icon: TrendingUp, color: "bg-purple-500" },
              { title: "Support Tickets", value: "47", change: "-12 from yesterday", trend: "down", icon: AlertTriangle, color: "bg-amber-500" },
            ].map((metric, i) => {
              const Icon = metric.icon;
              return (
                <Card key={i} className="border-border/50 card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">{metric.title}</p>
                        <p className="text-2xl font-bold">{metric.value}</p>
                        <div className="flex items-center gap-1">
                          {metric.trend === "up" ? <ArrowUpRight className="w-3.5 h-3.5 text-green-500" /> : <ArrowDownRight className="w-3.5 h-3.5 text-green-500" />}
                          <span className="text-xs text-green-500">{metric.change}</span>
                        </div>
                      </div>
                      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${metric.color}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* System Health */}
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card className="border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-base">System Health</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "API Status", status: "Operational", icon: Server, ok: true },
                      { label: "Database", status: "Healthy", icon: Database, ok: true },
                      { label: "CDN", status: "Operational", icon: Wifi, ok: true },
                      { label: "AI Services", status: "Operational", icon: Cpu, ok: true },
                    ].map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <div key={i} className="p-3 rounded-xl bg-muted/30 text-center">
                          <Icon className="w-5 h-5 mx-auto text-muted-foreground mb-2" />
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <div className="flex items-center justify-center gap-1 mt-1">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            <span className="text-xs font-medium text-green-600">{item.status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Quick Actions */}
            <motion.div variants={itemVariants}>
              <Card className="border-border/50">
                <CardHeader className="pb-3"><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {[
                    { label: "Manage Users", icon: Users },
                    { label: "View Revenue", icon: DollarSign },
                    { label: "Support Tickets", icon: FileText },
                    { label: "Announcements", icon: Bell },
                    { label: "Audit Logs", icon: Shield },
                    { label: "Settings", icon: Settings },
                  ].map((action, i) => {
                    const Icon = action.icon;
                    return (
                      <Button key={i} variant="ghost" className="w-full justify-start">
                        <Icon className="w-4 h-4 mr-2" />{action.label}
                      </Button>
                    );
                  })}
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
                  { action: "New user registered", user: "John Kamau", time: "2 min ago", type: "user" },
                  { action: "Subscription upgraded to Pro", user: "Mary Wanjiru", time: "15 min ago", type: "subscription" },
                  { action: "Support ticket resolved", user: "Ticket #1247", time: "1 hour ago", type: "support" },
                  { action: "New agronomist application", user: "Dr. Peter Odhiambo", time: "3 hours ago", type: "agronomist" },
                  { action: "Payment received", user: "$29.99 - Pro Plan", time: "5 hours ago", type: "payment" },
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
