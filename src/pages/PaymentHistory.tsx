import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import {
  CreditCard,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Receipt,
  ArrowUpRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Shield,
  Smartphone,
  CalendarClock,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router";

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

// ============================================================
// Helpers — real data formatting only (no fabricated values)
// ============================================================

const formatDate = (timestamp?: number | null) => {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${amount} ${currency || ""}`.trim();
  }
};

const providerLabel = (provider: string) => {
  if (provider === "mtn_momo") return "MTN Mobile Money";
  if (provider === "airtel_money") return "Airtel Money";
  return provider;
};

const purposeLabel = (purpose?: string) => {
  if (purpose === "consultation") return "Agronomist consultation";
  if (purpose === "subscription") return "Pro subscription";
  return "Payment";
};

const paymentStatusConfig: Record<string, { color: string; icon: LucideIcon; label: string }> = {
  completed: { color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2, label: "Completed" },
  pending: { color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock, label: "Pending" },
  failed: { color: "bg-red-500/10 text-red-600 border-red-500/20", icon: XCircle, label: "Failed" },
  expired: { color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: Clock, label: "Expired" },
};

// ============================================================
// Payment Record Card (real mobile-money payment records)
// ============================================================

interface PaymentRecord {
  _id: string;
  provider: string;
  referenceId?: string | null;
  purpose?: string;
  description?: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  status: string;
  completedAt?: number;
  createdAt: number;
}

function PaymentRecordCard({ payment }: { payment: PaymentRecord }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const config = paymentStatusConfig[payment.status] || {
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    icon: Clock,
    label: payment.status || "Unknown",
  };
  const StatusIcon = config.icon;

  return (
    <motion.div
      variants={itemVariants}
      className="border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-colors"
    >
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Icon */}
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50 shrink-0">
          <Smartphone className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{purposeLabel(payment.purpose)}</p>
            <Badge className={`${config.color} border text-[10px]`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {config.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {providerLabel(payment.provider)} • {formatDate(payment.completedAt || payment.createdAt)}
          </p>
        </div>

        {/* Amount */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-lg font-bold">{formatCurrency(payment.amount, payment.currency)}</p>
            <p className="text-xs text-muted-foreground">{payment.currency}</p>
          </div>
          <button
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            aria-label={isExpanded ? "Collapse payment details" : "Expand payment details"}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-muted/20">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Details</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span>{providerLabel(payment.provider)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono text-xs">{payment.referenceId || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span>{payment.phoneNumber || "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span>{config.label}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Purpose</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span>{payment.description || purposeLabel(payment.purpose)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started</span>
                  <span>{formatDate(payment.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completed</span>
                  <span>{payment.completedAt ? formatDate(payment.completedAt) : "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================
// Subscription Event Card (derived from real user fields)
// ============================================================

const SUBSCRIPTION_EVENT_ICONS: Record<string, LucideIcon> = {
  started: CheckCircle2,
  renewed: RefreshCw,
  payment_failed: AlertTriangle,
  active: ArrowUpRight,
};

const SUBSCRIPTION_EVENT_COLORS: Record<string, string> = {
  started: "bg-green-500/10 text-green-600",
  renewed: "bg-blue-500/10 text-blue-600",
  payment_failed: "bg-red-500/10 text-red-600",
  active: "bg-green-500/10 text-green-600",
};

function SubscriptionEventCard({ event }: { event: { type: string; description: string; date?: number; details?: string } }) {
  const Icon = SUBSCRIPTION_EVENT_ICONS[event.type] || CheckCircle2;
  const color = SUBSCRIPTION_EVENT_COLORS[event.type] || "bg-gray-500/10 text-gray-600";

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-border/50">
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${color} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{event.description}</p>
        {event.date && <p className="text-xs text-muted-foreground mt-1">{formatDate(event.date)}</p>}
        {event.details && <p className="text-xs text-muted-foreground mt-1">{event.details}</p>}
      </div>
    </div>
  );
}

// ============================================================
// Main Payment History Page
// ============================================================

export default function PaymentHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("payments");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // Real billing data — every value below comes from the backend:
  // - stripe.getStripeStatus     → Stripe subscription state
  // - users.currentUser          → plan, trial, payment method, failures
  // - mobileMoney.getUserTransactions → real completed/pending/failed payments
  const stripeStatus = useQuery(api.stripe.getStripeStatus);
  const payments = useQuery(api.mobileMoney.getUserTransactions);
  // Trial/subscription activity is computed server-side — the client never
  // derives "now" or payment states itself.
  const subStatus = useQuery(api.subscriptions.getSubscriptionStatus);
  const trialStatus = useQuery(api.trials.getTrialStatus);

  const isLoading =
    stripeStatus === undefined ||
    payments === undefined ||
    subStatus === undefined ||
    trialStatus === undefined;

  // Real subscription plan (trial activity comes from the server)
  const tier = user?.subscriptionTier || "free";
  const isOnTrial = !!trialStatus?.isTrialActive;
  const planLabel = tier === "pro" ? "Pro" : isOnTrial ? "Free Trial" : "Free";

  // Real renewal/period dates
  const nextBillingDate =
    stripeStatus?.stripeCurrentPeriodEnd ||
    subStatus?.subscriptionEndDate ||
    trialStatus?.trialEndDate ||
    null;

  // Real payment-method state (we never store card numbers — just whether one is verified)
  const hasPaymentMethod = !!stripeStatus?.hasPaymentMethod || !!user?.paymentMethodVerified;

  // Real payment-failure state
  const failureCount = stripeStatus?.paymentFailureCount ?? user?.paymentFailureCount ?? 0;
  const lastFailureAt = stripeStatus?.paymentFailedAt ?? user?.paymentFailedAt ?? null;

  // Filter real payment records
  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    const q = searchQuery.trim().toLowerCase();
    return payments.filter((p) => {
      const matchesStatus = filterStatus === "all" || p.status === filterStatus;
      if (!matchesStatus) return false;
      if (!q) return true;
      return (
        (p.referenceId || "").toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q) ||
        providerLabel(p.provider).toLowerCase().includes(q) ||
        purposeLabel(p.purpose).toLowerCase().includes(q)
      );
    });
  }, [payments, searchQuery, filterStatus]);

  // Subscription timeline — every entry is derived from real stored fields.
  // No invoice numbers, amounts, card numbers, or invented dates.
  const subscriptionEvents = useMemo(() => {
    const events: { type: string; description: string; date?: number; details?: string }[] = [];

    if (trialStatus?.trialEndDate) {
      events.push({
        type: "started",
        description: "Free trial started",
        date: trialStatus.trialEndDate,
        details: isOnTrial ? "Free trial active" : "Free trial ended",
      });
    }

    if (user?.subscriptionTier === "pro") {
      if (subStatus?.subscriptionStartDate) {
        events.push({
          type: "started",
          description: "Pro subscription started",
          date: subStatus.subscriptionStartDate,
        });
      } else {
        events.push({ type: "active", description: "Pro subscription active" });
      }
      const periodEnd = subStatus?.subscriptionEndDate || stripeStatus?.stripeCurrentPeriodEnd;
      if (periodEnd) {
        events.push({
          type: "renewed",
          description: "Current billing period",
          date: periodEnd,
          details: "Pro access continues until this date",
        });
      }
    }

    if (lastFailureAt) {
      events.push({
        type: "payment_failed",
        description: "Payment attempt failed",
        date: lastFailureAt,
        details: `${failureCount} consecutive failed ${failureCount === 1 ? "attempt" : "attempts"}`,
      });
    }

    return events;
  }, [user, lastFailureAt, failureCount, stripeStatus, subStatus, trialStatus, isOnTrial]);

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
              <h1 className="text-3xl font-bold tracking-tight">Payment History</h1>
              <p className="text-muted-foreground mt-1">
                Your plan, payment method, and billing records
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stats Cards — derived from real backend state only */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {[
            {
              label: "Plan",
              value: planLabel,
              icon: Wallet,
              color: "bg-green-500",
              trend: tier === "pro" ? "Active" : isOnTrial ? "Trial active" : "Free plan",
            },
            {
              label: nextBillingDate ? "Period ends" : "Period",
              value: nextBillingDate ? formatDate(nextBillingDate) : "—",
              icon: CalendarClock,
              color: "bg-blue-500",
              trend: subStatus?.isActive
                ? "Pro access active"
                : isOnTrial
                  ? "Trial active"
                  : nextBillingDate
                    ? "Period recorded"
                    : "No active billing period",
            },
            {
              label: "Payment method",
              value: hasPaymentMethod ? "On file" : "None",
              icon: CreditCard,
              color: "bg-purple-500",
              trend: hasPaymentMethod ? "Verified with provider" : "No card or wallet on file",
            },
            {
              label: "Payment failures",
              value: failureCount > 0 ? failureCount.toString() : "None",
              icon: AlertTriangle,
              color: failureCount > 0 ? "bg-red-500" : "bg-amber-500",
              trend: lastFailureAt ? `Last failed ${formatDate(lastFailureAt)}` : "No failures recorded",
            },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div key={i} variants={itemVariants}>
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-bold mt-1">{stat.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{stat.trend}</p>
                      </div>
                      <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${stat.color}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Main Content */}
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="h-auto p-1 bg-muted/50 flex flex-wrap">
              <TabsTrigger value="payments" className="gap-2">
                <Receipt className="w-4 h-4" />
                <span className="hidden sm:inline">Payments</span>
              </TabsTrigger>
              <TabsTrigger value="payment-methods" className="gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">Payment Methods</span>
              </TabsTrigger>
              <TabsTrigger value="subscription" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Subscription</span>
              </TabsTrigger>
            </TabsList>

            {/* Payments Tab — real payment records only */}
            <TabsContent value="payments">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Payments</CardTitle>
                      <CardDescription>Your payment records from mobile money (MTN / Airtel)</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search payments..."
                          className="pl-9 h-9 w-48"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="h-9 px-3 text-sm bg-muted/50 rounded-lg border-0 focus:ring-2 focus:ring-primary/20"
                        aria-label="Filter by status"
                      >
                        <option value="all">All Status</option>
                        <option value="completed">Completed</option>
                        <option value="pending">Pending</option>
                        <option value="failed">Failed</option>
                        <option value="expired">Expired</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="text-sm">Loading payment records...</p>
                    </div>
                  ) : filteredPayments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Receipt className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-medium">No payment history yet.</p>
                      <p className="text-xs mt-1 max-w-sm mx-auto">
                        Payments will appear here after you complete a payment — for example a Pro
                        subscription or an agronomist consultation.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredPayments.map((payment) => (
                        <PaymentRecordCard key={payment._id} payment={payment} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment Methods Tab — honest state, no stored card numbers */}
            <TabsContent value="payment-methods">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Payment Methods</CardTitle>
                  <CardDescription>Your payment method on file</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <p className="text-sm">Loading payment method...</p>
                    </div>
                  ) : hasPaymentMethod ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-border/50 bg-muted/20">
                      <div className="flex items-center justify-center w-12 h-8 rounded-lg bg-green-600 text-white text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Payment method on file</p>
                        <p className="text-xs text-muted-foreground">
                          Verified with your payment provider. Card details are never stored by FarmBond.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-muted-foreground">
                      <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-medium">No payment method on file</p>
                      <p className="text-xs mt-1">
                        A payment method is added when you subscribe to Pro. FarmBond never stores your
                        full card details.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                    <Shield className="w-4 h-4" />
                    <span>
                      Your payment information is handled securely by your payment provider. We never
                      store full card numbers.
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Subscription Tab — real plan state and real events */}
            <TabsContent value="subscription">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Subscription</CardTitle>
                  <CardDescription>Your current plan and subscription activity</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20 mb-4">
                    <div>
                      <p className="text-sm font-medium">{planLabel} plan</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {nextBillingDate
                          ? `Current period ends ${formatDate(nextBillingDate)}`
                          : "No active billing period"}
                      </p>
                    </div>
                    <Badge className={tier === "pro" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}>
                      {tier === "pro" ? "Active" : isOnTrial ? "Trial" : "Free"}
                    </Badge>
                  </div>

                  {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Loading subscription...</p>
                    </div>
                  ) : subscriptionEvents.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-40" />
                      <p className="text-sm font-medium">No subscription activity yet</p>
                      <p className="text-xs mt-1">Your subscription changes will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {subscriptionEvents.map((event, i) => (
                        <SubscriptionEventCard key={i} event={event} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Help Section */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="mt-8"
        >
          <Card className="border-border/50 bg-muted/20">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 shrink-0">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium">Need help with billing?</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Contact our support team for billing inquiries, refund requests, or payment issues.
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/support")}>
                  Contact Support
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}
