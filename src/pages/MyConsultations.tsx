import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Video,
  MessageSquare,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Star,
  Filter,
  Loader2,
  CalendarCheck,
  CalendarX,
  History,
} from "lucide-react";
import { motion } from "framer-motion";

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function MyConsultations() {
  const [activeTab, setActiveTab] = useState<"upcoming" | "past" | "all">("upcoming");

  const consultations = useQuery(api.marketplace.listUserConsultations);

  const isLoading = consultations === undefined;

  // Filter consultations by tab
  const now = Date.now();
  const filtered = (consultations ?? []).filter((c) => {
    if (activeTab === "upcoming") {
      return c.scheduledAt > now && c.status !== "cancelled";
    }
    if (activeTab === "past") {
      return c.scheduledAt <= now || c.status === "completed" || c.status === "cancelled";
    }
    return true;
  });

  const upcomingCount = (consultations ?? []).filter(
    (c) => c.scheduledAt > now && c.status !== "cancelled"
  ).length;

  const completedCount = (consultations ?? []).filter(
    (c) => c.status === "completed"
  ).length;

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
              <h1 className="text-3xl font-bold tracking-tight">My Consultations</h1>
              <p className="text-muted-foreground mt-1">
                View and manage your agronomist consultations
              </p>
            </div>
            <div className="flex gap-3">
              <Badge variant="secondary" className="text-sm">
                <CalendarCheck className="w-4 h-4 mr-1 text-blue-500" />
                {isLoading ? "..." : `${upcomingCount} Upcoming`}
              </Badge>
              <Badge variant="secondary" className="text-sm">
                <CheckCircle2 className="w-4 h-4 mr-1 text-green-500" />
                {isLoading ? "..." : `${completedCount} Completed`}
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["upcoming", "past", "all"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab === "upcoming" ? "Upcoming" : tab === "past" ? "Past" : "All"}
            </button>
          ))}
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-border/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                    <div className="space-y-2 flex-1">
                      <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="h-3 w-full bg-muted rounded animate-pulse" />
                  <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filtered.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No consultations yet</h3>
              <p className="text-muted-foreground mb-6">
                {activeTab === "upcoming"
                  ? "You don't have any upcoming consultations. Book one with an agronomist to get started."
                  : "No consultations found in this category."}
              </p>
              <Button onClick={() => window.location.href = "/marketplace"} className="gradient-primary">
                Browse Agronomists
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Consultation Cards */}
        {!isLoading && filtered.length > 0 && (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filtered.map((consultation) => {
              const status = statusConfig[consultation.status] ?? statusConfig.pending;
              const StatusIcon = status.icon;
              const date = new Date(consultation.scheduledAt);
              const isUpcoming = consultation.scheduledAt > now;
              const isPast = consultation.scheduledAt <= now;

              return (
                <motion.div key={consultation._id} variants={itemVariants}>
                  <Card className="border-border/50 hover:shadow-lg transition-all h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                            {(consultation as any).agronomistImage ? (
                              <img
                                src={(consultation as any).agronomistImage}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-primary" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {(consultation as any).agronomistName ?? "Agronomist"}
                            </p>
                            <p className="text-sm text-muted-foreground capitalize">
                              {consultation.serviceType?.replace(/_/g, " ") ?? "Consultation"}
                            </p>
                          </div>
                        </div>
                        <Badge className={status.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>
                          {date.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>
                          {date.toLocaleTimeString("en-US", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {" "}({consultation.duration} min)
                        </span>
                      </div>

                      {consultation.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {consultation.notes}
                        </p>
                      )}

                      <div className="flex justify-between items-center pt-2 border-t border-border">
                        <span className="font-semibold text-primary">
                          KES {(consultation.amount ?? 0).toLocaleString()}
                        </span>
                        {isUpcoming && consultation.status === "pending" && (
                          <Badge variant="outline" className="text-xs">
                            Awaiting Confirmation
                          </Badge>
                        )}
                        {isUpcoming && consultation.status === "confirmed" && (
                          <Button size="sm" className="gradient-primary">
                            <Video className="w-3 h-3 mr-1" />
                            Join
                          </Button>
                        )}
                        {isPast && consultation.status === "completed" && (
                          <Button size="sm" variant="outline">
                            <Star className="w-3 h-3 mr-1" />
                            Rate
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>
    </AppLayout>
  );
}
