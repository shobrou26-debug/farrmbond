import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sprout, CheckCircle2, XCircle, Eye, EyeOff, Trash2, Plus, Pencil, Loader2 } from "lucide-react";

// ============================================================
// 1. Agronomist Applications
// ============================================================

function AgronomistApplicationsSection() {
  const applications = useQuery(api.marketplace.listAgronomistApplications, { status: "pending" });
  const review = useMutation(api.marketplace.reviewAgronomistApplication);
  const [busy, setBusy] = useState<string | null>(null);

  const handle = async (profileId: string, action: "approve" | "reject") => {
    setBusy(`${action}-${profileId}`);
    try {
      let reason: string | undefined;
      if (action === "reject") {
        reason = window.prompt("Rejection reason (shown to the applicant):") || undefined;
      }
      await review({ profileId: profileId as Id<"agronomistProfiles">, action, reason });
      toast.success(action === "approve" ? "Application approved" : "Application rejected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const isLoading = applications === undefined;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Agronomist Applications</CardTitle>
        <CardDescription>Review and approve expert applications</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading applications...</p>
        ) : applications.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No pending applications.</p>
        ) : (
          applications.map((app) => (
            <div key={app.profileId} className="p-3 rounded-xl border border-border/50 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {app.applicantName} — {app.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {app.specializations.join(", ")} • {app.experience} yrs • {app.applicantEmail}
                  </p>
                </div>
                <Badge className="bg-amber-500/10 text-amber-600 shrink-0">Pending</Badge>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  disabled={busy !== null}
                  onClick={() => handle(app.profileId as Id<"agronomistProfiles">, "approve")}
                >
                  {busy === `approve-${app.profileId}` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  )}
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                  disabled={busy !== null}
                  onClick={() => handle(app.profileId as Id<"agronomistProfiles">, "reject")}
                >
                  <XCircle className="w-3.5 h-3.5 mr-1" />
                  Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// 2. Knowledge Articles
// ============================================================

function KnowledgeSection() {
  const articles = useQuery(api.knowledgeArticles.listAll);
  type ArticleDoc = NonNullable<typeof articles>[number];
  const createArticle = useMutation(api.knowledgeArticles.createArticle);
  const updateArticle = useMutation(api.knowledgeArticles.updateArticle);
  const setPublished = useMutation(api.knowledgeArticles.setArticlePublished);
  const deleteArticle = useMutation(api.knowledgeArticles.deleteArticle);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("crop_management");
  const [tags, setTags] = useState("");

  const openCreate = () => {
    setEditingId(null);
    setTitle(""); setSummary(""); setContent(""); setCategory("crop_management"); setTags("");
    setDialogOpen(true);
  };

  const openEdit = (a: ArticleDoc) => {
    setEditingId(a._id);
    setTitle(a.title); setSummary(a.summary ?? ""); setContent(a.content); setCategory(a.category); setTags((a.tags ?? []).join(", "));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setBusy(true);
    try {
      const tagsArray = tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8);
      if (editingId) {
        await updateArticle({
          articleId: editingId as Id<"knowledgeArticles">,
          title: title.trim(),
          summary: summary.trim() || undefined,
          content,
          category,
          tags: tagsArray,
        });
        toast.success("Article updated");
      } else {
        await createArticle({
          title: title.trim(),
          summary: summary.trim() || "Read more",
          content,
          category,
          tags: tagsArray,
        });
        toast.success("Article created and published");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const togglePublish = async (a: ArticleDoc) => {
    try {        await setPublished({ articleId: a._id as Id<"knowledgeArticles">, published: !a.isPublished });
      toast.success(a.isPublished ? "Article unpublished" : "Article published");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const handleDelete = async (a: ArticleDoc) => {
    if (!window.confirm(`Delete article "${a.title}"?`)) return;
    try {
      await deleteArticle({ articleId: a._id as Id<"knowledgeArticles"> });
      toast.success("Article deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const isLoading = articles === undefined;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Knowledge Base</CardTitle>
            <CardDescription>Create, edit, publish and remove articles</CardDescription>
          </div>
          <Button size="sm" className="gradient-primary" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> New Article
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading articles...</p>
        ) : articles.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No articles yet.</p>
        ) : (
          articles.map((a) => (
            <div key={a._id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/50">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground truncate">{a.category} • {a.views} views</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {a.isPublished ? (
                  <Badge className="bg-green-500/10 text-green-600 text-[10px]">Live</Badge>
                ) : (
                  <Badge className="bg-gray-500/10 text-gray-600 text-[10px]">Draft</Badge>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(a)} title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => togglePublish(a)} title={a.isPublished ? "Unpublish" : "Publish"}>
                  {a.isPublished ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDelete(a)} title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Article" : "New Article"}</DialogTitle>
              <DialogDescription>
                {editingId ? "Changes are saved immediately for readers." : "New articles are published immediately."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Summary</Label>
                <Input value={summary} onChange={(e) => setSummary(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["crop_management", "livestock", "soil", "pest_control", "irrigation", "market", "general"].map((c) => (
                        <SelectItem key={c} value={c}>{c.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input value={tags} onChange={(e) => setTags(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  className="w-full px-3 py-2 text-sm bg-muted/50 rounded-xl border-0 focus:ring-2 focus:ring-primary/20 resize-y"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="gradient-primary" onClick={handleSave} disabled={busy}>
                {busy ? "Saving..." : "Save Article"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 3. Community Moderation
// ============================================================

function CommunityModerationSection() {
  const reported = useQuery(api.community.listReportedPosts);
  const moderate = useMutation(api.community.moderatePost);
  const [busy, setBusy] = useState<string | null>(null);

  const handle = async (postId: string, action: "hide" | "restore") => {
    setBusy(`${action}-${postId}`);
    try {
      await moderate({ postId: postId as Id<"communityPosts">, action });
      toast.success(action === "hide" ? "Post hidden from the community" : "Post restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const isLoading = reported === undefined;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Community Moderation</CardTitle>
        <CardDescription>Review reported posts — hide or restore</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading reports...</p>
        ) : reported.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No reported posts.</p>
        ) : (
          reported.map((p) => (
            <div key={p.postId} className="p-3 rounded-xl border border-border/50 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <Badge className={p.isApproved ? "bg-green-500/10 text-green-600 shrink-0" : "bg-red-500/10 text-red-600 shrink-0"}>
                  {p.isApproved ? "Visible" : "Hidden"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {p.reportCount} report{p.reportCount !== 1 ? "s" : ""}
                {p.openReports > 0 ? ` • ${p.openReports} open` : ""} • {new Date(p.lastReportedAt).toLocaleDateString()}
              </p>
              {p.reasons.length > 0 && (
                <p className="text-xs text-muted-foreground line-clamp-2">"{p.reasons[0]}"</p>
              )}
              <div className="flex gap-2">
                {p.isApproved ? (
                  <Button size="sm" variant="outline" className="text-red-600" disabled={busy !== null}                  onClick={() => handle(p.postId as Id<"communityPosts">, "hide")}>
                    <EyeOff className="w-3.5 h-3.5 mr-1" /> Hide Post
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="text-green-600" disabled={busy !== null}                  onClick={() => handle(p.postId as Id<"communityPosts">, "restore")}>
                    <Eye className="w-3.5 h-3.5 mr-1" /> Restore Post
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// 4. Farming Events
// ============================================================

const EVENT_TYPES = ["training", "expo", "workshop", "sponsored"] as const;

function EventsSection() {
  const events = useQuery(api.farmingEvents.listAllEvents);
  type EventDoc = NonNullable<typeof events>[number];
  const createEvent = useMutation(api.farmingEvents.createEvent);
  const updateEvent = useMutation(api.farmingEvents.updateEvent);
  const deleteEvent = useMutation(api.farmingEvents.deleteEvent);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<(typeof EVENT_TYPES)[number]>("training");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [organizer, setOrganizer] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [maxCapacity, setMaxCapacity] = useState("100");
  const [ticketPrice, setTicketPrice] = useState("Free");

  const openCreate = () => {
    setEditingId(null);
    setTitle(""); setType("training"); setDescription(""); setLocation(""); setOrganizer("");
    setStartDate(""); setEndDate(""); setTime("09:00"); setMaxCapacity("100"); setTicketPrice("Free");
    setDialogOpen(true);
  };

  const openEdit = (e: EventDoc) => {
    setEditingId(e._id);
    setTitle(e.title); setType(e.type); setDescription(e.description); setLocation(e.location); setOrganizer(e.organizer);
    setStartDate(new Date(e.startDate).toISOString().split("T")[0]);
    setEndDate(new Date(e.endDate).toISOString().split("T")[0]);
    setTime(e.time); setMaxCapacity(String(e.maxCapacity)); setTicketPrice(e.ticketPrice);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim() || !location.trim() || !startDate || !endDate) {
      toast.error("Title, description, location and dates are required");
      return;
    }
    const start = new Date(`${startDate}T${time}`).getTime();
    const end = new Date(`${endDate}T${time}`).getTime();
    if (isNaN(start) || isNaN(end) || end < start) {
      toast.error("Invalid event dates");
      return;
    }
    setBusy(true);
    try {
      const base = {
        title: title.trim(),
        type,
        description: description.trim(),
        location: location.trim(),
        startDate: start,
        endDate: end,
        time,
        organizer: organizer.trim() || "FarmBond",
        maxCapacity: parseInt(maxCapacity, 10) || 100,
        ticketPrice: ticketPrice.trim() || "Free",
        sponsored: type === "sponsored",
        tags: [],
      };
      if (editingId) {
        await updateEvent({ eventId: editingId as Id<"farmingEvents">, ...base });
        toast.success("Event updated");
      } else {
        await createEvent(base);
        toast.success("Event created");
      }
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (e: EventDoc) => {
    if (!window.confirm(`Delete event "${e.title}"?`)) return;
    try {
      await deleteEvent({ eventId: e._id as Id<"farmingEvents"> });
      toast.success("Event deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const toggleActive = async (e: EventDoc) => {
    try {
      await updateEvent({ eventId: e._id as Id<"farmingEvents">, isActive: !e.isActive });
      toast.success(e.isActive ? "Event deactivated" : "Event activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  };

  const isLoading = events === undefined;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Farming Events</CardTitle>
            <CardDescription>Create and manage trainings, expos and workshops</CardDescription>
          </div>
          <Button size="sm" className="gradient-primary" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" /> New Event
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading events...</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No events yet.</p>
        ) : (
          events.map((e) => (
            <div key={e._id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border/50">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{e.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {new Date(e.startDate).toLocaleDateString()} • {e.location} • {e.attendees}/{e.maxCapacity} registered
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {e.isActive ? (
                  <Badge className="bg-green-500/10 text-green-600 text-[10px]">Active</Badge>
                ) : (
                  <Badge className="bg-gray-500/10 text-gray-600 text-[10px]">Inactive</Badge>
                )}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(e)} title="Edit">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => toggleActive(e)} title={e.isActive ? "Deactivate" : "Activate"}>
                  {e.isActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDelete(e)} title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Event" : "New Event"}</DialogTitle>
              <DialogDescription>Events are visible to farmers once active.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as (typeof EVENT_TYPES)[number])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Organizer</Label>
                  <Input value={organizer} onChange={(e) => setOrganizer(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  className="w-full px-3 py-2 text-sm bg-muted/50 rounded-xl border-0 focus:ring-2 focus:ring-primary/20 resize-y" />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start date</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End date</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Max capacity</Label>
                  <Input type="number" min={1} value={maxCapacity} onChange={(e) => setMaxCapacity(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Ticket price</Label>
                <Input value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} placeholder="Free or e.g. KES 500" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button className="gradient-primary" onClick={handleSave} disabled={busy}>
                {busy ? "Saving..." : "Save Event"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Combined export
// ============================================================

export function ContentManagement() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sprout className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Content & Marketplace Management</h2>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AgronomistApplicationsSection />
        <KnowledgeSection />
        <CommunityModerationSection />
        <EventsSection />
      </div>
    </div>
  );
}
