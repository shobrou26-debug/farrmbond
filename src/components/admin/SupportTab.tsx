import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LifeBuoy, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
};

export function SupportTab() {
  const [filter, setFilter] = useState<string>("open");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const tickets = useQuery(api.supportTickets.listAllTickets, { status: filter === "all" ? undefined : filter });
  const replyMutation = useMutation(api.supportTickets.adminReplyToTicket);
  const statusMutation = useMutation(api.supportTickets.updateTicketStatus);

  const handleReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    setReplyingId(ticketId);
    try {
      await replyMutation({ ticketId: ticketId as any, content: replyText.trim() });
      toast.success("Reply sent");
      setReplyText("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to reply");
    } finally {
      setReplyingId(null);
    }
  };

  const handleStatusChange = async (ticketId: string, status: string) => {
    try {
      await statusMutation({ ticketId: ticketId as any, status: status as any });
      toast.success(`Status changed to ${status}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update status");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {["open", "in_progress", "resolved", "closed", "all"].map((s) => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => { setFilter(s); setExpandedId(null); }}>
            {s.replace("_", " ").charAt(0).toUpperCase() + s.replace("_", " ").slice(1)}
          </Button>
        ))}
      </div>

      {!tickets ? (
        <div className="space-y-3">{[1, 2].map((i) => <Card key={i} className="h-20 animate-pulse" />)}</div>
      ) : tickets.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="p-12 text-center">
            <LifeBuoy className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
            <h3 className="font-medium mb-1">No tickets</h3>
            <p className="text-sm text-muted-foreground">No tickets match the current filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t: any) => (
            <Card key={t._id} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-start justify-between cursor-pointer" onClick={() => setExpandedId(expandedId === t._id ? null : t._id)}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{t.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t.category} • {t.messageCount} messages • {new Date(t.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge className={STATUS_COLORS[t.status] ?? ""}>{t.status.replace("_", " ")}</Badge>
                </div>

                {expandedId === t._id && (
                  <div className="mt-4 pt-4 border-t border-border space-y-4">
                    <div className="flex gap-2">
                      <select value={t.status} onChange={(e) => handleStatusChange(t._id, e.target.value)}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs">
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <Input placeholder="Type admin reply..." value={replyText}
                        onChange={(e) => setReplyText(e.target.value)} />
                      <Button onClick={() => handleReply(t._id)} disabled={!replyText.trim() || replyingId === t._id} size="sm">
                        {replyingId === t._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}