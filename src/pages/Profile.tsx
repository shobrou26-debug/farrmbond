import { useQuery } from "convex/react";
import { Link } from "react-router";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Globe,
  Sprout,
  Award,
  GraduationCap,
  Star,
  Calendar,
  Settings,
  Shield,
  FileText,
  DollarSign,
  Languages,
} from "lucide-react";

const roleConfig: Record<string, { label: string; color: string }> = {
  farmer: { label: "Farmer", color: "bg-green-500/10 text-green-600" },
  agronomist: { label: "Agronomist", color: "bg-blue-500/10 text-blue-600" },
  admin: { label: "Admin", color: "bg-purple-500/10 text-purple-600" },
  super_admin: { label: "Super Admin", color: "bg-amber-500/10 text-amber-600" },
};

export default function Profile() {
  const { user: authUser } = useAuth();
  const user = useQuery(api.users.currentUser);

  if (!user) {
    return (
      <AppLayout>
        <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
          <div className="h-40 bg-muted/50 rounded-2xl animate-pulse" />
          <div className="space-y-3 mt-6">
            <div className="h-5 bg-muted/50 rounded-lg animate-pulse w-1/2" />
            <div className="h-4 bg-muted/50 rounded-lg animate-pulse w-2/3" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const role = user.role || "farmer";
  const roleCfg = roleConfig[role] || roleConfig.farmer;
  const isAgronomist = role === "agronomist";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
          <p className="text-muted-foreground mt-1">
            Your personal and professional details
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="lg:col-span-2"
          >
            <Card className="border-border/50">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-start gap-5">
                  <Avatar className="w-20 h-20 rounded-2xl">
                    <AvatarImage src={user.image || ""} />
                    <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                      {user.name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-2xl font-bold">{user.name || "FarmBond User"}</h2>
                      <Badge className={roleCfg.color}>{roleCfg.label}</Badge>
                    </div>
                    <p className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
                      <Mail className="w-3.5 h-3.5" />
                      {user.email || "No email set"}
                    </p>
                    {user.bio && (
                      <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-6 border-t border-border/50">
                  <ProfileField icon={Phone} label="Phone" value={user.phone || "Not set"} />
                  <ProfileField icon={MapPin} label="Location" value={user.location || "Not set"} />
                  <ProfileField icon={Globe} label="Country" value={user.country || "Not set"} />
                  <ProfileField icon={Sprout} label="Farm size" value={user.farmSize ? `${user.farmSize} ha` : "Not set"} />
                  <ProfileField icon={GraduationCap} label="Experience" value={user.experience || "Not set"} />
                  <ProfileField icon={Languages} label="Language" value={user.language || "Not set"} />
                </div>

                {/* Agronomist-specific fields */}
                {isAgronomist && (
                  <div className="mt-6 pt-6 border-t border-border/50">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Award className="w-4 h-4 text-blue-500" />
                      Agronomist Profile
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">Specialties</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(user.specialties || []).length === 0 ? (
                            <span className="text-sm text-muted-foreground">Not set</span>
                          ) : (
                            user.specialties!.map((s) => (
                              <Badge key={s} variant="secondary">{s}</Badge>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <ProfileField
                          icon={DollarSign}
                          label="Hourly rate"
                          value={user.hourlyRate ? `KES ${user.hourlyRate}` : "Not set"}
                        />
                        <ProfileField
                          icon={Star}
                          label="Rating"
                          value={user.rating ? `${user.rating.toFixed(1)} / 5.0` : "No ratings yet"}
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-xs text-muted-foreground mb-2">Certifications</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(user.certifications || []).length === 0 ? (
                            <span className="text-sm text-muted-foreground">Not set</span>
                          ) : (
                            user.certifications!.map((c) => (
                              <Badge key={c} variant="outline" className="text-blue-600">{c}</Badge>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-border/50">
                  <Link to="/settings">
                    <Button className="gradient-primary">
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Button>
                  </Link>
                  {isAgronomist && (
                    <Link to="/consultations">
                      <Button variant="outline">
                        <Calendar className="w-4 h-4 mr-2" />
                        Manage Consultations
                      </Button>
                    </Link>
                  )}
                  <Link to="/payment-history">
                    <Button variant="outline">
                      <FileText className="w-4 h-4 mr-2" />
                      Billing & Invoices
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Sidebar: subscription + account */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="space-y-4"
          >
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-green-600" />
                  Subscription
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Plan</span>
                  <Badge className={user.subscriptionTier === "pro" ? "bg-green-500/10 text-green-600" : "bg-muted"}>
                    {user.subscriptionTier === "pro" ? "Pro" : "Free"}
                  </Badge>
                </div>
                {user.subscriptionEndDate ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Renews</span>
                    <span className="text-sm font-medium">
                      {new Date(user.subscriptionEndDate).toLocaleDateString()}
                    </span>
                  </div>
                ) : user.trialEndDate ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Trial ends</span>
                    <span className="text-sm font-medium">
                      {new Date(user.trialEndDate).toLocaleDateString()}
                    </span>
                  </div>
                ) : null}
                <Link to="/settings" className="block">
                  <Button variant="outline" size="sm" className="w-full">
                    Manage Plan
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" />
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Member since</span>
                  <span className="font-medium">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Account</span>
                  <span className="font-medium text-green-600">Active</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AppLayout>
  );
}

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted/60">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
