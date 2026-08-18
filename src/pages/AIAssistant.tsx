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
        !!m &&
        typeof m === "object" &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        typeof m.id === "string" &&
        typeof m.timestamp === "number"
    );
  } catch {
    return [];
  }
}

function saveMessages(messages: Message[]) {
  try {
    const trimmed = messages.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage unavailable
  }
}

function clearStoredMessages() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

// ============================================================
// Context-aware suggestion chips
// ============================================================

interface SuggestionDef {
  icon: typeof Sprout;
  label: string;
  prompt: string;
  category: "core" | "crops" | "livestock" | "weather" | "soil" | "finance" | "planning";
}

const ALL_SUGGESTIONS: SuggestionDef[] = [
  { icon: Sprout, label: "My farms", prompt: "How are my farms doing?", category: "core" },
  { icon: BarChart3, label: "Weekly plan", prompt: "What should I prioritize this week based on my farm data?", category: "planning" },
  { icon: AlertTriangle, label: "Risks", prompt: "What risks should I watch this week?", category: "core" },
  { icon: Leaf, label: "Crop health", prompt: "How are my crops doing? Which one needs attention?", category: "crops" },
  { icon: Cloud, label: "Weather outlook", prompt: "What does this week's weather mean for my crops?", category: "weather" },
  { icon: CloudRain, label: "Rain forecast", prompt: "Is rain expected soon? Should I adjust irrigation?", category: "weather" },
  { icon: Droplets, label: "Irrigation", prompt: "Should I irrigate today? Check my schedules and weather.", category: "soil" },
  { icon: ThermometerSun, label: "Soil health", prompt: "How is my soil? What should I improve?", category: "soil" },
  { icon: Beef, label: "Livestock care", prompt: "How is my livestock doing? Any vaccinations overdue?", category: "livestock" },
  { icon: Wallet, label: "Farm finances", prompt: "Am I making money? How are my expenses?", category: "finance" },
  { icon: TrendingUp, label: "Cost reduction", prompt: "How can I reduce my farm expenses and improve profit?", category: "finance" },
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
          return (
            <h3 key={i} className="text-sm font-bold mt-3 mb-1">
              {line.replace(/\*\*/g, "")}
            </h3>
          );
        }
        if (line.startsWith("• ")) {
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <span className="text-primary mt-1 shrink-0">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        const numMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex items-start gap-2 ml-2">
              <span className="text-primary font-semibold mt-0.5 shrink-0 text-xs">
                {numMatch[1]}.
              </span>
              <span>{numMatch[2]}</span>
            </div>
          );
        }
        if (line.startsWith("> ")) {
          return (
            <div key={i} className="ml-3 pl-3 border-l-2 border-border/60 text-muted-foreground text-xs italic">
              {line.slice(2)}
            </div>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-1.5" />;
        }
        return (
          <p key={i} className="leading-relaxed">
            {line}
          </p>
        );
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
    navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  }, [message.content, haptic]);

  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-deep shrink-0 mt-1">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      <div
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border border-border/60 rounded-bl-md"
        }`}
      >
        <MessageContent content={message.content} />

        {!isUser && (
          <div className="flex items-center gap-1 mt-3 pt-2 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground hover:text-foreground px-2"
              onClick={handleCopy}
              aria-label={copied ? "Copied to clipboard" : "Copy response"}
            >
              {copied ? <CheckIcon /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-xs">{copied ? "Copied" : "Copy"}</span>
            </Button>
          </div>
        )}
      </div>

      {isUser && (
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-secondary shrink-0 mt-1">
          <User className="w-4 h-4 text-secondary-foreground" />
        </div>
      )}
    </motion.div>
  );
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// ============================================================
// Empty State — adapts suggestions to available data
// ============================================================

function EmptyState({
  onPick,
  farmCount,
  cropCount,
  livestockCount,
}: {
  onPick: (prompt: string) => void;
  farmCount: number | undefined;
  cropCount: number | undefined;
  livestockCount: number | undefined;
}) {
  const variants = useEntranceVariants();

  const visible: SuggestionDef[] = [
    ALL_SUGGESTIONS[0], // My farms
    ALL_SUGGESTIONS[1], // Weekly plan
  ];

  if (cropCount && cropCount > 0) {
    visible.push(ALL_SUGGESTIONS[3]); // Crop health
  }
  visible.push(ALL_SUGGESTIONS[4]); // Weather outlook
  visible.push(ALL_SUGGESTIONS[6]); // Irrigation

  if (livestockCount && livestockCount > 0) {
    visible.push(ALL_SUGGESTIONS[8]); // Livestock care
  }
  if (farmCount && farmCount > 0) {
    visible.push(ALL_SUGGESTIONS[7]); // Soil health
    visible.push(ALL_SUGGESTIONS[9]); // Farm finances
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
      className="flex flex-col items-center justify-center min-h-full px-4 py-10"
    >
      <motion.div
        variants={variants}
        className="flex items-center justify-center w-14 h-14 rounded-2xl bg-brand-deep shadow-lg shadow-brand-deep/20 mb-4"
      >
        <Sparkles className="w-7 h-7 text-white" />
      </motion.div>
      <motion.h2
        variants={variants}
        className="text-xl sm:text-2xl font-semibold text-center"
      >
        Ask your farm, anything
      </motion.h2>
      <motion.p
        variants={variants}
        className="text-sm text-muted-foreground text-center max-w-md mt-2 leading-relaxed"
      >
        FarmBond AI answers using your actual farm data — crops, livestock,
        weather, soil, irrigation, and finances. If something isn&apos;t
        recorded yet, it will tell you honestly instead of guessing.
      </motion.p>

      {farmCount === 0 && (
        <motion.p
          variants={variants}
          className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1.5 mt-4"
        >
          <MapPin className="w-3.5 h-3.5" />
          No farms registered yet — add one to get farm-specific answers.
        </motion.p>
      )}

      <motion.div
        variants={variants}
        className="flex flex-wrap justify-center gap-2 mt-6 max-w-lg"
      >
        {visible.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.button
              key={i}
              variants={variants}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onPick(s.prompt)}
              className="flex items-center gap-2 px-3.5 py-2.5 min-h-[44px] rounded-full bg-muted/50 hover:bg-muted text-sm text-muted-foreground hover:text-foreground transition-colors border border-transparent hover:border-border/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tap-highlight-none"
            >
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
    "Hello! I'm your FarmBond farming assistant 🌱\n\nI can help you with:\n• Farm health and performance — using your real FarmBond data\n• Crop management, pest control, and growth tracking\n• Weather-based decisions and irrigation timing\n• Livestock care and vaccination planning\n• Soil health analysis and improvement\n• Farm budgeting, expenses, and profit optimization\n• Weekly prioritized action plans\n\nAsk me anything about your farms — I'll use your recorded data and tell you honestly when information is missing.\n\nTry asking: \"How are my farms doing?\" or \"What should I do this week?\"",
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
  const livestockRes = useQuery(
    api.livestock.listFarmLivestock,
    firstFarmId ? { farmId: firstFarmId } : "skip"
  );
  const livestockCount = livestockRes?.page?.length;

  const chatWithFarmContext = useAction(api.aiAssistant.chatWithFarmContext);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
      block: "end",
    });
  }, [shouldReduceMotion]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const handleSend = useCallback(
    async (content?: string) => {
      const messageContent = (content ?? input).trim();
      if (!messageContent || isLoading) return;

      haptic.light();
      const userMessage: Message = {
        id: `u-${Date.now()}`,
        role: "user",
        content: messageContent,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const history = messages.slice(-6).map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("model" as const),
          parts: [{ text: m.content }],
        }));

        const result = await chatWithFarmContext({
          message: messageContent,
          history: history,
        });

        const assistantMessage: Message = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: result.response,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } catch (error) {
        console.error("AI chat error:", error);
        const msg =
          error instanceof Error ? error.message : "Something went wrong";
        const assistantMessage: Message = {
          id: `e-${Date.now()}`,
          role: "assistant",
          content: `I couldn't complete that request. ${msg}\n\nPlease try again, or check your connection and daily AI allowance.`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages, chatWithFarmContext, haptic]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
        {/* Header */}
        <div className="border-b border-border bg-background/95 backdrop-blur-xl px-4 md:px-6 py-4">
          <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-deep shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-semibold truncate">
                  AI Farming Assistant
                </h1>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {farmCount === undefined
                      ? "Connecting to your farm data…"
                      : connectedModules.length > 0
                        ? `${connectedModules.join(" · ")} connected`
                        : "No farm data connected yet"}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="hidden sm:inline-flex">
                <Sparkles className="w-3 h-3 mr-1 text-primary" />
                FarmBond AI
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
                onClick={handleNewConversation}
                aria-label="Start a new conversation"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">New chat</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-4 md:px-6 py-6"
          role="log"
          aria-live="polite"
          aria-label="AI assistant conversation"
        >
          <div className="max-w-5xl mx-auto space-y-5">
            {messages
              .filter((m) => hasRealMessages || m.id !== "welcome")
              .map((message) => (
                <ChatMessage key={message.id} message={message} />
              ))}

            {isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-brand-deep shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div className="bg-card border border-border/60 rounded-2xl rounded-bl-md p-4 min-w-[180px]">
                  <div className="flex items-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">
                      Thinking with your farm data…
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-2.5 w-full" />
                    <Skeleton className="h-2.5 w-4/5" />
                    <Skeleton className="h-2.5 w-3/5" />
                  </div>
                </div>
              </motion.div>
            )}

            {!hasRealMessages && !isLoading && (
              <EmptyState
                onPick={(prompt) => handleSend(prompt)}
                farmCount={farmCount}
                cropCount={cropCount}
                livestockCount={livestockCount}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-background/95 backdrop-blur-xl p-3 md:p-4">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your farm, crops, weather…"
                  className="min-h-[48px] max-h-32 resize-none rounded-xl pr-12 py-3"
                  disabled={isLoading}
                  rows={1}
                  aria-label="Message the AI assistant"
                />
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-1.5 bottom-1.5 h-9 w-9 rounded-lg"
                  size="icon"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-center text-xs text-muted-foreground mt-2 px-2">
              FarmBond AI answers from your recorded farm data. Always verify
              important decisions with a local agronomist or extension officer.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
