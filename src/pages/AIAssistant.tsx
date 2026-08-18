import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useHaptic } from "@/hooks/use-mobile";
import {
  Bot,
  User,
  Send,
  Loader2,
  Leaf,
  Cloud,
  Sprout,
  Sparkles,
  Copy,
  Trash2,
  MapPin,
  TrendingUp,
  Droplets,
  AlertTriangle,
  Beef,
  BarChart3,
  ThermometerSun,
  CloudRain,
  Wallet,
  CalendarCheck,
  ClipboardList,
} from "lucide-react";

// ============================================================
// Types
// ============================================================

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

const STORAGE_KEY = "farmbond-ai-conversation";
const MAX_STORED_MESSAGES = 100;

// ============================================================
// Local conversation persistence
// ============================================================

function loadStoredMessages(): Message[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is Message =>
        !!m && typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" && typeof m.id === "string" && typeof m.timestamp === "number"
    );
  } catch { return []; }
}

function saveMessages(messages: Message[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES))); } catch { /* Storage unavailable */ }
}

function clearStoredMessages() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

// ============================================================
// Context-aware suggestion chips
// ============================================================

interface SuggestionDef {
  icon: typeof Sprout;
  label: string;
  prompt: string;
}

const PRIMARY_SUGGESTIONS: SuggestionDef[] = [
  { icon: ClipboardList, label: "Today's priorities", prompt: "What should I do today based on my farm data?" },
  { icon: CalendarCheck, label: "Weekly farm plan", prompt: "Create my farm plan for this week based on my real data." },
  { icon: Sprout, label: "Farm overview", prompt: "How are my farms doing? Give me a summary." },
];

const CONTEXTUAL_SUGGESTIONS: SuggestionDef[] = [
  { icon: AlertTriangle, label: "Risks", prompt: "What risks should I watch this week?" },
  { icon: Leaf, label: "Crop priorities", prompt: "Which crop needs my attention first and why?" },
  { icon: Cloud, label: "Weather impact", prompt: "How will this week's weather affect my crops?" },
  { icon: CloudRain, label: "Irrigation", prompt: "Should I irrigate today? Check my schedules and weather." },
  { icon: ThermometerSun, label: "Soil health", prompt: "How is my soil health? What should I improve?" },
  { icon: Beef, label: "Livestock", prompt: "How is my livestock doing? Any vaccinations overdue?" },
  { icon: Wallet, label: "Finances", prompt: "How are my farm finances? Am I profitable?" },
  { icon: TrendingUp, label: "Market", prompt: "What market opportunities exist for my crops?" },
];

// ============================================================
// Entrance animation
// ============================================================

function useEntranceVariants() {
  const shouldReduceMotion = useReducedMotion();
  const duration = shouldReduceMotion ? 0 : 0.3;
  return {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: { duration } },
  };
}

// ============================================================
// Message formatter
// ============================================================

