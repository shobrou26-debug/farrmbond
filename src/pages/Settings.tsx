import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useTheme, THEMES } from "@/hooks/use-theme";
import { useUnits } from "@/hooks/use-units";
import { useTimezone, TIMEZONE_GROUPS } from "@/hooks/use-timezone";
import { useCurrency, CURRENCY_GROUPS } from "@/hooks/use-currency";
import { toast } from "sonner";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Save,
  Camera,
  Mail,
  Lock,
  Key,
  Smartphone,
  Trash2,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Sprout,
  Users,
  Crown,
  MoreVertical,
  Search,
  Filter,

  UserCheck,
  UserX,
  ShieldCheck,
  Clock,
  MailCheck,
  Timer,
  Smartphone as PhoneIcon,
  Loader2,
  Bot,
  Eye,
  Sparkles,
  Palette,
  DollarSign,
} from "lucide-react";

// ============================================================
// Animation Variants
// ============================================================

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const roleConfig: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  farmer: { label: "Farmer", color: "bg-green-500/10 text-green-600", icon: Sprout },
  agronomist: { label: "Agronomist", color: "bg-blue-500/10 text-blue-600", icon: Users },
  admin: { label: "Admin", color: "bg-purple-500/10 text-purple-600", icon: ShieldCheck },
  super_admin: { label: "Super Admin", color: "bg-amber-500/10 text-amber-600", icon: Crown },
};

const subscriptionConfig: Record<string, { label: string; color: string }> = {
  free: { label: "Free", color: "bg-gray-500/10 text-gray-600" },
  pro: { label: "Pro", color: "bg-green-500/10 text-green-600" },
};

// ============================================================
// Profile Tab
// ============================================================

