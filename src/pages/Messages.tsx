import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { Mail, Send, ArrowLeft, Loader2, User, MessageSquare } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export default function Messages() {
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const { user } = useAuth();
  const conversations = useQuery(api.messaging.listConversations);
  const messages = useQuery(
    api.messaging.listMessages,
    selectedConvoId ? { conversationId: selectedConvoId } : "skip"
  );
  const sendMessage = useMutation(api.messaging.sendMessage);
  const markRead = useMutation(api.messaging.markConversationRead);

  // Derive the receiverId and other-user info from the conversation list
  const convoMap = new Map(
    (conversations ?? []).map((c: any) => [c.conversationId, c])
  );
  const selectedConvo = selectedConvoId ? convoMap.get(selectedConvoId) : null;

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConvoId || !selectedConvo) return;
    setSending(true);
    try {
      await sendMessage({ receiverId: selectedConvo.otherUserId as any, content: newMessage.trim() });
      setNewMessage("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleSelectConvo = (convId: string) => {
    setSelectedConvoId(convId);
    markRead({ conversationId: convId }).catch(() => {});
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
          <p className="text-muted-foreground mt-1">Chat with your agronomist or support team</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Conversation List */}
          <Card className="border-border/50 md:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" /> Conversations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              {!conversations ? (
                <div className="space-y-2 p-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
              ) : conversations.length === 0 ? (
                <div className="py-8 text-center">
                  <Mail className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {conversations.map((c: any) => (
                    <button key={c._id} onClick={() => handleSelectConvo(c._id)}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${selectedConvoId === c._id ? "bg-primary/10 font-medium" : "hover:bg-muted"}`}>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarImage src={c.otherUserImage} />
                          <AvatarFallback className="text-[10px]">{(c.otherUserName || "U").charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="truncate">{c.otherUserName || "Unknown"}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{c.lastMessageContent || ""}</p>
                        </div>
                        {c.unreadCount > 0 && (
                          <Badge className="text-[10px] px-1.5 min-w-[18px] h-[18px]">{c.unreadCount}</Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Message Thread */}
          <Card className="border-border/50 md:col-span-2">
            {!selectedConvoId ? (
              <CardContent className="p-12 text-center">
                <Mail className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <h3 className="font-medium mb-1">Select a conversation</h3>
                <p className="text-sm text-muted-foreground">Choose a conversation from the left to view messages.</p>
              </CardContent>
            ) : (
              <>
                <CardHeader className="pb-3 border-b border-border">
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedConvoId(null)}>
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <Avatar className="w-8 h-8">
                      <AvatarImage src={selectedConvo?.otherImage} />
                      <AvatarFallback>{(selectedConvo?.otherName || "U").charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{selectedConvo?.otherName || "Conversation"}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">User</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[400px] overflow-y-auto p-4 space-y-3">
                    {!messages ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? "" : "justify-end"}`}>
                          <div className="h-10 w-40 bg-muted rounded-xl animate-pulse" />
                        </div>
                      ))
                    ) : messages.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">
                        No messages yet. Send the first message below.
                      </div>
                    ) : (
                      messages.map((msg: any, i: number) => {
                        const isMine = msg.senderId !== selectedConvo?.otherUserId;
                        return (
                          <div key={i} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] p-3 rounded-xl text-sm ${isMine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                              <p>{msg.content}</p>
                              <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                  <div className="p-4 border-t border-border flex gap-2">
                    <Input placeholder="Type a message..."
                      value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }} />
                    <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon">
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardContent>
              </>
            )}
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}