function MessageContent({ content }: { content: string }) {
  return (
    <div className="text-sm leading-relaxed break-words">
      {content.split("\n").map((line, i) => {
        if (line.startsWith("**") && line.endsWith("**")) {
          return <h3 key={i} className="text-sm font-bold mt-3 mb-1">{line.replace(/\*\*/g, "")}</h3>;
        }
        if (line.startsWith("• ")) {
          return <div key={i} className="flex items-start gap-2 ml-2"><span className="text-primary mt-1 shrink-0">•</span><span>{line.slice(2)}</span></div>;
        }
        const numMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return <div key={i} className="flex items-start gap-2 ml-2"><span className="text-primary font-semibold mt-0.5 shrink-0 text-xs">{numMatch[1]}.</span><span>{numMatch[2]}</span></div>;
        }
        if (line.startsWith("> ")) {
          return <div key={i} className="ml-3 pl-3 border-l-2 border-border/60 text-muted-foreground text-xs italic">{line.slice(2)}</div>;
        }
        if (line.trim() === "") return <div key={i} className="h-1.5" />;
        return <p key={i} className="leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

// ============================================================
// Chat Message
// ============================================================

function ChatMessage({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const haptic = useHaptic();

  const handleCopy = useCallback(() => {
    haptic.light();
    navigator.clipboard.writeText(message.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }, [message.content, haptic]);

  const isUser = message.role === "user";

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-deep shrink-0 mt-1"><Bot className="w-4 h-4 text-white" /></div>}
      <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 ${isUser ? "bg-primary text-primary-foreground rounded-br-md" : "bg-card border border-border/60 rounded-bl-md"}`}>
        <MessageContent content={message.content} />
        {!isUser && (
          <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border/50">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground px-2" onClick={handleCopy} aria-label={copied ? "Copied to clipboard" : "Copy response"}>
              {copied ? <CheckIcon /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>
        )}
      </div>
      {isUser && <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-secondary shrink-0 mt-1"><User className="w-4 h-4 text-secondary-foreground" /></div>}
    </motion.div>
  );
}

function CheckIcon() {
  return <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>;
}

// ============================================================
// Empty State
// ============================================================

function EmptyState({ onPick, farmCount, cropCount, livestockCount }: {
  onPick: (prompt: string) => void;
  farmCount: number | undefined;
  cropCount: number | undefined;
  livestockCount: number | undefined;
}) {
  const variants = useEntranceVariants();
  const visible = [...PRIMARY_SUGGESTIONS];

  if (cropCount && cropCount > 0) visible.push(CONTEXTUAL_SUGGESTIONS[1]); // Crop priorities
  visible.push(CONTEXTUAL_SUGGESTIONS[2]); // Weather impact
  visible.push(CONTEXTUAL_SUGGESTIONS[3]); // Irrigation
  if (livestockCount && livestockCount > 0) visible.push(CONTEXTUAL_SUGGESTIONS[5]); // Livestock
  if (farmCount && farmCount > 0) {
    visible.push(CONTEXTUAL_SUGGESTIONS[4]); // Soil health
    visible.push(CONTEXTUAL_SUGGESTIONS[6]); // Finances
  }

  return (
    <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.05 } } }} className="flex flex-col items-center justify-center min-h-full px-4 py-10">
      <motion.div variants={variants} className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-deep shadow-lg shadow-brand-deep/20 mb-4">
        <Sparkles className="w-7 h-7 text-white" />
      </motion.div>
      <motion.h2 variants={variants} className="text-xl sm:text-2xl font-semibold text-center">
        Your farm management advisor
      </motion.h2>
      <motion.p variants={variants} className="text-sm text-muted-foreground text-center max-w-md mt-2 leading-relaxed">
        Ask what to do today, create a weekly plan, check crop priorities, or get advice on irrigation, soil, livestock, and finances — all based on your real FarmBond data.
      </motion.p>
      {farmCount === 0 && (
        <motion.p variants={variants} className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5 mt-4">
          <MapPin className="w-3.5 h-3.5" />
          No farms registered yet — add one to get personalized advice.
        </motion.p>
      )}
      <motion.div variants={variants} className="flex flex-wrap justify-center gap-2 mt-6 max-w-lg">
        {visible.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.button key={i} variants={variants} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => onPick(s.prompt)}
              className="flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-full bg-muted/50 hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tap-highlight-none">
              <Icon className="w-4 h-4 shrink-0" />
              {s.label}
            </motion.button>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

// ============================================================
// Main Page
// ============================================================

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Hello! I'm your FarmBond farm management advisor 🌱\n\nI can help you with:\n• What to do today — prioritized based on your real data\n• Weekly farm plans — built from your schedules and crop stages\n• Crop prioritization — which crop needs attention first\n• Irrigation decisions — schedules, weather, and soil moisture\n• Soil health — analysis and improvement recommendations\n• Livestock care — health, vaccinations, and overdue alerts\n• Financial review — income, expenses, and profit analysis\n• Market opportunities — reference prices for your crops\n• Farm health explanation — why your score is what it is\n\nTry asking: \"What should I do today?\" or \"Create my weekly farm plan.\"",
  timestamp: Date.now(),
};

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const stored = loadStoredMessages();
    return stored.length > 0 ? stored : [WELCOME_MESSAGE];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const haptic = useHaptic();
  const shouldReduceMotion = useReducedMotion();

  const farmsRes = useQuery(api.farms.listUserFarms, {});
  const cropsRes = useQuery(api.crops.listUserCrops, {});
  const farmCount = farmsRes?.page?.length;
  const cropCount = cropsRes?.page?.length;

  const firstFarmId = farmsRes?.page?.[0]?._id;
  const livestockRes = useQuery(api.livestock.listFarmLivestock, firstFarmId ? { farmId: firstFarmId } : "skip");
  const livestockCount = livestockRes?.page?.length;

  const chatWithFarmContext = useAction(api.aiAssistant.chatWithFarmContext);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: shouldReduceMotion ? "auto" : "smooth", block: "end" });
  }, [shouldReduceMotion]);

  useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);
  useEffect(() => { saveMessages(messages); }, [messages]);

  const handleSend = useCallback(async (content?: string) => {
    const messageContent = (content ?? input).trim();
    if (!messageContent || isLoading) return;
    haptic.light();
    const userMessage: Message = { id: `u-${Date.now()}`, role: "user", content: messageContent, timestamp: Date.now() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    try {
      const history = messages.slice(-6).map((m) => ({ role: m.role === "user" ? ("user" as const) : ("model" as const), parts: [{ text: m.content }] }));
      const result = await chatWithFarmContext({ message: messageContent, history });
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: "assistant", content: result.response, timestamp: Date.now() }]);
    } catch (error) {
      console.error("AI chat error:", error);
      const msg = error instanceof Error ? error.message : "Something went wrong";
      setMessages((prev) => [...prev, { id: `e-${Date.now()}`, role: "assistant", content: `I couldn't complete that request. ${msg}\n\nPlease try again, or check your connection and daily AI allowance.`, timestamp: Date.now() }]);
    } finally { setIsLoading(false); }
  }, [input, isLoading, messages, chatWithFarmContext, haptic]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleNewConversation = useCallback(() => {
    haptic.medium();
    clearStoredMessages();
    setMessages([WELCOME_MESSAGE]);
    setInput("");
  }, [haptic]);

  const hasRealMessages = messages.some((m) => m.id !== "welcome");

  const connectedModules: string[] = [];
  if (farmCount && farmCount > 0) connectedModules.push(`${farmCount} farm${farmCount === 1 ? "" : "s"}`);
  if (cropCount && cropCount > 0) connectedModules.push(`${cropCount} crop${cropCount === 1 ? "" : "s"}`);
  if (livestockCount && livestockCount > 0) connectedModules.push(`${livestockCount} livestock`);

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-5rem)]">
        <div className="border-b border-border bg-background/95 backdrop-blur-xl px-4 md:px-6 py-4">
          <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-deep shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-semibold truncate">AI Farm Advisor</h1>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {farmCount === undefined ? "Connecting to your farm data…" : connectedModules.length > 0 ? `${connectedModules.join(" · ")} connected` : "No farm data connected yet"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="hidden sm:inline-flex">
                <Sparkles className="w-3 h-3 mr-1 text-primary" />
                FarmBond AI
              </Badge>
              <Button variant="outline" size="sm" className="gap-1.5 h-9" onClick={handleNewConversation} aria-label="Start a new conversation">
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">New chat</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6" role="log" aria-live="polite" aria-label="AI assistant conversation">
          <div className="max-w-5xl mx-auto space-y-5">
            {messages.filter((m) => hasRealMessages || m.id !== "welcome").map((message) => <ChatMessage key={message.id} message={message} />)}
            {isLoading && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-deep shrink-0"><Bot className="w-4 h-4 text-white" /></div>
                <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md p-4 min-w-[180px]">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Analyzing your farm data…</span>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-2.5 w-full" />
                    <Skeleton className="h-2.5 w-4/5" />
                    <Skeleton className="h-2.5 w-3/5" />
                  </div>
                </div>
              </motion.div>
            )}
            {!hasRealMessages && !isLoading && <EmptyState onPick={(prompt) => handleSend(prompt)} farmCount={farmCount} cropCount={cropCount} livestockCount={livestockCount} />}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-border bg-background/95 backdrop-blur-xl p-3 md:p-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Ask about your farm, crops, weather…" className="min-h-[48px] max-h-32 resize-none rounded-xl pr-12 py-3" disabled={isLoading} rows={1} aria-label="Message the AI assistant" />
                <Button onClick={() => handleSend()} disabled={!input.trim() || isLoading} className="absolute right-1.5 bottom-1.5 h-9 w-9 rounded-lg" size="icon" aria-label="Send message">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2 px-2">
              FarmBond AI advises from your recorded farm data. Always verify important decisions with a local agronomist or extension officer.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
