import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Save,
  Camera,
  Mail,
  Phone,
  MapPin,
  Globe,
  Lock,
  Key,
  Smartphone,
  Trash2,
  Download,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Sprout,
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
      {/* Avatar */}
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

      {/* Personal Info */}
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

      {/* Farm Preferences */}
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

      {/* Save Button */}
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
                <Switch
                  checked={notifications[item.key]}
                  onCheckedChange={() => toggleNotification(item.key)}
                />
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
            <Switch
              checked={notifications.emailDigest}
              onCheckedChange={() => toggleNotification("emailDigest")}
            />
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
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Password */}
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

      {/* Two-Factor Authentication */}
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
                <p className="text-sm font-medium">2FA via Authenticator App</p>                <p className="text-xs text-muted-foreground">Use an authenticator app to generate one-time codes</p>
              </div>
            </div>
            <Button variant="outline" size="sm">Enable</Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
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

      {/* Danger Zone */}
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
// Subscription Tab
// ============================================================

function SubscriptionTab() {
  const { user } = useAuth();
  const tier = user?.subscriptionTier || "free";

  return (
    <div className="space-y-6">
      {/* Current Plan */}
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
            <div>
              <p className="text-lg font-bold capitalize">{tier} Plan</p>
              <p className="text-sm text-muted-foreground">
                {tier === "free" ? "Limited features • 1 farm" : "Unlimited access • Priority support"}
              </p>
            </div>
          </div>

          {/* Usage */}
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

      {/* Upgrade Options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { name: "Pro", price: "$29", period: "/month", features: ["Unlimited farms", "Unlimited AI", "Satellite monitoring", "Advanced analytics"], popular: true },
          { name: "Enterprise", price: "$99", period: "/month", features: ["Everything in Pro", "API access", "Custom integrations", "Dedicated support"], popular: false },
        ].map((plan, i) => (
          <Card key={i} className={`border-border/50 ${plan.popular ? "border-primary/50" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                {plan.popular && <Badge className="gradient-primary text-[10px]">Recommended</Badge>}
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground text-sm">{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2">
                {plan.features.map((feature, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button className={`w-full ${plan.popular ? "gradient-primary" : ""}`} variant={plan.popular ? "default" : "outline"}>
                {tier === plan.name.toLowerCase() ? "Current Plan" : "Upgrade"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment History */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payment History</CardTitle>
          <CardDescription>Your recent transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No payment history yet</p>
            <p className="text-xs mt-1">Upgrade to Pro to unlock premium features</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// Main Settings Page
// ============================================================

export default function Settings() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account preferences and configuration</p>
        </motion.div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="h-auto p-1 bg-muted/50">
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
          </Tabs>
        </motion.div>
      </div>
    </AppLayout>
  );
}