function ProfileTab() {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [location, setLocation] = useState(user?.location || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Profile Photo</CardTitle>
          <CardDescription>Update your profile picture</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="w-20 h-20">
              <AvatarImage src={user?.image} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {user?.name?.charAt(0) || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <Button variant="outline" size="sm">
                <Camera className="w-4 h-4 mr-2" />
                Upload Photo
              </Button>
              <p className="text-xs text-muted-foreground">JPG, PNG or GIF. Max 2MB.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Personal Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Full Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" type="email" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+254 700 000000" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Location</label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Nairobi, Kenya" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself and your farming experience..."
              className="w-full h-24 px-3 py-2 text-sm bg-muted/50 rounded-xl border-0 focus:ring-2 focus:ring-primary/20 focus:bg-muted transition-all resize-none placeholder:text-muted-foreground/60"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Farm Preferences</CardTitle>
          <CardDescription>Customize your farming experience</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Measurement Units</label>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1">Metric (kg, ha)</Button>
                <Button variant="ghost" size="sm" className="flex-1">Imperial (lbs, ac)</Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Currency</label>
              <Input defaultValue="KES" placeholder="KES" />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} className="gradient-primary">
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Saved!
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Notifications Tab
// ============================================================

function NotificationsTab() {
  const [notifications, setNotifications] = useState({
    weatherAlerts: true,
    cropReminders: true,
    marketPrices: false,
    communityUpdates: true,
    aiInsights: true,
    systemUpdates: true,
    emailDigest: true,
    pushEnabled: false,
  });

  const toggleNotification = (key: keyof typeof notifications) => {
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Push Notifications</CardTitle>
          <CardDescription>Manage what notifications you receive</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "pushEnabled" as const, label: "Enable Push Notifications", desc: "Receive notifications on your device", icon: Smartphone },
            { key: "weatherAlerts" as const, label: "Weather Alerts", desc: "Severe weather warnings for your farm locations", icon: Bell },
            { key: "cropReminders" as const, label: "Crop Reminders", desc: "Planting, fertilizing, and harvest reminders", icon: Bell },
            { key: "marketPrices" as const, label: "Market Price Updates", desc: "Daily commodity price summaries", icon: Bell },
            { key: "communityUpdates" as const, label: "Community Updates", desc: "New posts and replies in your discussions", icon: Bell },
            { key: "aiInsights" as const, label: "AI Insights", desc: "New recommendations from your AI assistant", icon: Bell },
            { key: "systemUpdates" as const, label: "System Updates", desc: "Platform maintenance and feature announcements", icon: Bell },
          ].map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
                <Switch checked={notifications[item.key]} onCheckedChange={() => toggleNotification(item.key)} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Email Preferences</CardTitle>
          <CardDescription>Control email notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Weekly Digest</p>
                <p className="text-xs text-muted-foreground">Summary of your farm activity and insights</p>
              </div>
            </div>
            <Switch checked={notifications.emailDigest} onCheckedChange={() => toggleNotification("emailDigest")} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Security Tab
// ============================================================

function SecurityTab() {
  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>Manage your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Current Password</label>
            <Input type="password" placeholder="Enter current password" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <Input type="password" placeholder="Enter new password" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <Input type="password" placeholder="Confirm new password" />
            </div>
          </div>
          <Button variant="outline" size="sm">
            <Lock className="w-4 h-4 mr-2" />
            Update Password
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Two-Factor Authentication</CardTitle>
          <CardDescription>Add an extra layer of security to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">2FA via Authenticator App</p>
                <p className="text-xs text-muted-foreground">Use an authenticator app to generate one-time codes</p>
              </div>
            </div>
            <Button variant="outline" size="sm">Enable</Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Sessions</CardTitle>
          <CardDescription>Manage devices where you're signed in</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { device: "Chrome on Windows", location: "Nairobi, Kenya", time: "Current session", active: true },
            { device: "Safari on iPhone", location: "Nairobi, Kenya", time: "2 hours ago", active: false },
          ].map((session, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{session.device}</p>
                  <p className="text-xs text-muted-foreground">{session.location} • {session.time}</p>
                </div>
              </div>
              {session.active ? (
                <Badge className="bg-green-500/10 text-green-600">Active</Badge>
              ) : (
                <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">Revoke</Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-red-500/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-red-600">Danger Zone</CardTitle>
          <CardDescription>Irreversible account actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Delete Account</p>
              <p className="text-xs text-muted-foreground">Permanently delete your account and all data</p>
            </div>
            <Button variant="outline" size="sm" className="text-red-500 border-red-500/20 hover:bg-red-500/10">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Subscription Tab - Single $5/month Plan with Free Trial
// ============================================================

function SubscriptionTab() {
  const { user } = useAuth();
  const tier = user?.subscriptionTier || "free";
  const trialStatus = useQuery(api.trials.getTrialStatus);
  const subStatus = useQuery(api.subscriptions.getSubscriptionStatus);
  const stripeStatus = useQuery(api.stripe.getStripeStatus);
  const mobileMoneyStats = useQuery(api.mobileMoney.getMobileMoneyStats);
  const supportedProviders = useQuery(api.mobileMoney.getSupportedProviders, { countryCode: user?.country });
  const startTrial = useMutation(api.trials.startTrial);
  const createCheckoutSession = useAction(api.stripe.createCheckoutSession);
  const createPortalSession = useAction(api.stripe.createPortalSession);
  const retryPayment = useAction(api.stripe.retryPayment);
  const initiateMtnPayment = useAction(api.mobileMoney.initiateMtnPayment);
  const initiateAirtelPayment = useAction(api.mobileMoney.initiateAirtelPayment);
  const [isStartingTrial, setIsStartingTrial] = useState(false);
  const [isCreatingCheckout, setIsCreatingCheckout] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [isRetryingPayment, setIsRetryingPayment] = useState(false);
  const [showMobileMoney, setShowMobileMoney] = useState(false);
  const [mobileMoneyPhone, setMobileMoneyPhone] = useState(user?.phone || "");
  const [mobileMoneyCountry, setMobileMoneyCountry] = useState(user?.country || "KE");
  const [isInitiatingMobilePayment, setIsInitiatingMobilePayment] = useState(false);
  const [selectedMobileProvider, setSelectedMobileProvider] = useState<string | null>(null);
  
  const paymentMethodVerified = user?.paymentMethodVerified ?? false;
  const paymentFailureCount = stripeStatus?.paymentFailureCount || 0;
  const hasPaymentFailed = paymentFailureCount > 0;

  const isTrialActive = trialStatus?.isTrialActive ?? false;
  const trialDaysRemaining = trialStatus?.trialDaysRemaining ?? 0;
  const trialEndDate = trialStatus?.trialEndDate;
  const hasUsedTrial = trialStatus?.hasUsedTrial ?? false;

  // Subscription status for paid users
  const isPaid = tier === "pro" && !isTrialActive;
  const subDaysUntilRenewal = subStatus?.daysUntilRenewal ?? 0;
  const isSubExpiringSoon = isPaid && (subStatus?.isExpiringSoon ?? false);
  const isSubUrgent = isPaid && (subStatus?.isUrgent ?? false);
  const subEndDate = subStatus?.subscriptionEndDate;

  // Calculate trial progress (7 day trial)
  const trialDuration = 7;
  const trialProgress = isTrialActive ? ((trialDuration - trialDaysRemaining) / trialDuration) * 100 : 0;
  const isExpiringSoon = isTrialActive && trialDaysRemaining <= 2;
  const isUrgent = isTrialActive && trialDaysRemaining <= 1;

  const handleStartTrial = async () => {
    setIsStartingTrial(true);
    try {
      await startTrial();
    } catch (err) {
      console.error("Failed to start trial:", err);
    } finally {
      setIsStartingTrial(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Current Plan</CardTitle>
          <CardDescription>Your current subscription and usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border border-green-500/20">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-green-500">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-lg font-bold capitalize">{tier} Plan</p>
                {isTrialActive && (
                  <Badge className="bg-amber-500/10 text-amber-600 text-[10px]">
                    Free Trial • {trialDaysRemaining}d left
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {tier === "free"
                  ? hasUsedTrial
                    ? "Limited features • 1 farm"
                    : "Limited features • Start your free trial!"
                  : isTrialActive
                    ? `Trial ends ${trialEndDate ? new Date(trialEndDate).toLocaleDateString() : ""}`
                    : "Unlimited access • Priority support"
                }
              </p>
            </div>
          </div>

          {/* Trial Expiry Warning */}
          {isTrialActive && trialEndDate && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-xl border p-4 space-y-3 ${
                isUrgent
                  ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                  : isExpiringSoon
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                    : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
              }`}
            >
              {/* Warning Header */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  isUrgent ? "bg-red-100 dark:bg-red-900/50" : isExpiringSoon ? "bg-amber-100 dark:bg-amber-900/50" : "bg-blue-100 dark:bg-blue-900/50"
                }`}>
                  {isUrgent ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  ) : isExpiringSoon ? (
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <Timer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${
                    isUrgent ? "text-red-800 dark:text-red-200" : isExpiringSoon ? "text-amber-800 dark:text-amber-200" : "text-blue-800 dark:text-blue-200"
                  }`}>
                    {isUrgent
                      ? "Trial expires tomorrow!"
                      : isExpiringSoon
                        ? `Trial expires in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""}`
                        : `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? "s" : ""} remaining`
                    }
                  </p>
                  <p className={`text-xs ${
                    isUrgent ? "text-red-600 dark:text-red-400" : isExpiringSoon ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
                  }`}>
                    Ends {trialEndDate ? new Date(trialEndDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}
                  </p>
                </div>
                <Badge className={`${
                  isUrgent ? "bg-red-500/10 text-red-600 border-red-500/20" : isExpiringSoon ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-blue-500/10 text-blue-600 border-blue-500/20"
                } border text-[10px]`}>{isUrgent ? "URGENT" : isExpiringSoon ? "EXPIRING" : "ACTIVE"}</Badge>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Trial Progress</span>
                  <span className={isUrgent ? "text-red-600" : isExpiringSoon ? "text-amber-600" : "text-blue-600"}>{Math.round(trialProgress)}%</span>
                </div>
                <div className="h-2 bg-white dark:bg-gray-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${trialProgress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className={`h-full rounded-full ${
                      isUrgent ? "bg-red-500" : isExpiringSoon ? "bg-amber-500" : "bg-blue-500"
                    }`}
                  />
                </div>
              </div>

              {/* Email Notification Status */}
              <div className="flex items-center gap-2 text-xs">
                <MailCheck className={`w-3.5 h-3.5 ${isExpiringSoon ? "text-green-600" : "text-muted-foreground"}`} />
                <span className={isExpiringSoon ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>
                  {isExpiringSoon
                    ? "Expiry warning email sent — check your inbox"
                    : "You'll receive an email 2 days before expiry"
                  }
                </span>
              </div>

              {/* Action Message */}
              <p className={`text-xs ${
                isUrgent ? "text-red-600 dark:text-red-400" : isExpiringSoon ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
              }`}>
                Subscribe now to keep all Pro features uninterrupted.
              </p>
            </motion.div>
          )}

          {/* Paid Subscription Renewal Warning */}
          {isPaid && !isTrialActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`rounded-xl border p-4 space-y-3 ${
                isSubUrgent
                  ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                  : isSubExpiringSoon
                    ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800"
                    : "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
              }`}
            >
              {/* Warning Header */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                  isSubUrgent ? "bg-red-100 dark:bg-red-900/50" : isSubExpiringSoon ? "bg-amber-100 dark:bg-amber-900/50" : "bg-green-100 dark:bg-green-900/50"
                }`}>
                  {isSubUrgent ? (
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  ) : isSubExpiringSoon ? (
                    <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${
                    isSubUrgent ? "text-red-800 dark:text-red-200" : isSubExpiringSoon ? "text-amber-800 dark:text-amber-200" : "text-green-800 dark:text-green-200"
                  }`}>
                    {isSubUrgent
                      ? "Subscription renews tomorrow!"
                      : isSubExpiringSoon
                        ? `Subscription renews in ${subDaysUntilRenewal} day${subDaysUntilRenewal !== 1 ? "s" : ""}`
                        : `Next renewal in ${subDaysUntilRenewal} day${subDaysUntilRenewal !== 1 ? "s" : ""}`
                    }
                  </p>
                  <p className={`text-xs ${
                    isSubUrgent ? "text-red-600 dark:text-red-400" : isSubExpiringSoon ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"
                  }`}>
                    Renews {subEndDate ? new Date(subEndDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""} • $5/month
                  </p>
                </div>
                <Badge className={`${
                  isSubUrgent ? "bg-red-500/10 text-red-600 border-red-500/20" : isSubExpiringSoon ? "bg-amber-500/10 text-amber-600 border-amber-500/20" : "bg-green-500/10 text-green-600 border-green-500/20"
                } border text-[10px]`}>{isSubUrgent ? "URGENT" : isSubExpiringSoon ? "RENEWING" : "ACTIVE"}</Badge>
              </div>

              {/* Email Notification Status */}
              <div className="flex items-center gap-2 text-xs">
                <MailCheck className={`w-3.5 h-3.5 ${isSubExpiringSoon ? "text-green-600" : "text-muted-foreground"}`} />
                <span className={isSubExpiringSoon ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}>
                  {isSubExpiringSoon
                    ? "Renewal reminder email sent — check your inbox"
                    : "You'll receive a reminder 3 days before renewal"
                  }
                </span>
              </div>

              {/* Action Message */}
              {isSubExpiringSoon && (
                <p className={`text-xs ${
                  isSubUrgent ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                }`}>
                  Make sure your payment method is up to date to avoid interruption.
                </p>
              )}
            </motion.div>
          )}

          <div className="space-y-3">
            <p className="text-sm font-medium">Usage This Month</p>
            {[
              { label: "Farms", used: 1, limit: tier === "free" ? 1 : "∞" },
              { label: "Crops Tracked", used: 4, limit: tier === "free" ? 5 : "∞" },
              { label: "AI Queries", used: 8, limit: tier === "free" ? 10 : "∞" },
            ].map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="text-muted-foreground">{item.used} / {item.limit}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${typeof item.limit === "number" ? (item.used / item.limit) * 100 : 5}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Services Status */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">AI Services</CardTitle>
              <CardDescription>Active AI providers powering your farming assistant</CardDescription>
            </div>
            <Badge className="bg-green-500/10 text-green-600 text-[10px]">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse mr-1" />
              All Systems Operational
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Groq - AI Chat */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-500">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Groq AI</p>
                  <Badge className="bg-purple-500/10 text-purple-600 text-[10px]">Primary</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Chat & text responses • 14,400 requests/day free</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/10 text-green-600 text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Active
              </Badge>
            </div>
          </div>

          {/* Gemini - AI Vision */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-500">
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">Google Gemini</p>
                  <Badge className="bg-blue-500/10 text-blue-600 text-[10px]">Vision</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Disease detection & image analysis • 1,500 requests/day free</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-500/10 text-green-600 text-[10px]">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Active
              </Badge>
            </div>
          </div>

          {/* Info Note */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/30">
            <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground">How it works</p>
              <p className="mt-0.5">Your farming assistant uses <span className="font-medium text-purple-600">Groq</span> for fast chat responses and <span className="font-medium text-blue-600">Gemini</span> for analyzing plant disease images. Both are free, trusted AI providers with generous daily limits.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Single Pro Plan - $5/month */}
      <Card className="border-primary/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">FarmBond Pro</CardTitle>
            {tier === "free" && !hasUsedTrial && <Badge className="gradient-primary text-[10px]">Free Trial Available</Badge>}
            {tier === "free" && hasUsedTrial && <Badge className="bg-gray-500/10 text-gray-600 text-[10px]">Upgrade Required</Badge>}
            {(tier === "pro" && !isTrialActive) && <Badge className="bg-green-500/10 text-green-600 text-[10px]">Current Plan</Badge>}
            {(tier === "pro" && isTrialActive) && <Badge className="bg-amber-500/10 text-amber-600 text-[10px]">Trial Active</Badge>}
          </div>
          <div className="mt-2">
            <span className="text-3xl font-bold">$5</span>
            <span className="text-muted-foreground text-sm">/month</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Unlock the full power of FarmBond with Pro features:</p>
          <ul className="space-y-2">
            {[
              "Unlimited farms",
              "Unlimited crops & livestock tracking",
              "Unlimited AI assistant queries",
              "Satellite NDVI monitoring",
              "Advanced analytics & reports",
              "Priority support",
              "PDF & Excel exports",
              "Expert consultations",
            ].map((feature, j) => (
              <li key={j} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-3">
            {tier === "free" && !hasUsedTrial && (
              <Button
                className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                onClick={handleStartTrial}
                disabled={isStartingTrial}
              >
                {isStartingTrial ? (
                  <>Starting trial...</>
                ) : (
                  <>Start Free Trial — 7 Days</>
                )}
              </Button>
            )}
            {tier === "free" && hasUsedTrial && (
              <>
                {/* Card Payment Button */}
                <Button
                  className="w-full gradient-primary"
                  onClick={async () => {
                    setIsCreatingCheckout(true);
                    try {
                      const result = await createCheckoutSession({
                        email: user?.email || undefined,
                        name: user?.name || undefined,
                        stripeCustomerId: (user as any)?.stripeCustomerId || undefined,
                        stripeSubscriptionId: (user as any)?.stripeSubscriptionId || undefined,
                      });
                      if (result.checkoutUrl) {
                        window.location.href = result.checkoutUrl;
                      }
                    } catch (err) {
                      console.error("Failed to create checkout:", err);
                    } finally {
                      setIsCreatingCheckout(false);
                    }
                  }}
                  disabled={isCreatingCheckout}
                >
                  {isCreatingCheckout ? (
                    <>Redirecting to checkout...</>
                  ) : (
                    <>Upgrade with Card — $5/month</>
                  )}
                </Button>

                {/* Mobile Money Toggle */}
                {supportedProviders && supportedProviders.length > 0 && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/50" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">or pay with Mobile Money</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowMobileMoney(!showMobileMoney)}
                    >
                      <PhoneIcon className="w-4 h-4 mr-2" />
                      {showMobileMoney ? 'Hide Mobile Money' : 'Pay with Mobile Money'}
                    </Button>
                  </>
                )}
              </>
            )}
            {tier === "pro" && (
              <Button
                className="w-full"
                variant="outline"                onClick={async () => {
                    setIsOpeningPortal(true);
                    try {
                      const result = await createPortalSession({
                        stripeCustomerId: (user as any)?.stripeCustomerId || "",
                      });
                      if (result.portalUrl) {
                        window.location.href = result.portalUrl;
                      }
                    } catch (err) {
                      console.error("Failed to open portal:", err);
                    } finally {
                      setIsOpeningPortal(false);
                    }
                  }}
                  disabled={isOpeningPortal}
                >
                  {isOpeningPortal ? (
                    <>Opening billing portal...</>
                  ) : (
                    <>Manage Subscription</>
                  )}
                </Button>
              )}
          </div>
        </CardContent>
      </Card>

      {/* Payment Failed Warning */}
      {isPaid && hasPaymentFailed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                Payment Failed — {paymentFailureCount} attempt{paymentFailureCount !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                Your last payment was declined. Please update your payment method or retry payment.
              </p>
            </div>
            <Badge className="bg-red-500/10 text-red-600 border-red-500/20 border text-[10px]">ACTION REQUIRED</Badge>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="bg-red-600 hover:bg-red-700 text-white"                    onClick={async () => {
                      setIsRetryingPayment(true);
                      try {
                        await retryPayment({
                          stripeCustomerId: (user as any)?.stripeCustomerId || "",
                          stripeSubscriptionId: (user as any)?.stripeSubscriptionId || "",
                        });
                      } catch (err) {
                        console.error("Failed to retry payment:", err);
                      } finally {
                        setIsRetryingPayment(false);
                      }
                    }}
                    disabled={isRetryingPayment}
                  >
                    {isRetryingPayment ? "Retrying..." : "Retry Payment"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      setIsOpeningPortal(true);
                      try {
                        const result = await createPortalSession({
                          stripeCustomerId: (user as any)?.stripeCustomerId || "",
                        });
                        if (result.portalUrl) window.location.href = result.portalUrl;
                      } catch (err) {
                        console.error(err);
                      } finally {
                        setIsOpeningPortal(false);
                      }
                    }}
                  >
                    Update Payment Method
            </Button>
          </div>
        </motion.div>
      )}

      {/* Payment Method Status */}
      {isPaid && (
        <Card className={`border ${paymentMethodVerified ? "border-green-200 dark:border-green-800" : "border-amber-200 dark:border-amber-800"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Payment Method</CardTitle>
                <CardDescription>Manage your payment details for subscription renewal</CardDescription>
              </div>
              {paymentMethodVerified ? (
                <Badge className="bg-green-500/10 text-green-600 text-[10px]">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
                </Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-600 text-[10px]">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Action Required
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!paymentMethodVerified && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                      Payment method needs verification
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      To ensure uninterrupted Pro access, please verify your payment method is up to date before your next renewal on {subEndDate ? new Date(subEndDate).toLocaleDateString() : ""}. A failed payment could result in loss of premium features.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-white dark:bg-gray-800 border border-border">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">•••• •••• •••• 4242</p>
                  <p className="text-xs text-muted-foreground">Expires 12/2027</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasPaymentFailed && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    onClick={async () => {
                      setIsRetryingPayment(true);
                      try {
                        await retryPayment({
                          stripeCustomerId: (user as any)?.stripeCustomerId || "",
                          stripeSubscriptionId: (user as any)?.stripeSubscriptionId || "",
                        });
                      } catch (err) {
                        console.error("Failed to retry payment:", err);
                      } finally {
                        setIsRetryingPayment(false);
                      }
                    }}
                    disabled={isRetryingPayment}
                  >
                    {isRetryingPayment ? "Retrying..." : "Retry Payment"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    setIsOpeningPortal(true);
                    try {
                      const result = await createPortalSession({ stripeCustomerId: (user as any)?.stripeCustomerId || "" });
                      if (result.portalUrl) {
                        window.location.href = result.portalUrl;
                      }
                    } catch (err) {
                      console.error("Failed to open portal:", err);
                    } finally {
                      setIsOpeningPortal(false);
                    }
                  }}
                >
                  Update
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="w-3.5 h-3.5" />
              <span>Your payment information is encrypted and secure</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mobile Money Payment Form */}
      <AnimatePresence>
        {showMobileMoney && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Mobile Money Payment</CardTitle>
                <CardDescription>Pay your $5/month subscription using mobile money</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Country Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Country</label>
                  <select
                    value={mobileMoneyCountry}
                    onChange={(e) => setMobileMoneyCountry(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-muted/50 rounded-xl border-0 focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="KE">Kenya (KES)</option>
                    <option value="UG">Uganda (UGX)</option>
                    <option value="TZ">Tanzania (TZS)</option>
                    <option value="NG">Nigeria (NGN)</option>
                    <option value="GH">Ghana (GHS)</option>
                    <option value="ZM">Zambia (ZMW)</option>
                    <option value="RW">Rwanda (RWF)</option>
                    <option value="CM">Cameroon (XAF)</option>
                    <option value="CI">Côte d'Ivoire (XOF)</option>
                    <option value="MW">Malawi (MWK)</option>
                  </select>
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Mobile Money Number</label>
                  <Input
                    type="tel"
                    placeholder="e.g., +254 700 000000"
                    value={mobileMoneyPhone}
                    onChange={(e) => setMobileMoneyPhone(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the phone number linked to your mobile money account
                  </p>
                </div>

                {/* Available Providers */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Payment Provider</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {supportedProviders?.map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() => setSelectedMobileProvider(provider.id)}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                          selectedMobileProvider === provider.id
                            ? "border-primary bg-primary/5"
                            : "border-border/50 hover:border-border"
                        }`}
                      >
                        <div
                          className="flex items-center justify-center w-10 h-10 rounded-lg text-white font-bold text-xs"
                          style={{ backgroundColor: provider.color }}
                        >
                          {provider.id === "mtn_momo" ? "MTN" : "AIR"}
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium">{provider.name}</p>
                          <p className="text-xs text-muted-foreground">{provider.fees} • {provider.processingTime}</p>
                        </div>
                        {selectedMobileProvider === provider.id && (
                          <CheckCircle2 className="w-5 h-5 text-primary ml-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Money Stats */}
                {mobileMoneyStats && mobileMoneyStats.totalTransactions > 0 && (
                  <div className="p-3 rounded-xl bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Your Mobile Money Stats</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center">
                        <p className="text-lg font-bold">{mobileMoneyStats.completedTransactions}</p>
                        <p className="text-xs text-muted-foreground">Successful</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{mobileMoneyStats.pendingTransactions}</p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">${(mobileMoneyStats.totalPaid / 100).toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Total Paid</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pay Button */}
                <Button
                  className="w-full gradient-primary"
                  onClick={async () => {
                    if (!selectedMobileProvider) {
                      toast.error("Please select a payment provider");
                      return;
                    }
                    if (!mobileMoneyPhone) {
                      toast.error("Please enter your mobile money number");
                      return;
                    }
                    setIsInitiatingMobilePayment(true);
                    try {
                      if (selectedMobileProvider === "mtn_momo") {
                        const result = await initiateMtnPayment({
                          amount: 5,
                          currency: "USD",
                          phoneNumber: mobileMoneyPhone,
                          email: user?.email || "",
                          name: user?.name || "",
                          description: "FarmBond Pro Subscription",
                        });
                        toast.success(result.message);
                      } else if (selectedMobileProvider === "airtel_money") {
                        const result = await initiateAirtelPayment({
                          amount: 5,
                          currency: "USD",
                          phoneNumber: mobileMoneyPhone,
                          email: user?.email || "",
                          name: user?.name || "",
                          countryCode: mobileMoneyCountry,
                          description: "FarmBond Pro Subscription",
                        });
                        toast.success(result.message);
                      }
                    } catch (err) {
                      console.error("Failed to initiate payment:", err);
                      toast.error("Failed to initiate payment. Please try again.");
                    } finally {
                      setIsInitiatingMobilePayment(false);
                    }
                  }}
                  disabled={isInitiatingMobilePayment || !selectedMobileProvider || !mobileMoneyPhone}
                >
                  {isInitiatingMobilePayment ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Initiating Payment...
                    </>
                  ) : (
                    <>
                      <PhoneIcon className="w-4 h-4 mr-2" />
                      Pay $5 with Mobile Money
                    </>
                  )}
                </Button>

                {/* Security Note */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5" />
                  <span>You will receive a prompt on your phone to confirm the payment</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Payment History</CardTitle>
              <CardDescription>Your recent transactions and invoices</CardDescription>
            </div>
            <Link to="/payment-history">
              <Button variant="outline" size="sm">
                View All
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Recent invoice preview */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">FarmBond Pro</p>
                  <p className="text-xs text-muted-foreground">Monthly subscription</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">$5.00</p>
                <p className="text-xs text-green-600">Paid</p>
              </div>
            </div>
            
            <Link to="/payment-history" className="block">
              <div className="text-center py-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <p className="text-sm">View complete payment history</p>
                <p className="text-xs mt-1">Invoices, payment methods, and subscription changes</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Admin Tab (Role-Based Access Control)
// ============================================================

function AdminTab() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  // Real Convex queries and mutations
  const users = useQuery(api.admin.listAllUsers);
  const stats = useQuery(api.admin.getUserStats);
  const updateUserRole = useMutation(api.admin.updateUserRole);
  const updateUserSubscription = useMutation(api.admin.updateUserSubscription);
  const toggleUserStatus = useMutation(api.admin.toggleUserStatus);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const filteredUsers = users?.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleRoleChange = async (userId: string, newRole: string) => {
    setLoadingAction(`role-${userId}`);
    try {
      await updateUserRole({ targetUserId: userId as any, newRole: newRole as any });
    } catch (err) {
      console.error("Failed to update role:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleSubscriptionChange = async (userId: string, newSub: string) => {
    setLoadingAction(`sub-${userId}`);
    try {
      await updateUserSubscription({ targetUserId: userId as any, newTier: newSub as any });
    } catch (err) {
      console.error("Failed to update subscription:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStatusToggle = async (userId: string) => {
    setLoadingAction(`status-${userId}`);
    try {
      await toggleUserStatus({ targetUserId: userId as any });
    } catch (err) {
      console.error("Failed to toggle status:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  // Stats from Convex
  const totalUsers = stats?.total || 0;
  const activeUsers = stats?.activeUsers || 0;
  const proUsers = (stats?.bySubscription?.pro || 0);

  // Loading state
  if (users === undefined || stats === undefined) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <div className="animate-pulse space-y-2">
                  <div className="h-3 bg-muted rounded w-20" />
                  <div className="h-8 bg-muted rounded w-12" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="border-border/50">
          <CardContent className="p-8">
            <div className="flex items-center justify-center text-muted-foreground">
              <p className="text-sm">Loading user data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Users", value: totalUsers, icon: Users, color: "bg-blue-500", change: "+12 this week" },
          { label: "Active Users", value: activeUsers, icon: UserCheck, color: "bg-green-500", change: `${totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}% of total` },
          { label: "Pro Users", value: proUsers, icon: Crown, color: "bg-purple-500", change: `$${proUsers * 5}/mo revenue` },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    <p className="text-xs text-green-500 mt-1">{stat.change}</p>
                  </div>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${stat.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* User Management */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">User Management</CardTitle>
              <CardDescription>Manage user roles, subscriptions, and access</CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  className="pl-9 h-9 w-48"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-1" />
                Filter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredUsers.map((u) => {
              const roleInfo = roleConfig[u.role] || roleConfig.farmer;
              const subInfo = subscriptionConfig[u.subscriptionTier] || subscriptionConfig.free;
              const RoleIcon = roleInfo.icon;

              return (
                <div
                  key={u._id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-muted/30 transition-colors"
                >
                  {/* User Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {u.name?.charAt(0) || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{u.name || "Unknown"}</p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email || "No email"}</p>
                    </div>
                  </div>

                  {/* Role Badge */}
                  <div className="flex items-center gap-2">
                    <Badge className={`${roleInfo.color} text-xs`}>
                      <RoleIcon className="w-3 h-3 mr-1" />
                      {roleInfo.label}
                    </Badge>
                  </div>

                  {/* Subscription Badge */}
                  <Badge className={`${subInfo.color} text-xs`}>{subInfo.label}</Badge>

                  {/* Last Active */}
                  <span className="text-xs text-muted-foreground hidden md:inline w-20">
                    {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleDateString() : "Never"}
                  </span>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={loadingAction !== null}>
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuLabel>Manage User</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Change Role</DropdownMenuLabel>
                      {Object.entries(roleConfig).map(([key, config]) => (
                        <DropdownMenuItem key={key} onClick={() => handleRoleChange(u._id, key)} disabled={loadingAction !== null}>
                          <config.icon className="w-4 h-4 mr-2" />
                          {config.label}
                          {u.role === key && <CheckCircle2 className="w-3 h-3 ml-auto text-green-500" />}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Subscription</DropdownMenuLabel>
                      {Object.entries(subscriptionConfig).map(([key, config]) => (
                        <DropdownMenuItem key={key} onClick={() => handleSubscriptionChange(u._id, key)} disabled={loadingAction !== null}>
                          {config.label}
                          {u.subscriptionTier === key && <CheckCircle2 className="w-3 h-3 ml-auto text-green-500" />}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => handleStatusToggle(u._id)}
                        disabled={loadingAction !== null || u._id === user?._id}
                        className="text-red-500"
                      >
                        <UserX className="w-4 h-4 mr-2" />
                        Suspend User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Role Permissions Overview */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Role Permissions</CardTitle>
          <CardDescription>Overview of what each role can access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-2 font-medium text-muted-foreground">Feature</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Farmer</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Agronomist</th>
                  <th className="text-center py-2 font-medium text-muted-foreground">Admin</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: "Farm Management", farmer: true, agronomist: false, admin: true },
                  { feature: "AI Assistant", farmer: true, agronomist: true, admin: true },
                  { feature: "Satellite Monitoring", farmer: true, agronomist: true, admin: true },
                  { feature: "Consultation Booking", farmer: true, agronomist: true, admin: false },
                  { feature: "Knowledge Articles", farmer: false, agronomist: true, admin: true },
                  { feature: "User Management", farmer: false, agronomist: false, admin: true },
                  { feature: "Subscription Management", farmer: false, agronomist: false, admin: true },
                  { feature: "Audit Logs", farmer: false, agronomist: false, admin: true },
                ].map((row, i) => (
                  <tr key={i} className="border-b border-border/30 last:border-0">
                    <td className="py-2.5 text-sm">{row.feature}</td>
                    <td className="text-center py-2.5">
                      {row.farmer ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-center py-2.5">
                      {row.agronomist ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-center py-2.5">
                      {row.admin ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Main Settings Page
// ============================================================


// Appearance Tab
function AppearanceTab({ currentTheme, setTheme, unitSystem, setUnits, timezone, setTimezone, currency, setCurrency }: { currentTheme: string; setTheme: (t: any) => void; unitSystem: string; setUnits: (u: any) => void; timezone: string; setTimezone: (tz: string) => void; currency: string; setCurrency: (c: string) => void }) {
  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="text-base">Theme</CardTitle>
          <p className="text-sm text-muted-foreground">Choose a color theme that suits your preference</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setTheme(theme.id)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all hover:shadow-md ${
                  currentTheme === theme.id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                    style={{ backgroundColor: theme.preview }}
                  />
                  <div>
                    <p className="font-medium text-sm">{theme.name}</p>
                    <p className="text-xs text-muted-foreground">{theme.description}</p>
                  </div>
                </div>
                {currentTheme === theme.id && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Settings() {
  const { theme: currentTheme, setTheme } = useTheme();
  const { unitSystem, setUnits } = useUnits();
  const { timezone, setTimezone } = useTimezone();
  const { currency, setCurrency } = useCurrency();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account preferences and configuration</p>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="h-auto p-1 bg-muted/50 flex flex-wrap">
              <TabsTrigger value="profile" className="gap-2">
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Profile</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="w-4 h-4" />
                <span className="hidden sm:inline">Notifications</span>
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Security</span>
              </TabsTrigger>
              <TabsTrigger value="subscription" className="gap-2">
                <CreditCard className="w-4 h-4" />
                <span className="hidden sm:inline">Subscription</span>
              </TabsTrigger>
              <TabsTrigger value="appearance" className="gap-2">
                <Palette className="w-4 h-4" />
                <span className="hidden sm:inline">Appearance</span>
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="admin" className="gap-2">
                  <Users className="w-4 h-4" />
                  <span className="hidden sm:inline">Admin</span>
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="profile">
              <ProfileTab />
            </TabsContent>
            <TabsContent value="notifications">
              <NotificationsTab />
            </TabsContent>
            <TabsContent value="security">
              <SecurityTab />
            </TabsContent>
            <TabsContent value="subscription">
              <SubscriptionTab />
            </TabsContent>
            <TabsContent value="appearance">
              <AppearanceTab currentTheme={currentTheme} setTheme={setTheme} unitSystem={unitSystem} setUnits={setUnits} timezone={timezone} setTimezone={setTimezone} currency={currency} setCurrency={setCurrency} />
            </TabsContent>
            {isAdmin && (
              <TabsContent value="admin">
                <AdminTab />
              </TabsContent>
            )}
          </Tabs>
        </motion.div>
      </div>
    </AppLayout>
  );
}
