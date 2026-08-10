import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LifeBuoy, Plus, MessageSquare, ArrowLeft, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

export default function Support() {
  const [view, setView] = useState<"list" | "detail" | "create">("list");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("technical");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const tickets = useQuery(api.supportTickets.listMyTickets, {});
  const selectedTicket = useQuery(api.supportTickets.getMyTicket, selectedTicketId ? { ticketId: selectedTicketId as any } : "skip");
  const createTicket = useMutation(api.supportTickets.createTicket);
  const replyToTicket = useMutation(api.supportTickets.replyToTicket);

  const handleCreate = async () => {
    if (!subject.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await createTicket({ subject: subject.trim(), description: description.trim(), category, priority });
      toast.success("Ticket created!");
      setView("list");
      setSubject("");
      setDescription("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create ticket");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !selectedTicketId) return;
    setSubmitting(true);
    try {
      await replyToTicket({ ticketId: selectedTicketId as any, content: replyContent.trim() });
      toast.success("Reply sent");
      setReplyContent("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send reply");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        {view === "list" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Support</h1>
                <p className="text-muted-foreground mt-1">Create and manage support tickets</p>
              </div>
              <Button onClick={() => setView("create")} className="gradient-primary">
                <Plus className="w-4 h-4 mr-1" /> New Ticket
              </Button>
            </div>
            {!tickets ? (
              <div className="space-y-3">{[1, 2].map((i) => <Card key={i} className="h-20 animate-pulse" />)}</div>
            ) : tickets.length === 0 ? (
              <Card className="border-border/50">
                <CardContent className="p-12 text-center">
                  <LifeBuoy className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                  <h3 className="font-medium mb-1">No tickets yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">Create a ticket and our team will respond.</p>
                  <Button onClick={() => setView("create")} className="gradient-primary">Create Ticket</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {tickets.map((t) => (
                  <Card key={t._id} className="border-border/50 cursor-pointer hover:shadow-md transition-all"
                    onClick={() => { setSelectedTicketId(t._id); setView("detail"); }}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.subject}</p>
                        <p className="text-xs text-muted-foreground">{t.category} • {t.messageCount} messages</p>
                      </div>
                      <Badge className={STATUS_COLORS[t.status] ?? ""}>{t.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {view === "create" && (
          <div className="max-w-lg mx-auto">
            <Button variant="ghost" onClick={() => setView("list")} className="mb-4"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            <Card className="border-border/50">
              <CardHeader><CardTitle>New Support Ticket</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Input placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <Textarea placeholder="Describe your issue..." value={description} onChange={(e) => setDescription(e.target.value)} rows={5} />
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technical">Technical</SelectItem>
                    <SelectItem value="billing">Billing</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                  <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
                <Button onClick={handleCreate} disabled={!subject.trim() || !description.trim() || submitting} className="gradient-primary w-full">
                  {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</> : "Create Ticket"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {view === "detail" && selectedTicket && (
          <div className="max-w-2xl mx-auto">
            <Button variant="ghost" onClick={() => setView("list")} className="mb-4"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            <Card className="border-border/50 mb-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{selectedTicket.subject}</CardTitle>
                  <Badge className={STATUS_COLORS[selectedTicket.status] ?? ""}>{selectedTicket.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{selectedTicket.category} • {selectedTicket.priority} priority</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {(selectedTicket.messages ?? []).map((msg: any, i: number) => (
                  <div key={i} className={`flex gap-3 ${msg.senderId === (selectedTicket as any).userId ? "" : "flex-row-reverse"}`}>
                    <div className={`p-3 rounded-xl max-w-[80%] ${msg.senderId === (selectedTicket as any).userId ? "bg-muted" : "bg-primary/10"}`}>
                      <p className="text-sm">{msg.content}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(msg.timestamp).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                {selectedTicket.status !== "closed" && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Input placeholder="Type your reply..." value={replyContent} onChange={(e) => setReplyContent(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReply(); } }} />
                    <Button onClick={handleReply} disabled={!replyContent.trim() || submitting} size="icon">
                      {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}