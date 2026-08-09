import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { ContentManagement } from "@/components/admin/ContentManagement";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  DollarSign,
  TrendingUp,
  Activity,
  Shield,
  Sprout,
  BookOpen,
  RefreshCw,
  FileText,
  Megaphone,
  LifeBuoy,
  ScrollText,
  Inbox,
  Trash2,
  Power,
} from "lucide-react";

// ============================================================
// Admin Dashboard — real Convex data
//
// Every statistic below is derived from backend queries. Tabs that
// have no backend module yet (Support tickets) are shown with an
// honest "not available" state instead of fake data.
// ============================================================

const ROLES = ["farmer", "agronomist", "admin", "super_admin"] as const;
const TIERS = ["free", "pro"] as const;

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <Icon className={`w-5 h-5 ${color}`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [tab, setTab] = useState<string>("overview");
  const [seeding, setSeeding] = useState(false);
  const [seedResult, setSeedResult] = useState<string | null>(null);
  const [seedingKb, setSeedingKb] = useState(false);
  const [kbResult, setKbResult] = useState<string | null>(null);

  // Real backend data
  const stats = useQuery(api.admin.getUserStats);
  const subStats = useQuery(api.subscriptions.getSubscriptionStats);
  const users = usePaginatedQuery(api.admin.listAllUsersPaginated, {}, { numItems: 50 });
  const auditLogs = useQuery(api.admin.listAuditLogs);
  const agronomists = useQuery(api.marketplace.listAgronomists, {});
  const companies = useQuery(api.marketplace.listCompanies, {});
  const seeds = useQuery(api.marketplace.listSeeds, {});
  const articles = useQuery(api.knowledgeArticles.listAll);
  const ads = useQuery(api.ads.listAllAds);
  const adStats = useQuery(api.ads.getAdStats);

  const updateUserRole = useMutation(api.admin.updateUserRole);
  const updateUserSubscription = useMutation(api.admin.updateUserSubscription);
  const toggleUserStatus = useMutation(api.admin.toggleUserStatus);
  const deleteArticle = useMutation(api.knowledgeArticles.deleteArticle);
  const deleteAd = useMutation(api.ads.deleteAd);
  const updateAd = useMutation(api.ads.updateAd);
  const createAd = useMutation(api.ads.createAd);
  const seedMarketplace = useMutation(api.seedData.seedMarketplace);
  const seedKnowledgeArticles = useMutation(api.seedData.seedKnowledgeArticles);

  // Ad creation form state
  const [adForm, setAdForm] = useState({
    title: "",
    description: "",
    adType: "sponsor",
    priority: 5,
    maxImpressionsPerUser: 10,
    impressionCooldownDays: 1,
    targetRoles: "farmer, agronomist",
    targetSubscriptionTiers: "free, pro",
    ctaText: "Learn more",
    ctaUrl: "https://farmbond.app",
    sponsorName: "",
  });
  const [creatingAd, setCreatingAd] = useState(false);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedResult(null);
    try {
      const result = await seedMarketplace();
      setSeedResult(
        `Seeded: ${result.agronomists} agronomists, ${result.companies} companies, ${result.seeds} seeds`
      );
      toast.success("Marketplace data seeded");
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
      toast.success("Knowledge articles seeded");
    } catch (err) {
      setKbResult("Error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSeedingKb(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    try {
      await updateUserRole({ targetUserId: targetUserId as any, newRole: newRole as any });
      toast.success(`Role updated to ${newRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
  };

  const handleTierChange = async (targetUserId: string, newTier: string) => {
    try {
      await updateUserSubscription({ targetUserId: targetUserId as any, newTier: newTier as any });
      toast.success(`Subscription updated to ${newTier}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update subscription");
    }
  };

  const handleToggleStatus = async (targetUserId: string) => {
    try {
      await toggleUserStatus({ targetUserId: targetUserId as any });
      toast.success("User status updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleDeleteArticle = async (articleId: string) => {
    try {
      await deleteArticle({ articleId: articleId as any });
      toast.success("Article deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete article");
    }
  };

  const handleToggleAd = async (adId: string, isActive: boolean) => {
    try {
      await updateAd({ adId: adId as any, isActive: !isActive });
      toast.success(isActive ? "Ad paused" : "Ad activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update ad");
    }
  };

  const handleDeleteAd = async (adId: string) => {
    try {
      await deleteAd({ adId: adId as any });
      toast.success("Ad deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete ad");
    }
  };

  const handleCreateAd = async () => {
    setCreatingAd(true);
    try {
      await createAd({
        title: adForm.title.trim(),
        description: adForm.description.trim(),
        adType: adForm.adType as any,
        priority: adForm.priority,
        maxImpressionsPerUser: adForm.maxImpressionsPerUser,
        impressionCooldownDays: adForm.impressionCooldownDays,
        targetRoles: adForm.targetRoles.split(",").map((s) => s.trim()).filter(Boolean),
        targetSubscriptionTiers: adForm.targetSubscriptionTiers.split(",").map((s) => s.trim()).filter(Boolean),
        ctaText: adForm.ctaText.trim(),
        ctaUrl: adForm.ctaUrl.trim(),
        sponsorName: adForm.sponsorName.trim() || undefined,
        startDate: Date.now(),
        endDate: Date.now() + 30 * 24 * 60 * 60 * 1000,
      });
      toast.success("Ad created and now active");
      setAdForm((f) => ({ ...f, title: "", description: "", sponsorName: "" }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create ad");
    } finally {
      setCreatingAd(false);
    }
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: Activity },
    { id: "users", label: "Users", icon: Users },
    { id: "subscriptions", label: "Subscriptions", icon: DollarSign },
    { id: "content", label: "Content", icon: BookOpen },
    { id: "ads", label: "Advertising", icon: Megaphone },
    { id: "support", label: "Support", icon: LifeBuoy },
    { id: "audit", label: "Audit Log", icon: ScrollText },
  ];

  const marketplaceCount = (agronomists?.length ?? 0) + (companies?.length ?? 0) + (seeds?.length ?? 0);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform management — all data is live from Convex</p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((t) => (
            <Button
              key={t.id}
              variant={tab === t.id ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.id)}
            >
              <t.icon className="w-4 h-4 mr-1.5" />
              {t.label}
            </Button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Users" value={stats?.total ?? "—"} icon={Users} color="text-blue-500" />
              <StatCard label="Active (7 days)" value={stats?.activeUsers ?? "—"} icon={Activity} color="text-green-500" />
              <StatCard label="Pro Subscriptions" value={subStats?.activePaid ?? "—"} icon={TrendingUp} color="text-purple-500" />
              <StatCard label="Est. MRR" value={subStats ? `$${subStats.mrr}` : "—"} sub="$5/month per pro user" icon={DollarSign} color="text-green-500" />
              <StatCard label="Marketplace Items" value={marketplaceCount} icon={Sprout} color="text-emerald-500" />
              <StatCard label="Active Ads" value={adStats?.activeAds ?? "—"} icon={Megaphone} color="text-amber-500" />
              <StatCard label="Ad Impressions" value={adStats?.totalImpressions ?? "—"} icon={FileText} color="text-orange-500" />
              <StatCard label="Audit Entries" value={auditLogs?.length ?? "—"} sub="last 100" icon={ScrollText} color="text-slate-500" />
            </div>

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sprout className="w-4 h-4 text-green-500" /> Data Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Seed reference data for the marketplace, knowledge base and farming events.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={handleSeed} disabled={seeding} className="gradient-primary">
                    {seeding ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Seeding...</> : <><Sprout className="w-4 h-4 mr-2" /> Seed Marketplace</>}
                  </Button>
                  <Button onClick={handleSeedKb} disabled={seedingKb} variant="outline">
                    {seedingKb ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Seeding...</> : <><BookOpen className="w-4 h-4 mr-2" /> Seed Knowledge Articles</>}
                  </Button>
                </div>
                {seedResult && <p className={"text-sm " + (seedResult.startsWith("Error") ? "text-red-500" : "text-green-600")}>{seedResult}</p>}
                {kbResult && <p className={"text-sm " + (kbResult.startsWith("Error") ? "text-red-500" : "text-green-600")}>{kbResult}</p>}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "users" && (
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-base">User Management</CardTitle></CardHeader>
            <CardContent>
              {users.isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : users.results.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No users found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium">Name</th>
                        <th className="text-left py-2 pr-4 font-medium">Email</th>
                        <th className="text-left py-2 pr-4 font-medium">Role</th>
                        <th className="text-left py-2 pr-4 font-medium">Plan</th>
                        <th className="text-left py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.results.map((u: any) => (
                        <tr key={u._id} className="border-b last:border-0">
                          <td className="py-2 pr-4">{u.name || "—"}</td>
                          <td className="py-2 pr-4 text-muted-foreground">{u.email || "—"}</td>
                          <td className="py-2 pr-4">
                            <select
                              value={u.role}
                              onChange={(e) => handleRoleChange(u._id, e.target.value)}
                              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                            >
                              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </td>
                          <td className="py-2 pr-4">
                            <select
                              value={u.subscriptionTier}
                              onChange={(e) => handleTierChange(u._id, e.target.value)}
                              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
                            >
                              {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </td>
                          <td className="py-2">
                            <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(u._id)}>
                              <Power className="w-3.5 h-3.5 mr-1" /> Suspend/Activate
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {users.canLoadMore && (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => users.loadMore()}
                    disabled={users.isLoadingMore}
                  >
                    {users.isLoadingMore ? "Loading…" : "Load more users"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "subscriptions" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Active Paid" value={subStats?.activePaid ?? "—"} icon={TrendingUp} color="text-green-500" />
              <StatCard label="Expiring Soon" value={subStats?.expiringSoon ?? "—"} icon={Activity} color="text-amber-500" />
              <StatCard label="Expired" value={subStats?.expired ?? "—"} icon={Shield} color="text-red-500" />
              <StatCard label="Free Tier" value={subStats?.free ?? "—"} icon={Users} color="text-blue-500" />
            </div>
            <Card className="border-border/50">
              <CardContent className="p-5 text-sm">
                <p><strong>Total users:</strong> {subStats?.total ?? "—"}</p>
                <p className="mt-1"><strong>Estimated MRR:</strong> ${subStats?.mrr ?? "—"} (pro users × $5/month)</p>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "content" && (
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-base">Knowledge Articles</CardTitle></CardHeader>
            <CardContent>
              {!articles ? (
                <Skeleton className="h-40 w-full" />
              ) : articles.length === 0 ? (
                <div className="py-8 text-center">
                  <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No articles yet. Seed the knowledge base from the Overview tab.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {articles.map((a: any) => (
                    <div key={a._id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{a.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.category} • {a.views} views • {a.likes} likes • {a.isPublished ? "Published" : "Draft"}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteArticle(a._id)}>
                        <Trash2 className="w-3.5 h-3.5 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "ads" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Ads" value={adStats?.totalAds ?? "—"} icon={Megaphone} color="text-amber-500" />
              <StatCard label="Active" value={adStats?.activeAds ?? "—"} icon={Activity} color="text-green-500" />
              <StatCard label="Impressions" value={adStats?.totalImpressions ?? "—"} icon={FileText} color="text-blue-500" />
              <StatCard label="CTR" value={adStats ? `${adStats.clickThroughRate.toFixed(2)}%` : "—"} icon={TrendingUp} color="text-purple-500" />
            </div>

            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-base">Create Ad (advertiser pays to promote)</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input className="h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Title" value={adForm.title} onChange={(e) => setAdForm({ ...adForm, title: e.target.value })} />
                  <input className="h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Description" value={adForm.description} onChange={(e) => setAdForm({ ...adForm, description: e.target.value })} />
                  <select className="h-9 rounded-lg border border-border bg-background px-3 text-sm" value={adForm.adType} onChange={(e) => setAdForm({ ...adForm, adType: e.target.value })}>
                    <option value="sponsor">Sponsor</option>
                    <option value="seasonal">Seasonal</option>
                    <option value="pro_upgrade">Pro Upgrade</option>
                    <option value="cross_sell">Cross-sell</option>
                  </select>
                  <input className="h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="CTA text" value={adForm.ctaText} onChange={(e) => setAdForm({ ...adForm, ctaText: e.target.value })} />
                  <input className="h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="CTA URL" value={adForm.ctaUrl} onChange={(e) => setAdForm({ ...adForm, ctaUrl: e.target.value })} />
                  <input className="h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Sponsor name (optional)" value={adForm.sponsorName} onChange={(e) => setAdForm({ ...adForm, sponsorName: e.target.value })} />
                  <input className="h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Target roles (comma)" value={adForm.targetRoles} onChange={(e) => setAdForm({ ...adForm, targetRoles: e.target.value })} />
                  <input className="h-9 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Target tiers (comma)" value={adForm.targetSubscriptionTiers} onChange={(e) => setAdForm({ ...adForm, targetSubscriptionTiers: e.target.value })} />
                </div>
                <Button onClick={handleCreateAd} disabled={creatingAd || !adForm.title} className="mt-3 gradient-primary">
                  {creatingAd ? "Creating..." : "Create Ad"}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader className="pb-3"><CardTitle className="text-base">All Ads</CardTitle></CardHeader>
              <CardContent>
                {!ads ? (
                  <Skeleton className="h-40 w-full" />
                ) : ads.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">No ads yet.</p>
                ) : (
                  <div className="space-y-2">
                    {ads.map((ad: any) => (
                      <div key={ad._id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ad.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {ad.adType} • {ad.totalImpressions} impressions • {ad.totalClicks} clicks •{" "}
                            <Badge variant={ad.isActive ? "default" : "secondary"} className="text-[10px]">{ad.isActive ? "Active" : "Paused"}</Badge>
                          </p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleToggleAd(ad._id, ad.isActive)}>
                          <Power className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteAd(ad._id)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "support" && (
          <Card className="border-border/50">
            <CardContent className="p-12 text-center">
              <LifeBuoy className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">Support Tickets</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                The support-ticket backend is not available yet, so this section shows no data.
                It will be enabled when the ticket system ships.
              </p>
            </CardContent>
          </Card>
        )}

        {tab === "audit" && (
          <Card className="border-border/50">
            <CardHeader className="pb-3"><CardTitle className="text-base">Recent Platform Activity (audit log)</CardTitle></CardHeader>
            <CardContent>
              {!auditLogs ? (
                <Skeleton className="h-40 w-full" />
              ) : auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No audit entries yet.</p>
              ) : (
                <div className="space-y-2 max-h-[480px] overflow-y-auto">
                  {auditLogs.map((log: any) => (
                    <div key={log._id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{log.action}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.resource} • {log.resourceId} • {new Date(log.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Shield className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Content & Marketplace Management (Phase 4B-4E) */}
        <ContentManagement />
      </div>
    </AppLayout>
  );
}
