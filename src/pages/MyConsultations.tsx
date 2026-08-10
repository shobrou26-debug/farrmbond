import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
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
  Smartphone,
  CreditCard,
  ArrowUpRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  confirmed: { label: "Confirmed", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "Not Paid", color: "text-amber-600" },
  paid: { label: "Paid", color: "text-green-600" },
  refunded: { label: "Refunded", color: "text-muted-foreground" },
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
  const [showPayModal, setShowPayModal] = useState(false);
  const [payingConsultationId, setPayingConsultationId] = useState<string | null>(null);
  const [payingAmount, setPayingAmount] = useState(0);
  const [payingPaymentRef, setPayingPaymentRef] = useState<string | null>(null);
  const [payingProvider, setPayingProvider] = useState<string>("mtn_momo");
  const [phoneInput, setPhoneInput] = useState("");
  const [countryCodeInput, setCountryCodeInput] = useState("KE");
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"init" | "sent" | "verified">("init");
  const [pollIntervalId, setPollIntervalId] = useState<ReturnType<typeof setInterval> | null>(null);

  const consultations = useQuery(api.marketplace.listUserConsultations);
  const providers = useQuery(api.mobileMoney.getSupportedProviders, { countryCode: countryCodeInput });

  const initiatePayment = useAction(api.mobileMoney.initiateConsultationPayment);
  const checkMtnStatus = useAction(api.mobileMoney.checkMtnPaymentStatus);
  const checkAirtelStatus = useAction(api.mobileMoney.checkAirtelPaymentStatus);

  const isLoading = consultations === undefined;

  // Filter consultations by tab
  const now = Date.now();
  const filtered = (consultations ?? []).filter((c) => {
    if (activeTab === "upcoming") return c.scheduledAt > now && c.status !== "cancelled";
    if (activeTab === "past") return c.scheduledAt <= now || c.status === "completed" || c.status === "cancelled";
    return true;
  });

  const upcomingCount = (consultations ?? []).filter(
    (c) => c.scheduledAt > now && c.status !== "cancelled"
  ).length;
  const completedCount = (consultations ?? []).filter((c) => c.status === "completed").length;

  // Clean up polling on unmount
  useEffect(() => {
    return () => { if (pollIntervalId) clearInterval(pollIntervalId); };
  }, [pollIntervalId]);

  const handlePayClick = useCallback((consultation: any) => {
    setPayingConsultationId(consultation._id);
    setPayingAmount(consultation.amount);
    setShowPayModal(true);
    setPaymentStep("init");
    setPayingPaymentRef(null);
    setPayingProvider("mtn_momo");
    setPhoneInput("");
    setCountryCodeInput("KE");
    setIsPaying(false);
  }, []);

  const handleInitiatePayment = async () => {
    if (!payingConsultationId || !phoneInput) return;
    setIsPaying(true);
    try {
      const result = await initiatePayment({
        consultationId: payingConsultationId as any,
        provider: payingProvider as "mtn_momo" | "airtel_money",
        phoneNumber: phoneInput,
        countryCode: payingProvider === "airtel_money" ? countryCodeInput : undefined,
      });
      const ref = (result as any).referenceId || (result as any).transactionId;
      setPayingPaymentRef(ref);
      setPaymentStep("sent");
      toast.success("Payment request sent! Please check your phone to approve.");
      // Start polling
      const interval = setInterval(async () => {
        try {
          if (payingProvider === "airtel_money") {
            await checkAirtelStatus({ transactionId: ref, countryCode: countryCodeInput });
          } else {
            await checkMtnStatus({ referenceId: ref });
          }
        } catch {
          // Silent poll
        }
      }, 5000);
      setPollIntervalId(interval);
    } catch (err: any) {
      toast.error(err?.message || "Payment initiation failed");
    } finally {
      setIsPaying(false);
    }
  };

  const handlePaymentDone = () => {
    if (pollIntervalId) clearInterval(pollIntervalId);
    setPollIntervalId(null);
    setShowPayModal(false);
    setPaymentStep("init");
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">My Consultations</h1>
          <p className="text-muted-foreground mt-1">View and manage your agronomist consultations</p>
        </motion.div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          {(["upcoming", "past", "all"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >{tab === "upcoming" ? "Upcoming" : tab === "past" ? "Past" : "All"}</button>
          ))}
          <div className="ml-auto flex gap-2">
            <Badge variant="secondary"><CalendarCheck className="w-3 h-3 mr-1 text-blue-500" />{isLoading ? "…" : `${upcomingCount} Upcoming`}</Badge>
            <Badge variant="secondary"><CheckCircle2 className="w-3 h-3 mr-1 text-green-500" />{isLoading ? "…" : `${completedCount} Completed`}</Badge>
          </div>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-border/50"><CardHeader><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-muted animate-pulse" /><div className="space-y-2 flex-1"><div className="h-4 w-32 bg-muted rounded animate-pulse" /><div className="h-3 w-24 bg-muted rounded animate-pulse" /></div></div></CardHeader><CardContent className="space-y-3"><div className="h-3 w-full bg-muted rounded animate-pulse" /><div className="h-3 w-3/4 bg-muted rounded animate-pulse" /></CardContent></Card>
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="p-12 text-center">
              <Calendar className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium mb-2">No consultations yet</h3>
              <p className="text-muted-foreground mb-6">Browse agronomists to book your first consultation.</p>
              <Button onClick={() => window.location.href = "/marketplace"} className="gradient-primary">Browse Agronomists</Button>
            </CardContent>
          </Card>
        )}

        {!isLoading && filtered.length > 0 && (
          <motion.div variants={containerVariants} initial="hidden" animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
          >
            {filtered.map((consultation) => {
              const status = statusConfig[consultation.status] ?? statusConfig.pending;
              const StatusIcon = status.icon;
              const date = new Date(consultation.scheduledAt);
              const isUpcoming = consultation.scheduledAt > now;
              const payStatus = PAYMENT_STATUS_LABELS[consultation.paymentStatus] ?? PAYMENT_STATUS_LABELS.pending;
              const needsPayment = isUpcoming && consultation.paymentStatus === "pending" && consultation.status !== "cancelled" && consultation.amount > 0;
              const pendingPayment = (consultation as any).pendingPayment;
              const hasPendingPayment = pendingPayment && pendingPayment.status !== "failed" && pendingPayment.status !== "expired";

              return (
                <motion.div key={consultation._id} variants={itemVariants}>
                  <Card className="border-border/50 hover:shadow-lg transition-all h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
                            {(consultation as any).agronomistImage ? (
                              <img src={(consultation as any).agronomistImage} alt="" className="w-full h-full object-cover" />
                            ) : <User className="w-5 h-5 text-primary" />}
                          </div>
                          <div>
                            <p className="font-medium">{(consultation as any).agronomistName ?? "Agronomist"}</p>
                            <p className="text-sm text-muted-foreground capitalize">{consultation.serviceType?.replace(/_/g, " ") ?? "Consultation"}</p>
                          </div>
                        </div>
                        <Badge className={status.color}><StatusIcon className="w-3 h-3 mr-1" />{status.label}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="w-4 h-4" />
                        <span>{date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        <span>{date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })} ({consultation.duration} min)</span>
                      </div>
                      {consultation.notes && <p className="text-sm text-muted-foreground line-clamp-2">{consultation.notes}</p>}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CreditCard className="w-3 h-3" />
                        <span className={payStatus.color}>{payStatus.label}</span>
                        <span className="font-medium">KES {consultation.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                        {needsPayment && !hasPendingPayment && (
                          <Button size="sm" className="gradient-primary" onClick={() => handlePayClick(consultation)}>
                            <Smartphone className="w-3 h-3 mr-1" /> Pay Now
                          </Button>
                        )}
                        {hasPendingPayment && (
                          <Badge variant="outline" className="text-xs">
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Payment Pending
                          </Badge>
                        )}
                        {isUpcoming && consultation.status === "pending" && (
                          <Badge variant="outline" className="text-xs">Awaiting Confirmation</Badge>
                        )}
                        {isUpcoming && consultation.status === "confirmed" && (
                          <Button size="sm" className="gradient-primary"><Video className="w-3 h-3 mr-1" /> Join</Button>
                        )}
                        {consultation.status === "completed" && (
                          <Button size="sm" variant="outline"><Star className="w-3 h-3 mr-1" /> Rate</Button>
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

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handlePaymentDone(); }}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-card rounded-2xl border border-border shadow-2xl p-6">
            <h2 className="text-lg font-semibold mb-4">
              {paymentStep === "init" && "Pay for Consultation"}
              {paymentStep === "sent" && "Payment Sent"}
              {paymentStep === "verified" && "Payment Complete"}
            </h2>

            {paymentStep === "init" && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-sm"><span className="text-muted-foreground">Amount:</span> <span className="font-bold">KES {payingAmount.toLocaleString()}</span></p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setPayingProvider("mtn_momo")}
                      className={`p-3 rounded-xl border text-sm font-medium transition-all ${payingProvider === "mtn_momo" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                      MTN MoMo
                    </button>
                    <button onClick={() => setPayingProvider("airtel_money")}
                      className={`p-3 rounded-xl border text-sm font-medium transition-all ${payingProvider === "airtel_money" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                      Airtel Money
                    </button>
                  </div>
                </div>
                {payingProvider === "airtel_money" && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Country</label>
                    <input value={countryCodeInput} onChange={(e) => setCountryCodeInput(e.target.value.toUpperCase())}
                      className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="KE" maxLength={2} />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium mb-1 block">Phone Number</label>
                  <input value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)}
                    className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="254712345678" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handlePaymentDone} className="flex-1">Cancel</Button>
                  <Button onClick={handleInitiatePayment} disabled={!phoneInput || isPaying} className="gradient-primary flex-1">
                    {isPaying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : <>Pay KES {payingAmount.toLocaleString()}</>}
                  </Button>
                </div>
              </div>
            )}

            {paymentStep === "sent" && (
              <div className="text-center py-6 space-y-4">
                <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
                <h3 className="text-xl font-bold">Waiting for Approval</h3>
                <p className="text-muted-foreground text-sm">Please check your phone and approve the payment request. This page will update automatically.</p>
                <Button onClick={handlePaymentDone} variant="outline">Done</Button>
              </div>
            )}

            {paymentStep === "verified" && (
              <div className="text-center py-6 space-y-4">
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
                <h3 className="text-xl font-bold">Payment Successful!</h3>
                <p className="text-muted-foreground text-sm">Your consultation has been confirmed.</p>
                <Button onClick={handlePaymentDone} className="gradient-primary">Done</Button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AppLayout>
  );
}