import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useAction } from "convex/react";
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
  Download,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Receipt,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Eye,
  Copy,
  Mail,
  Shield,
  Edit,
} from "lucide-react";

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
// Invoice Card Component
// ============================================================

function InvoiceCard({ invoice, onDownload }: { invoice: any; onDownload: (id: string) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
    paid: { color: "bg-green-500/10 text-green-600 border-green-500/20", icon: CheckCircle2, label: "Paid" },
    open: { color: "bg-amber-500/10 text-amber-600 border-amber-500/20", icon: Clock, label: "Pending" },
    void: { color: "bg-gray-500/10 text-gray-600 border-gray-500/20", icon: XCircle, label: "Void" },
    draft: { color: "bg-blue-500/10 text-blue-600 border-blue-500/20", icon: FileText, label: "Draft" },
  };

  const status = statusConfig[invoice.status] || statusConfig.paid;
  const StatusIcon = status.icon;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  };

  return (
    <motion.div
      variants={itemVariants}
      className="border border-border/50 rounded-xl overflow-hidden hover:border-primary/30 transition-colors"
    >
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Invoice Icon */}
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted/50 shrink-0">
          <Receipt className="w-5 h-5 text-muted-foreground" />
        </div>

        {/* Invoice Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">Invoice #{invoice.number || invoice.id?.slice(-8) || "—"}</p>
            <Badge className={`${status.color} border text-[10px]`}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(invoice.created)} • FarmBond Pro Subscription
          </p>
        </div>

        {/* Amount */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-lg font-bold">{formatCurrency(invoice.amountPaid || invoice.amountDue || 0)}</p>
            <p className="text-xs text-muted-foreground">{invoice.currency?.toUpperCase() || "USD"}</p>
          </div>
          <button
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 border-t border-border/50 bg-muted/20">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Invoice Details</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice ID</span>
                      <span className="font-mono text-xs">{invoice.id || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Period</span>
                      <span>{formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Amount</span>
                      <span>{formatCurrency(invoice.amountDue || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tax</span>
                      <span>{formatCurrency(invoice.tax || 0)}</span>
                    </div>
                    <div className="flex justify-between font-medium border-t border-border/50 pt-1">
                      <span>Total Paid</span>
                      <span className="text-green-600">{formatCurrency(invoice.amountPaid || 0)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Payment Info</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Method</span>
                      <span>•••• {invoice.paymentMethodLast4 || "4242"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Date</span>
                      <span>{invoice.status === "paid" ? formatDate(invoice.statusTransitions?.paid_at || invoice.created) : "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Next Invoice</span>
                      <span>{invoice.nextPaymentAttempt ? formatDate(invoice.nextPaymentAttempt) : "—"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                {invoice.hostedInvoiceUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(invoice.hostedInvoiceUrl, "_blank");
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    View Online
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(invoice.id);
                  }}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download PDF
                </Button>
                {invoice.receiptUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(invoice.receiptUrl, "_blank");
                    }}
                  >
                    <Mail className="w-4 h-4 mr-1" />
                    Receipt
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================
// Payment Method Card Component
// ============================================================

function PaymentMethodCard({ method }: { method: any }) {
  const brandColors: Record<string, string> = {
    visa: "bg-blue-600",
    mastercard: "bg-orange-500",
    amex: "bg-green-600",
    discover: "bg-purple-600",
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20">
      <div className="flex items-center gap-3">
        <div className={`flex items-center justify-center w-12 h-8 rounded-lg ${brandColors[method.brand] || "bg-gray-600"} text-white text-xs font-bold`}>
          {method.brand?.toUpperCase() || "CARD"}
        </div>
        <div>
          <p className="text-sm font-medium">•••• •••• •••• {method.last4}</p>
          <p className="text-xs text-muted-foreground">Expires {method.expMonth}/{method.expYear}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {method.isDefault && (
          <Badge className="bg-primary/10 text-primary text-[10px]">Default</Badge>
        )}
        <Button variant="ghost" size="sm">
          <Edit className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Subscription Change Card Component
// ============================================================

function SubscriptionChangeCard({ change }: { change: any }) {
  const changeIcons: Record<string, any> = {
    upgraded: ArrowUpRight,
    downgraded: ArrowDownRight,
    cancelled: XCircle,
    renewed: RefreshCw,
    started: CheckCircle2,
  };

  const changeColors: Record<string, string> = {
    upgraded: "bg-green-500/10 text-green-600",
    downgraded: "bg-amber-500/10 text-amber-600",
    cancelled: "bg-red-500/10 text-red-600",
    renewed: "bg-blue-500/10 text-blue-600",
    started: "bg-green-500/10 text-green-600",
  };

  const Icon = changeIcons[change.type] || CheckCircle2;
  const color = changeColors[change.type] || "bg-gray-500/10 text-gray-600";

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex items-start gap-3 p-4 rounded-xl border border-border/50">
      <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${color} shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{change.description}</p>
        <p className="text-xs text-muted-foreground mt-1">{formatDate(change.date)}</p>
        {change.details && (
          <p className="text-xs text-muted-foreground mt-1">{change.details}</p>
        )}
      </div>
      {change.amount && (
        <Badge className="bg-muted text-foreground text-[10px]">
          ${change.amount}/mo
        </Badge>
      )}
    </div>
  );
}

// ============================================================
// Main Payment History Page
// ============================================================

export default function PaymentHistory() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("invoices");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  // Query invoices from Stripe
  const stripeStatus = useQuery(api.stripe.getStripeStatus);
  
  // Mock data for demonstration (in production, these would come from Stripe API)
  const invoices = [
    {
      id: "inv_1234567890",
      number: "INV-001",
      status: "paid",
      created: Date.now() - 30 * 24 * 60 * 60 * 1000,
      amountPaid: 500,
      amountDue: 500,
      currency: "usd",
      periodStart: Date.now() - 30 * 24 * 60 * 60 * 1000,
      periodEnd: Date.now(),
      paymentMethodLast4: "4242",
      hostedInvoiceUrl: "#",
      receiptUrl: "#",
      tax: 0,
      nextPaymentAttempt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    },
    {
      id: "inv_0987654321",
      number: "INV-002",
      status: "paid",
      created: Date.now() - 60 * 24 * 60 * 60 * 1000,
      amountPaid: 500,
      amountDue: 500,
      currency: "usd",
      periodStart: Date.now() - 60 * 24 * 60 * 60 * 1000,
      periodEnd: Date.now() - 30 * 24 * 60 * 60 * 1000,
      paymentMethodLast4: "4242",
      hostedInvoiceUrl: "#",
      receiptUrl: "#",
      tax: 0,
    },
  ];

  const paymentMethods = [
    {
      id: "pm_123",
      brand: "visa",
      last4: "4242",
      expMonth: 12,
      expYear: 2027,
      isDefault: true,
    },
  ];

  const subscriptionChanges = [
    {
      type: "started",
      description: "Started Pro subscription",
      date: Date.now() - 60 * 24 * 60 * 60 * 1000,
      details: "Upgraded from Free to Pro plan",
      amount: 5,
    },
    {
      type: "renewed",
      description: "Subscription renewed",
      date: Date.now() - 30 * 24 * 60 * 60 * 1000,
      details: "Monthly payment processed successfully",
      amount: 5,
    },
    {
      type: "renewed",
      description: "Subscription renewed",
      date: Date.now(),
      details: "Monthly payment processed successfully",
      amount: 5,
    },
  ];

  // Filter invoices
  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = 
      inv.number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Calculate stats
  const totalPaid = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.amountPaid || 0), 0);
  const totalPending = invoices.filter(i => i.status === "open").reduce((sum, i) => sum + (i.amountDue || 0), 0);
  const invoiceCount = invoices.length;

  const handleDownloadPdf = async (invoiceId: string) => {
    setIsDownloading(invoiceId);
    // Simulate PDF download
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsDownloading(null);
    // In production, this would generate/download the actual PDF
    alert("PDF download would start here. In production, this would fetch the PDF from Stripe's hosted invoice URL.");
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
              <h1 className="text-3xl font-bold tracking-tight">Payment History</h1>
              <p className="text-muted-foreground mt-1">View your invoices, payment methods, and subscription changes</p>
            </div>
            <Button variant="outline" className="w-fit">
              <Download className="w-4 h-4 mr-2" />
              Export All
            </Button>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          {[
            { label: "Total Paid", value: `$${(totalPaid / 100).toFixed(2)}`, icon: DollarSign, color: "bg-green-500", trend: "+$5 this month" },
            { label: "Pending", value: `$${(totalPending / 100).toFixed(2)}`, icon: Clock, color: "bg-amber-500", trend: "Due soon" },
            { label: "Invoices", value: invoiceCount.toString(), icon: FileText, color: "bg-blue-500", trend: "All time" },
            { label: "Next Payment", value: "$5.00", icon: CreditCard, color: "bg-purple-500", trend: "In 15 days" },
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
                        <p className="text-xs text-green-500 mt-1">{stat.trend}</p>
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
              <TabsTrigger value="invoices" className="gap-2">
                <Receipt className="w-4 h-4" />
                <span className="hidden sm:inline">Invoices</span>
              </TabsTrigger>
              <TabsTrigger value="payment-methods" className="gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">Payment Methods</span>
              </TabsTrigger>
              <TabsTrigger value="subscription-changes" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Subscription History</span>
              </TabsTrigger>
            </TabsList>

            {/* Invoices Tab */}
            <TabsContent value="invoices">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">Invoices</CardTitle>
                      <CardDescription>Your billing history and invoices</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          placeholder="Search invoices..."
                          className="pl-9 h-9 w-48"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                      </div>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="h-9 px-3 text-sm bg-muted/50 rounded-lg border-0 focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="all">All Status</option>
                        <option value="paid">Paid</option>
                        <option value="open">Pending</option>
                        <option value="void">Void</option>
                      </select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {filteredInvoices.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Receipt className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">No invoices found</p>
                        <p className="text-xs mt-1">Your invoices will appear here once you start your subscription</p>
                      </div>
                    ) : (
                      filteredInvoices.map((invoice) => (
                        <InvoiceCard
                          key={invoice.id}
                          invoice={invoice}
                          onDownload={handleDownloadPdf}
                        />
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment Methods Tab */}
            <TabsContent value="payment-methods">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Payment Methods</CardTitle>
                      <CardDescription>Manage your payment cards and methods</CardDescription>
                    </div>
                    <Button variant="outline" size="sm">
                      <CreditCard className="w-4 h-4 mr-1" />
                      Add Method
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {paymentMethods.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">No payment methods</p>
                        <p className="text-xs mt-1">Add a payment method to subscribe to Pro</p>
                      </div>
                    ) : (
                      paymentMethods.map((method) => (
                        <PaymentMethodCard key={method.id} method={method} />
                      ))
                    )}

                    <div className="flex items-center gap-2 mt-4 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
                      <Shield className="w-4 h-4" />
                      <span>Your payment information is encrypted and secure. We never store your full card details.</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Subscription Changes Tab */}
            <TabsContent value="subscription-changes">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Subscription History</CardTitle>
                  <CardDescription>Track all changes to your subscription</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {subscriptionChanges.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <RefreshCw className="w-12 h-12 mx-auto mb-3 opacity-40" />
                        <p className="text-sm font-medium">No subscription changes</p>
                        <p className="text-xs mt-1">Your subscription history will appear here</p>
                      </div>
                    ) : (
                      subscriptionChanges.map((change, i) => (
                        <SubscriptionChangeCard key={i} change={change} />
                      ))
                    )}
                  </div>
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
                <Button variant="outline" size="sm">
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
